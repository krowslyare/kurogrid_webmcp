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
    options: { signal: AbortSignal },
  ) => Promise<unknown>;
};

interface WebMcpModelContext extends EventTarget {
  registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ): Promise<void>;
}

interface Document {
  readonly modelContext?: WebMcpModelContext;
}
