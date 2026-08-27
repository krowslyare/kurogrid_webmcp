"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { WebMcpToolDefinition } from "../contracts";

type Props = {
  organizationSlug?: string;
  siteSlug?: string;
  contextKey: string;
};

type RegistrarState =
  | { status: "checking"; names: string[] }
  | { status: "unsupported"; names: string[] }
  | { status: "active"; names: string[] }
  | { status: "error"; names: string[] };

export function WebMcpRegistrar({ organizationSlug, siteSlug, contextKey }: Props) {
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

    let generation = 0;
    let registrationController = new AbortController();

    async function refresh() {
      const currentGeneration = ++generation;
      const search = new URLSearchParams();
      if (organizationSlug) search.set("organizationSlug", organizationSlug);
      if (siteSlug) search.set("siteSlug", siteSlug);

      const response = await fetch(`/api/webmcp/capabilities?${search}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("capability_resolution_failed");
      }

      const payload = (await response.json()) as {
        definitions: WebMcpToolDefinition[];
      };

      if (disposed || currentGeneration !== generation) return;

      registrationController.abort();
      registrationController = new AbortController();

      await Promise.all(
        payload.definitions.map((definition) =>
          modelContext!.registerTool(
            {
              ...definition,
              async execute(input, options) {
                const executeResponse = await fetch("/api/webmcp/execute", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    name: definition.name,
                    input,
                    organizationSlug,
                    siteSlug,
                  }),
                  signal: options.signal,
                });
                const result = await executeResponse.json();

                if (!executeResponse.ok) {
                  throw new Error(result.error ?? "tool_execution_failed");
                }

                if (result.capabilities_changed) {
                  router.refresh();
                  void refresh();
                }

                return result;
              },
            },
            { signal: registrationController.signal },
          ),
        ),
      );

      if (!disposed && currentGeneration === generation) {
        setState({
          status: "active",
          names: payload.definitions.map((definition) => definition.name),
        });
      }
    }

    queueMicrotask(() => {
      if (!disposed) setState({ status: "checking", names: [] });
    });
    void refresh().catch(() => {
      if (!disposed) setState({ status: "error", names: [] });
    });

    return () => {
      disposed = true;
      generation += 1;
      registrationController.abort();
    };
  }, [contextKey, organizationSlug, router, siteSlug]);

  return (
    <aside className="agent-access" aria-live="polite">
      <div>
        <p className="kicker">Agent Access Center</p>
        <strong>
          {state.status === "active"
            ? `${state.names.length} native tools active`
            : state.status === "unsupported"
              ? "WebMCP unavailable in this browser"
              : state.status === "error"
                ? "WebMCP registration failed"
                : "Resolving current capabilities"}
        </strong>
      </div>
      {state.names.length ? (
        <ul>{state.names.map((name) => <li key={name}>{name}</li>)}</ul>
      ) : null}
    </aside>
  );
}
