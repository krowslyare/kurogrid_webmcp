import { NextResponse } from "next/server";

import { getViewer } from "@/features/auth/server/get-viewer";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationSlug = url.searchParams.get("organizationSlug");

  if (!organizationSlug) {
    return NextResponse.json({ error: "missing_organization_slug" }, { status: 400 });
  }

  const viewer = await getViewer();
  const membership = viewer?.memberships.find((m) => m.organizationSlug === organizationSlug);

  if (!membership) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointment_requests")
    .select("id, status, pet_name, proposed_starts_at")
    .eq("organization_id", membership.organizationId)
    .neq("status", "prepared")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  return NextResponse.json({ appointments: data ?? [] });
}
