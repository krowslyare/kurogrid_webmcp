type WebMcpJsonSchema = Record<string, unknown>;

type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: WebMcpJsonSchema;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>;
};

interface WebMcpModelContext extends EventTarget {
  registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ): Promise<void>;
  /** Present only on the Kurogrid in-page demo shim; absent on native hosts. */
  readonly __kurogridWebMcpShim?: boolean;
}

interface Document {
  readonly modelContext?: WebMcpModelContext;
}

interface Navigator {
  readonly modelContext?: WebMcpModelContext;
}

interface Window {
  readonly modelContext?: WebMcpModelContext;
}
