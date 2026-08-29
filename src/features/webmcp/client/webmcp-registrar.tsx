"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { WebMcpToolDefinition } from "../contracts";

type Props = {
  organizationSlug?: string;
  siteSlug?: string;
  contextKey: string;
  presentation?: "workspace" | "public-site";
  appointmentId?: string;
  accessToken?: string;
  confirmationToken?: string;
};

type RegistrarState =
  | { status: "checking"; names: string[] }
  | { status: "unsupported"; names: string[] }
  | { status: "active"; names: string[] }
  | { status: "error"; names: string[] };

const publicCapabilityLabels: Record<string, string> = {
  get_site_content: "Published care details",
  get_opening_hours: "Current opening hours",
  get_clinic_services: "Available services",
  find_appointment_slots: "Live appointment times",
  prepare_appointment_request: "Prepare a request",
  confirm_appointment_request: "Submit reviewed request",
  get_appointment_status: "Latest appointment status",
  respond_to_appointment_proposal: "Respond to the clinic",
  get_appointment_calendar_event: "Calendar handoff",
};

export function WebMcpRegistrar({
  organizationSlug,
  siteSlug,
  contextKey,
  presentation = "workspace",
  appointmentId,
  accessToken,
  confirmationToken,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<RegistrarState>({
    status: "checking",
    names: [],
  });

  useEffect(() => {
    const modelContext = document.modelContext;
    let disposed = false;

    if (!modelContext) {
      queueMicrotask(() => {
        if (!disposed) setState({ status: "unsupported", names: [] });
      });
      return () => {
        disposed = true;
      };
    }
    const activeModelContext = modelContext;

    let generation = 0;
    let registrationController = new AbortController();

    async function refresh() {
      const currentGeneration = ++generation;
      try {
        const search = new URLSearchParams();
        if (organizationSlug) search.set("organizationSlug", organizationSlug);
        if (siteSlug) search.set("siteSlug", siteSlug);
        if (appointmentId) search.set("appointmentId", appointmentId);
        if (accessToken) search.set("accessToken", accessToken);
        if (confirmationToken) search.set("confirmationToken", confirmationToken);

        const response = await fetch(`/api/webmcp/capabilities?${search}`, {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error("capability_resolution_failed");
        }

        const payload = (await response.json()) as {
          definitions: WebMcpToolDefinition[];
        };

        if (disposed || currentGeneration !== generation) return;

        registrationController.abort();
        const nextController = new AbortController();
        registrationController = nextController;

        try {
          await Promise.all(
            payload.definitions.map((definition) =>
              activeModelContext.registerTool(
                {
                  ...definition,
                  async execute(input, options) {
                    const executeResponse = await fetch("/api/webmcp/execute", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      credentials: "same-origin",
                      body: JSON.stringify({
                        name: definition.name,
                        input,
                        organizationSlug,
                        siteSlug,
                        appointmentId,
                        accessToken,
                        confirmationToken,
                      }),
                      signal: options?.signal,
                    });
                    const result = await executeResponse.json();

                    if (!executeResponse.ok) {
                      throw new Error(result.error ?? "tool_execution_failed");
                    }

                    if (result.capabilities_changed) {
                      if (typeof result.navigate_to === "string") {
                        router.push(result.navigate_to);
                      } else {
                        router.refresh();
                        void refresh();
                      }
                    }

                    return result;
                  },
                },
                { signal: nextController.signal },
              ),
            ),
          );
        } catch (error) {
          nextController.abort();
          throw error;
        }

        if (!disposed && currentGeneration === generation) {
          setState({
            status: "active",
            names: payload.definitions.map((definition) => definition.name),
          });
        }
      } catch {
        if (!disposed && currentGeneration === generation) {
          registrationController.abort();
          setState({ status: "error", names: [] });
        }
      }
    }

    queueMicrotask(() => {
      if (!disposed) setState({ status: "checking", names: [] });
    });
    void refresh();

    return () => {
      disposed = true;
      generation += 1;
      registrationController.abort();
    };
  }, [accessToken, appointmentId, confirmationToken, contextKey, organizationSlug, router, siteSlug]);

  const publicPresentation = presentation === "public-site";
  const publicLabels = [...new Set(
    state.names.map((name) => publicCapabilityLabels[name]).filter(Boolean),
  )];

  if (!publicPresentation) {
    const statusLabel = state.status === "active"
      ? `${state.names.length} safe action${state.names.length === 1 ? " is" : "s are"} available for this step`
      : state.status === "unsupported"
        ? "The guided demo still works in this browser"
        : state.status === "error"
          ? "AI actions are temporarily unavailable"
          : "Checking what the AI can do at this step";

    return (
      <details className="agent-access agent-access-details" aria-live="polite">
        <summary>
          <div>
            <p className="kicker">What the AI can do right now</p>
            <strong>{statusLabel}</strong>
          </div>
          <span>See WebMCP details</span>
        </summary>
        {state.names.length ? (
          <ul>
            {state.names.map((name) => <li key={name}>{name}</li>)}
          </ul>
        ) : (
          <p>
            The human workflow remains available even when this browser cannot
            register agent actions.
          </p>
        )}
      </details>
    );
  }

  return (
    <aside
      className={`agent-access${publicPresentation ? " public-agent-access" : ""}`}
      aria-live="polite"
    >
      <div>
        <p className="kicker">
          Connected information
        </p>
        <strong>
          {state.status === "active"
            ? "Up to date for people and assistants"
            : state.status === "unsupported"
              ? "You are viewing the latest published information"
              : state.status === "error"
                ? "Published information is still available on this page"
                : "Checking the latest published information"}
        </strong>
      </div>
      {publicLabels.length ? (
        <ul>
          {publicLabels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
