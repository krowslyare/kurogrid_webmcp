/**
 * Browser-safe serialization utilities for WebMCP client agents.
 * Strips circular references, Window, Document, and DOM objects so
 * tool definitions and inputs can be sent cleanly over HTTP.
 */

export type CleanWebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
};

export function sanitizeToolForInference(tool: unknown): CleanWebMcpTool | null {
  if (!tool || typeof tool !== "object") return null;
  const t = tool as Record<string, unknown>;
  const name = typeof t.name === "string" ? t.name : "";
  if (!name) return null;
  const description = typeof t.description === "string" ? t.description : "";
  const title = typeof t.title === "string" ? t.title : undefined;

  let cleanSchema: Record<string, unknown> | undefined = undefined;
  if (t.inputSchema && typeof t.inputSchema === "object") {
    try {
      const rawSchema = t.inputSchema as Record<string, unknown>;
      const properties: Record<string, unknown> = {};
      if (rawSchema.properties && typeof rawSchema.properties === "object") {
        for (const [propKey, propVal] of Object.entries(rawSchema.properties as Record<string, unknown>)) {
          if (propVal && typeof propVal === "object") {
            const pv = propVal as Record<string, unknown>;
            properties[propKey] = {
              type: typeof pv.type === "string" ? pv.type : "string",
              description: typeof pv.description === "string" ? pv.description : "",
            };
          }
        }
      }
      cleanSchema = {
        type: typeof rawSchema.type === "string" ? rawSchema.type : "object",
        properties,
        required: Array.isArray(rawSchema.required)
          ? rawSchema.required.filter((r): r is string => typeof r === "string")
          : [],
      };
    } catch {
      cleanSchema = { type: "object", properties: {} };
    }
  }

  return { name, title, description, inputSchema: cleanSchema };
}

export function safeJsonStringify(obj: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (value !== null && typeof value === "object") {
      if (
        typeof window !== "undefined" &&
        (value === window ||
          value.constructor?.name === "Window" ||
          value === document ||
          value.constructor?.name === "HTMLDocument" ||
          (typeof Node !== "undefined" && value instanceof Node))
      ) {
        return undefined;
      }
      if (seen.has(value)) {
        return undefined;
      }
      seen.add(value);
    }
    return value;
  });
}
