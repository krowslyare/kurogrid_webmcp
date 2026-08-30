"use server";

import { randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import {
  DEMO_LEASE_COOKIE,
  hashDemoLeaseToken,
  releaseCurrentDemoLease,
} from "./lease";

function accessCodeMatches(candidate: string) {
  const expected = process.env.DEMO_ACCESS_CODE;

  if (!expected || Buffer.byteLength(expected) < 24) return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length
    && timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

export async function claimDemoSandbox(formData: FormData) {
  const accessCode = formData.get("accessCode");
  const journey = formData.get("journey") === "workspace" ? "workspace" : "customer";
  const requestedRole = journey === "workspace" && formData.get("role") === "member"
    ? "member"
    : "owner";
  const demoPassword = process.env.DEMO_USER_PASSWORD;

  if (typeof accessCode !== "string" || !accessCodeMatches(accessCode)) {
    redirect("/demo?error=access");
  }

  if (!demoPassword) {
    redirect("/demo?error=configuration");
  }

  await releaseCurrentDemoLease();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });

  const leaseToken = randomBytes(32).toString("hex");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_demo_sandbox", {
    p_lease_token_hash: hashDemoLeaseToken(leaseToken),
    p_requested_role: requestedRole,
  });
  const lease = data?.[0];

  if (error || !lease) {
    redirect(`/demo?error=${error?.message === "demo_capacity_exhausted" ? "capacity" : "claim"}`);
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: lease.user_email,
    password: demoPassword,
  });

  if (signInError || !signInData.session) {
    await admin.rpc("release_demo_sandbox", {
      p_lease_token_hash: hashDemoLeaseToken(leaseToken),
    });
    redirect("/demo?error=signin");
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
    signInData.session.access_token,
  );
  const sessionId = claimsData?.claims?.session_id;

  if (claimsError || typeof sessionId !== "string") {
    await admin.rpc("release_demo_sandbox", {
      p_lease_token_hash: hashDemoLeaseToken(leaseToken),
    });
    await supabase.auth.signOut({ scope: "local" });
    redirect("/demo?error=signin");
  }

  const { data: bound, error: bindError } = await admin.rpc(
    "bind_demo_sandbox_session",
    {
      p_lease_token_hash: hashDemoLeaseToken(leaseToken),
      p_auth_session_id: sessionId,
      p_user_id: signInData.user.id,
    },
  );

  if (bindError || !bound) {
    await admin.rpc("release_demo_sandbox", {
      p_lease_token_hash: hashDemoLeaseToken(leaseToken),
    });
    await supabase.auth.signOut({ scope: "local" });
    redirect("/demo?error=signin");
  }

  const cookieStore = await cookies();
  cookieStore.set(DEMO_LEASE_COOKIE, leaseToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(lease.expires_at),
    path: "/",
  });

  if (journey === "customer") {
    const siteSlug = lease.organization_slug.replace("arboleda-demo-", "arboleda-");
    redirect(`/sites/${siteSlug}`);
  }

  redirect(`/app/${lease.organization_slug}`);
}
