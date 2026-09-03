"use client";

class InMemoryModelContext extends EventTarget implements WebMcpModelContext {
  private tools = new Map<string, WebMcpTool>();

  async registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ): Promise<void> {
    if (options?.signal?.aborted) return;
    this.tools.set(tool.name, tool);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => {
        if (this.tools.get(tool.name) === tool) {
          this.tools.delete(tool.name);
          this.dispatchEvent(
            new CustomEvent("toolchange", {
              detail: { name: tool.name, action: "unregister" },
            }),
          );
        }
      });
    }

    this.dispatchEvent(
      new CustomEvent("toolchange", {
        detail: { name: tool.name, action: "register" },
      }),
    );
  }

  async unregisterTool(name: string): Promise<void> {
    this.tools.delete(name);
    this.dispatchEvent(
      new CustomEvent("toolchange", {
        detail: { name, action: "unregister" },
      }),
    );
  }

  async getTools(): Promise<
    Array<{
      name: string;
      title?: string;
      description: string;
      inputSchema?: Record<string, unknown>;
      annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
    }>
  > {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    }));
  }

  async executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`WebMCP tool "${name}" is not registered.`);
    }
    return tool.execute(input);
  }
}

export function ensureWebMcpModelContext(): WebMcpModelContext {
  if (typeof window === "undefined") {
    return new InMemoryModelContext();
  }

  if (document.modelContext) {
    return document.modelContext;
  }

  if (navigator.modelContext) {
    return navigator.modelContext;
  }

  if (window.modelContext) {
    return window.modelContext;
  }

  const polyfill = new InMemoryModelContext();

  try {
    Object.defineProperty(Document.prototype, "modelContext", {
      get() {
        return polyfill;
      },
      configurable: true,
      enumerable: true,
    });
  } catch {
    // Ignore Document.prototype error
  }

  try {
    Object.defineProperty(document, "modelContext", {
      get() {
        return polyfill;
      },
      configurable: true,
      enumerable: true,
    });
  } catch {
    (document as unknown as { modelContext: WebMcpModelContext }).modelContext = polyfill;
  }

  try {
    Object.defineProperty(Navigator.prototype, "modelContext", {
      get() {
        return polyfill;
      },
      configurable: true,
      enumerable: true,
    });
  } catch {
    // Ignore Navigator.prototype error
  }

  try {
    (window as unknown as { modelContext: WebMcpModelContext }).modelContext = polyfill;
  } catch {
    // Ignore window assignment error
  }

  return polyfill;
}

if (typeof window !== "undefined") {
  ensureWebMcpModelContext();
}
