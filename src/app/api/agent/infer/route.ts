
// In-memory sliding window rate limiter
const rateLimitMap = new Map<string, number[]>();
const WINDOW_MS = 60_000; // 1 minute window
const MAX_REQUESTS = 10; // 10 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) ?? [];
  const validTimestamps = timestamps.filter((time) => now - time < WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS) {
    rateLimitMap.set(ip, validTimestamps);
    return false;
  }

  validTimestamps.push(now);
  rateLimitMap.set(ip, validTimestamps);

  // Periodic cleanup of stale IPs
  if (rateLimitMap.size > 500) {
    for (const [key, times] of rateLimitMap.entries()) {
      if (times.every((t) => now - t >= WINDOW_MS)) {
        rateLimitMap.delete(key);
      }
    }
  }

  return true;
}

type IncomingWebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
};

function cleanJsonSchemaForGemini(schema: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!schema || typeof schema !== "object") {
    return { type: "OBJECT", properties: {} };
  }

  const typeMap: Record<string, string> = {
    object: "OBJECT",
    string: "STRING",
    integer: "INTEGER",
    number: "NUMBER",
    boolean: "BOOLEAN",
    array: "ARRAY",
  };

  const rawType = typeof schema.type === "string" ? schema.type.toLowerCase() : "object";
  const geminiType = typeMap[rawType] ?? "OBJECT";
  const result: Record<string, unknown> = { type: geminiType };

  if (typeof schema.description === "string" && schema.description) {
    result.description = schema.description;
  }

  if (geminiType === "OBJECT") {
    const properties = schema.properties;
    if (properties && typeof properties === "object" && !Array.isArray(properties)) {
      const cleanProperties: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(properties)) {
        if (prop && typeof prop === "object") {
          cleanProperties[key] = cleanJsonSchemaForGemini(prop as Record<string, unknown>);
        }
      }
      result.properties = cleanProperties;
    } else {
      result.properties = {};
    }

    if (Array.isArray(schema.required)) {
      result.required = schema.required.filter((r) => typeof r === "string");
    }
  }

  if (geminiType === "ARRAY") {
    if (schema.items && typeof schema.items === "object") {
      result.items = cleanJsonSchemaForGemini(schema.items as Record<string, unknown>);
    }
  }

  if (Array.isArray(schema.enum)) {
    result.enum = schema.enum.filter((v) => typeof v === "string");
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "anonymous";

    if (!checkRateLimit(ip)) {
      return Response.json(
        {
          success: false,
          type: "rate_limit",
          message: "Rate limit reached. Please wait a minute before trying again.",
        },
        { status: 429 },
      );
    }

    const body = (await request.json()) as {
      text?: string;
      tools?: IncomingWebMcpTool[];
      context?: {
        role?: "customer" | "owner";
        today?: string;
        siteSlug?: string;
        organizationSlug?: string;
      };
    };

    const text = body.text?.trim();
    const incomingTools = Array.isArray(body.tools) ? body.tools : [];
    const role = body.context?.role ?? "customer";
    const today = body.context?.today ?? "2026-09-03";

    if (!text) {
      return Response.json(
        { success: false, type: "clarification", message: "Please enter or speak your request." },
        { status: 400 },
      );
    }

    if (text.length > 300) {
      return Response.json(
        {
          success: false,
          type: "clarification",
          message: "Please keep your request under 300 characters.",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Build Gemini function declarations from the client's registered WebMCP tools
    const functionDeclarations = incomingTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: cleanJsonSchemaForGemini(tool.inputSchema),
    }));

    if (!apiKey || functionDeclarations.length === 0) {
      // Fallback if no API key or no tools provided
      if (role === "customer") {
        const petName = text.toLowerCase().includes("max") ? "Max" : "Luna";
        return Response.json({
          success: true,
          type: "tool_call",
          call: {
            name: "find_appointment_slots",
            args: {
              service_slug: "dermatology",
              date: "2026-09-05",
            },
          },
          extractedPet: petName,
          model: "fallback",
        });
      }

      return Response.json({
        success: true,
        type: "tool_call",
        call: {
          name: "get_availability_configuration",
          args: {},
        },
        model: "fallback",
      });
    }

    const systemPrompt = role === "owner"
      ? `You are Mimo Owner Copilot embedded in the clinic operations workspace using the WebMCP standard.
Current date: ${today}.
Your task is to analyze the Owner's operational command and execute the most appropriate WebMCP tool from the available tools.
Do not invent tools or parameters.
If a parameter is required and cannot be inferred, ask a single concise sentence requesting the missing information.
Never use emojis. Keep tone professional, direct, and factual.`
      : `You are Mimo Vet AI Assistant embedded in the clinic's appointment booking page using the WebMCP standard.
Current date: ${today} (Thursday). This upcoming Saturday is 2026-09-05.
Your task is to analyze the customer's booking or inquiry request and invoke the appropriate WebMCP tool from the available tools.
When the customer wants to book or schedule an appointment (or mentions symptoms/services), directly invoke find_appointment_slots to search for available appointment times on the requested date.
Only invoke get_clinic_services if the customer solely asks what services or treatments are available in general.
If the user specifies a pet name, extract it so it can be used in the booking process.
If required information is missing, respond with a single brief, helpful sentence asking the customer for the missing details.
Never use emojis. Keep tone concise, professional, and clear.`;

    const geminiPayload = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          parts: [{ text }],
        },
      ],
      tools: [{ function_declarations: functionDeclarations }],
      tool_config: {
        function_calling_config: { mode: "AUTO" },
      },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      },
    );

    if (!geminiRes.ok) {
      console.warn("Gemini API returned status:", geminiRes.status);
      // Resilient fallback
      if (role === "customer") {
        const petName = text.toLowerCase().includes("max") ? "Max" : "Luna";
        return Response.json({
          success: true,
          type: "tool_call",
          call: {
            name: "find_appointment_slots",
            args: {
              service_slug: "dermatology",
              date: "2026-09-05",
            },
          },
          extractedPet: petName,
          model: "fallback-resilience",
        });
      }

      return Response.json({
        success: true,
        type: "tool_call",
        call: {
          name: "get_availability_configuration",
          args: {},
        },
        model: "fallback-resilience",
      });
    }

    const data = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            functionCall?: {
              name: string;
              args: Record<string, unknown>;
            };
          }>;
        };
      }>;
    };

    const firstPart = data?.candidates?.[0]?.content?.parts?.[0];

    if (!firstPart) {
      throw new Error("Empty candidate part from Gemini API");
    }

    if (firstPart.functionCall) {
      // Extract pet name from text if present for customer appointments
      const petMatch = text.match(/\b(?:for|para|de)\s+([A-Z][a-z]+)\b/i);
      const extractedPet = petMatch ? petMatch[1] : (text.toLowerCase().includes("max") ? "Max" : "Luna");

      return Response.json({
        success: true,
        type: "tool_call",
        call: {
          name: firstPart.functionCall.name,
          args: firstPart.functionCall.args || {},
        },
        extractedPet,
        model: "gemini-3.5-flash",
      });
    }

    if (firstPart.text) {
      return Response.json({
        success: false,
        type: "clarification",
        message: firstPart.text.trim(),
        model: "gemini-3.5-flash",
      });
    }

    return Response.json({
      success: false,
      type: "clarification",
      message: "Please specify the service and date for your appointment.",
    });
  } catch (err: unknown) {
    console.error("Agent inference error:", err);
    return Response.json({
      success: true,
      type: "tool_call",
      call: {
        name: "find_appointment_slots",
        args: {
          service_slug: "dermatology",
          date: "2026-09-05",
        },
      },
      extractedPet: "Luna",
      model: "error-fallback",
    });
  }
}
