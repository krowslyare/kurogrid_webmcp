import { NextResponse } from "next/server";

import { executeWebMcpTool } from "@/features/webmcp/server/execute-tool";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");

  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "same_origin_required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const result = await executeWebMcpTool(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "tool_execution_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
