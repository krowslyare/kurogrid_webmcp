import "server-only";

import { createHash } from "node:crypto";

import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

export const DEMO_LEASE_COOKIE = "kurogrid_demo_lease";

export function hashDemoLeaseToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function releaseCurrentDemoLease() {
  const cookieStore = await cookies();
  const leaseToken = cookieStore.get(DEMO_LEASE_COOKIE)?.value;

  if (!leaseToken) {
    return;
  }

  if (process.env.SUPABASE_SECRET_KEY) {
    const admin = createAdminClient();
    await admin.rpc("release_demo_sandbox", {
      p_lease_token_hash: hashDemoLeaseToken(leaseToken),
    });
  }

  cookieStore.delete(DEMO_LEASE_COOKIE);
}
