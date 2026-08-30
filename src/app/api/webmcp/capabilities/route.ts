import { NextResponse } from "next/server";

import {
  resolveAuthenticatedCapabilities,
  resolvePublicCapabilities,
} from "@/features/webmcp/server/resolve-capabilities";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationSlug = url.searchParams.get("organizationSlug");
  const siteSlug = url.searchParams.get("siteSlug");
  const appointmentId = url.searchParams.get("appointmentId") ?? undefined;
  const accessToken = url.searchParams.get("accessToken") ?? undefined;
  const confirmationToken = url.searchParams.get("confirmationToken") ?? undefined;

  if (organizationSlug) {
    const capabilities = await resolveAuthenticatedCapabilities(organizationSlug);

    if (!capabilities) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      definitions: capabilities.definitions,
      signature: capabilities.signature,
    });
  }

  if (siteSlug) {
    const capabilities = await resolvePublicCapabilities(
      siteSlug,
      appointmentId,
      accessToken,
      confirmationToken,
    );
    return NextResponse.json({
      definitions: capabilities.definitions,
      signature: capabilities.signature,
    });
  }

  return NextResponse.json({ error: "context_required" }, { status: 400 });
}
