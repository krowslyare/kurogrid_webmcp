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

type AgentActivity = {
  detail: string;
  title: string;
};


function toolActivity(
  name: string,
  result: Record<string, unknown>,
  presentation: "workspace" | "public-site",
): AgentActivity | null {
  if (presentation === "workspace") {
    switch (name) {
      case "get_availability_configuration":
        return { title: "Availability configuration read", detail: "Current ranges, recurring blocks, busy intervals, and booking impact were read before changing anything." };
      case "prepare_availability_plan":
        return { title: "Availability plan prepared", detail: "Mimo derived affected bookings and valid alternatives; existing bookings remain preserved and nothing was applied." };
      case "apply_availability_plan":
        return { title: "Owner request completed", detail: "The exact plan was approved and applied from this Owner session; the customer notification status is now visible." };
      case "apply_approved_availability_plan":
        return { title: "Approved availability applied", detail: "The exact Owner-approved plan changed availability; proposal and notification status are now visible." };
      case "get_attention": {
        const items = Array.isArray(result.attention) ? result.attention.length : 0;
        return { title: "Business evidence read", detail: `${items} signals checked before preparing any change.` };
      }
      case "create_action_plan":
        return { title: "Action plan prepared", detail: "A fixed three-step plan now connects the evidence to the website draft." };
      case "acknowledge_lead_attention":
        return { title: "Customer question reviewed", detail: "The signal was acknowledged without contacting the customer or sending PII." };
      case "get_site_content":
        return { title: "Current website state read", detail: "The assistant checked the draft and the version customers can see now." };
      case "create_or_patch_site_draft":
        return { title: "Website draft saved", detail: "The proposed copy is still private and requires a fresh Owner approval." };
      case "preview_publish_consequences":
        return { title: "Publication preview ready", detail: "Human-facing copy and assistant-facing facts were derived from the same draft." };
      case "publish_site_draft":
        return { title: "One version published", detail: "Customers and assistants now read the same immutable website version." };
      case "get_opening_hours":
        return { title: "Opening hours checked", detail: "The assistant read the current published hours before suggesting a change." };
      case "list_site_versions":
        return { title: "Publication history checked", detail: "The assistant read the reversible version history without changing it." };
      case "rollback_site_version":
        return { title: "Earlier version restored", detail: "The public page and its assistant-readable facts moved back together." };
      default:
        return null;
    }
  }

  switch (name) {
    case "get_site_content":
      return { title: "Published information read", detail: "The assistant checked the same current information shown on this page." };
    case "get_opening_hours":
      return { title: "Opening hours checked", detail: "The assistant read the current published hours before suggesting a visit." };
    case "get_clinic_services": {
      const services = Array.isArray(result.services) ? result.services.length : 0;
      return { title: "Published services read", detail: `${services} current ${services === 1 ? "service" : "services"} checked on this page.` };
    }
    case "find_appointment_slots": {
      const slots = Array.isArray(result.slots) ? result.slots.length : 0;
      return { title: "Live availability checked", detail: `${slots} available ${slots === 1 ? "time" : "times"} found for the requested day.` };
    }
    case "prepare_appointment_request":
      return { title: "Request prepared", detail: "The exact service, time, pet, and email are ready for customer review." };
    case "confirm_appointment_request":
      return { title: "Reviewed request sent", detail: "Mimo can now accept the appointment or suggest another time." };
    case "get_appointment_status":
      return { title: "Clinic response checked", detail: "The assistant read the latest status from this private appointment link." };
    case "respond_to_appointment_proposal":
      return { title: "New time answered", detail: "The customer decision is reflected on this page." };
    case "get_appointment_calendar_event":
      return { title: "Calendar handoff ready", detail: "The confirmed appointment is available as Google Calendar and iCalendar data." };
    default:
      return null;
  }
}

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
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const activityStorageKey = siteSlug
    ? `kurogrid:agent-activity:${siteSlug}`
    : organizationSlug
      ? `kurogrid:agent-activity:workspace:${organizationSlug}`
      : null;

  useEffect(() => {
    if (!activityStorageKey) return;
    const stored = sessionStorage.getItem(activityStorageKey);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as AgentActivity & { expiresAt: number };
      if (parsed.expiresAt > Date.now()) {
        queueMicrotask(() => setActivity({ title: parsed.title, detail: parsed.detail }));
      } else {
        sessionStorage.removeItem(activityStorageKey);
      }
    } catch {
      sessionStorage.removeItem(activityStorageKey);
    }
  }, [activityStorageKey]);

  useEffect(() => {
    if (!activity) return;

    const timeout = window.setTimeout(() => {
      setActivity(null);
      if (activityStorageKey) sessionStorage.removeItem(activityStorageKey);
    }, 6_500);

    return () => window.clearTimeout(timeout);
  }, [activity, activityStorageKey]);

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
                    const result = (await executeResponse.json()) as Record<string, unknown>;

                    if (!executeResponse.ok) {
                      throw new Error(
                        typeof result.error === "string"
                          ? result.error
                          : "tool_execution_failed",
                      );
                    }

                    const nextActivity = toolActivity(definition.name, result, presentation);
                    if (nextActivity) {
                      setActivity(nextActivity);
                      if (activityStorageKey) {
                        sessionStorage.setItem(
                          activityStorageKey,
                          JSON.stringify({ ...nextActivity, expiresAt: Date.now() + 10_000 }),
                        );
                      }
                    }

                    if (result.capabilities_changed === true) {
                      router.refresh();
                      if (typeof result.navigate_to === "string") {
                        router.push(result.navigate_to);
                      }
                      void refresh();
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
  }, [accessToken, activityStorageKey, appointmentId, confirmationToken, contextKey, organizationSlug, presentation, router, siteSlug]);

  const publicPresentation = presentation === "public-site";

  if (!publicPresentation) {
    const statusLabel = state.status === "active"
      ? `${state.names.length} action${state.names.length === 1 ? " is" : "s are"} available on this screen`
      : state.status === "unsupported"
        ? "The guided demo still works in this browser"
        : state.status === "error"
          ? "AI actions are temporarily unavailable"
          : "Checking what the AI can do at this step";

    return (
      <>
        {activity ? (
          <aside className="agent-activity-receipt is-workspace" aria-live="polite">
            <div aria-hidden="true">AI</div>
            <span>
              <small>Assistant activity</small>
              <strong>{activity.title}</strong>
              <p>{activity.detail}</p>
            </span>
            <button
              type="button"
              onClick={() => {
                setActivity(null);
                if (activityStorageKey) sessionStorage.removeItem(activityStorageKey);
              }}
              aria-label="Dismiss assistant activity"
            >×</button>
          </aside>
        ) : null}
        <details className="agent-access agent-access-details" aria-live="polite">
          <summary>
            <div>
              <p className="kicker">Available to your assistant</p>
              <strong>{statusLabel}</strong>
            </div>
            <span>Technical details</span>
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
      </>
    );
  }

  return (
    <>
      {activity ? (
        <aside
          className={`agent-activity-receipt${appointmentId ? " is-appointment" : ""}`}
          aria-live="polite"
        >
          <div aria-hidden="true">AI</div>
          <span>
            <small>Assistant activity</small>
            <strong>{activity.title}</strong>
            <p>{activity.detail}</p>
          </span>
          <button
            type="button"
            onClick={() => {
              setActivity(null);
              if (activityStorageKey) sessionStorage.removeItem(activityStorageKey);
            }}
            aria-label="Dismiss assistant activity"
          >×</button>
        </aside>
      ) : null}
    </>
  );
}
