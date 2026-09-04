"use client";

import { useEffect, useState } from "react";

type WebMcpInspectorProps = {
  scope: "public" | "authenticated";
  role?: "owner" | "member";
  siteSlug?: string;
  organizationSlug?: string;
  activeToolNames: string[];
};

type InspectorTool = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
};

export function WebMcpInspector({
  scope,
  role,
  siteSlug,
  organizationSlug,
  activeToolNames,
}: WebMcpInspectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tools, setTools] = useState<InspectorTool[]>([]);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function loadTools() {
      try {
        const doc = document as unknown as {
          modelContext?: {
            getTools?: () => Promise<InspectorTool[]>;
          };
        };
        if (doc.modelContext && typeof doc.modelContext.getTools === "function") {
          const registered = await doc.modelContext.getTools();
          setTools(registered || []);
        } else {
          setTools(activeToolNames.map((name) => ({ name, description: "Active WebMCP capability" })));
        }
      } catch {
        setTools(activeToolNames.map((name) => ({ name, description: "Active WebMCP capability" })));
      }
    }

    void loadTools();
  }, [isOpen, activeToolNames]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const copyConsoleSnippet = async () => {
    const snippet = "document.modelContext.getTools().then(tools => console.table(tools.map(t => ({ name: t.name, description: t.description }))));";
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const toolCount = activeToolNames.length || tools.length;

  return (
    <>
      <div className="webmcp-inspector-trigger-container">
        <button
          type="button"
          className="webmcp-inspector-trigger-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Open WebMCP Runtime Inspector"
        >
          <span className="webmcp-inspector-dot" />
          <span className="webmcp-inspector-tag">WebMCP Inspector</span>
          <span className="webmcp-inspector-count">{toolCount} tools</span>
        </button>
      </div>

      {isOpen ? (
        <div className="webmcp-inspector-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="webmcp-inspector-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="webmcp-inspector-title"
          >
            <div className="webmcp-inspector-header">
              <div>
                <div className="webmcp-inspector-badge-line">
                  <span className="webmcp-protocol-badge">document.modelContext</span>
                  <span className="webmcp-scope-badge">{scope === "authenticated" ? `Owner (${role || "owner"})` : "Public Site"}</span>
                </div>
                <h2 id="webmcp-inspector-title">WebMCP Runtime Inspector</h2>
              </div>
              <button
                type="button"
                className="webmcp-inspector-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close inspector"
              >
                ×
              </button>
            </div>

            <div className="webmcp-inspector-meta">
              <div className="webmcp-meta-item">
                <span>Context Key</span>
                <strong>{siteSlug || organizationSlug || "global"}</strong>
              </div>
              <div className="webmcp-meta-item">
                <span>Active Tools</span>
                <strong>{toolCount} Registered</strong>
              </div>
              <div className="webmcp-meta-item">
                <span>Specification</span>
                <strong>W3C WebMCP Draft</strong>
              </div>
            </div>

            <div className="webmcp-inspector-tools-section">
              <div className="webmcp-section-header">
                <h3>Registered Capabilities ({tools.length || activeToolNames.length})</h3>
                <button
                  type="button"
                  className="webmcp-copy-snippet-btn"
                  onClick={copyConsoleSnippet}
                  title="Copy DevTools command to inspect in Chrome Console"
                >
                  {copied ? "Copied snippet" : "Copy console test snippet"}
                </button>
              </div>

              <div className="webmcp-tools-list">
                {(tools.length ? tools : activeToolNames.map((n): InspectorTool => ({ name: n, description: "Active WebMCP tool" }))).map((tool) => {
                  const isExpanded = expandedTool === tool.name;
                  return (
                    <div key={tool.name} className="webmcp-tool-card">
                      <div
                        className="webmcp-tool-summary"
                        onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                      >
                        <div className="webmcp-tool-title-row">
                          <code className="webmcp-tool-name">{tool.name}</code>
                          <span className="webmcp-expand-indicator">{isExpanded ? "Hide schema" : "View schema"}</span>
                        </div>
                        <p className="webmcp-tool-desc">{tool.description}</p>
                      </div>

                      {isExpanded && tool.inputSchema ? (
                        <div className="webmcp-schema-box">
                          <span className="webmcp-schema-label">Input JSON Schema:</span>
                          <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="webmcp-inspector-footer">
              <p>Tools are dynamically bound to the current page state, user authentication, and tenant boundaries.</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
