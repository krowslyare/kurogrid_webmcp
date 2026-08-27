import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  userId: string;
  email: string | null;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    role: "owner" | "member";
  }>;
};

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return null;
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("organization_memberships")
    .select(
      "organization_id, role, organizations!inner(id, name, slug)",
    )
    .eq("user_id", claimsData.claims.sub)
    .order("created_at", { ascending: true });

  if (membershipsError) {
    throw new Error("Unable to resolve organization memberships.", {
      cause: membershipsError,
    });
  }

  return {
    userId: claimsData.claims.sub,
    email:
      typeof claimsData.claims.email === "string"
        ? claimsData.claims.email
        : null,
    memberships: memberships.map((membership) => ({
      organizationId: membership.organizations.id,
      organizationName: membership.organizations.name,
      organizationSlug: membership.organizations.slug,
      role: membership.role,
    })),
  };
}
