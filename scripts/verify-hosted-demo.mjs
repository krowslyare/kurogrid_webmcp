import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const demoPassword = process.env.DEMO_USER_PASSWORD;

assert.ok(apiUrl, "NEXT_PUBLIC_SUPABASE_URL is required");
assert.ok(publishableKey, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");
assert.ok(secretKey, "SUPABASE_SECRET_KEY is required");
assert.ok(demoPassword, "DEMO_USER_PASSWORD is required");

function client(key) {
  return createClient(apiUrl, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function expectNoError(error, context) {
  assert.equal(error, null, `${context}: ${error?.message ?? "unknown error"}`);
}

function leaseHash() {
  return createHash("sha256").update(randomBytes(32)).digest("hex");
}

async function signIn(email) {
  const userClient = client(publishableKey);
  const signedIn = await userClient.auth.signInWithPassword({
    email,
    password: demoPassword,
  });
  expectNoError(signedIn.error, `sign in ${email}`);

  const claims = await userClient.auth.getClaims();
  expectNoError(claims.error, `read claims for ${email}`);
  assert.equal(typeof claims.data.claims.session_id, "string");

  return {
    client: userClient,
    sessionId: claims.data.claims.session_id,
    userId: signedIn.data.user.id,
  };
}

const admin = client(secretKey);
const hashes = Array.from({ length: 4 }, leaseHash);

try {
  const config = await admin
    .from("demo_runtime_config")
    .select("capacity")
    .eq("singleton", true)
    .single();
  expectNoError(config.error, "read demo capacity");
  assert.equal(
    config.data.capacity,
    2,
    "hosted demo capacity must be frozen at 2",
  );

  const activeBefore = await admin
    .from("demo_leases")
    .select("id", { count: "exact", head: true })
    .is("released_at", null)
    .gt("expires_at", new Date().toISOString());
  expectNoError(activeBefore.error, "count active leases before verification");
  assert.equal(
    activeBefore.count,
    0,
    "hosted verification requires an idle demo pool",
  );

  const claims = await Promise.all(
    hashes.slice(0, 2).map((hash) =>
      admin.rpc("claim_demo_sandbox", {
        p_lease_token_hash: hash,
        p_requested_role: "owner",
      }),
    ),
  );
  claims.forEach((claim, index) => {
    expectNoError(claim.error, `claim concurrent slot ${index + 1}`);
  });

  const slots = claims
    .map((claim, index) => ({
      hash: hashes[index],
      ...claim.data[0],
    }))
    .sort((left, right) => left.slot_number - right.slot_number);

  assert.deepEqual(
    slots.map((slot) => slot.slot_number),
    [1, 2],
  );
  assert.notEqual(slots[0].organization_slug, slots[1].organization_slug);

  const sessions = await Promise.all(
    slots.map((slot) => signIn(slot.user_email)),
  );
  for (let index = 0; index < slots.length; index += 1) {
    const bound = await admin.rpc("bind_demo_sandbox_session", {
      p_lease_token_hash: slots[index].hash,
      p_auth_session_id: sessions[index].sessionId,
      p_user_id: sessions[index].userId,
    });
    expectNoError(bound.error, `bind slot ${slots[index].slot_number}`);
    assert.equal(bound.data, true);
  }

  const organizations = await Promise.all(
    sessions.map(({ client: userClient }) =>
      userClient.from("organizations").select("id, slug"),
    ),
  );
  organizations.forEach((result, index) => {
    expectNoError(result.error, `read organization for slot ${index + 1}`);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].slug, slots[index].organization_slug);
  });

  const crossTenantRead = await sessions[0].client
    .from("organizations")
    .select("id")
    .eq("id", organizations[1].data[0].id);
  expectNoError(crossTenantRead.error, "cross-tenant Data API read");
  assert.deepEqual(crossTenantRead.data, []);

  const exhausted = await admin.rpc("claim_demo_sandbox", {
    p_lease_token_hash: hashes[2],
    p_requested_role: "owner",
  });
  assert.equal(exhausted.data, null);
  assert.equal(exhausted.error?.message, "demo_capacity_exhausted");

  const expired = await admin
    .from("demo_leases")
    .update({
      leased_at: new Date(Date.now() - 120_000).toISOString(),
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })
    .eq("lease_token_hash", slots[1].hash);
  expectNoError(expired.error, "expire slot 2 lease");

  const expiredRead = await sessions[1].client
    .from("organizations")
    .select("id")
    .eq("id", organizations[1].data[0].id);
  expectNoError(expiredRead.error, "read after lease expiry");
  assert.deepEqual(expiredRead.data, []);

  const released = await admin.rpc("release_demo_sandbox", {
    p_lease_token_hash: slots[0].hash,
  });
  expectNoError(released.error, "release slot 1");
  assert.equal(released.data, true);

  const releasedRead = await sessions[0].client
    .from("organizations")
    .select("id")
    .eq("id", organizations[0].data[0].id);
  expectNoError(releasedRead.error, "read after lease release");
  assert.deepEqual(releasedRead.data, []);

  const reused = await admin.rpc("claim_demo_sandbox", {
    p_lease_token_hash: hashes[3],
    p_requested_role: "member",
  });
  expectNoError(reused.error, "reuse released slot");
  assert.equal(reused.data[0].slot_number, 1);

  const memberSession = await signIn(reused.data[0].user_email);
  const memberBound = await admin.rpc("bind_demo_sandbox_session", {
    p_lease_token_hash: hashes[3],
    p_auth_session_id: memberSession.sessionId,
    p_user_id: memberSession.userId,
  });
  expectNoError(memberBound.error, "bind reused member slot");
  assert.equal(memberBound.data, true);

  const cleanAttention = await memberSession.client
    .from("attention_items")
    .select("id", { count: "exact", head: true });
  expectNoError(cleanAttention.error, "count clean attention fixtures");
  assert.equal(cleanAttention.count, 3);

  const cleanDrafts = await memberSession.client
    .from("site_drafts")
    .select("id", { count: "exact", head: true });
  expectNoError(cleanDrafts.error, "count clean drafts");
  assert.equal(cleanDrafts.count, 0);

  const finalRelease = await admin.rpc("release_demo_sandbox", {
    p_lease_token_hash: hashes[3],
  });
  expectNoError(finalRelease.error, "release reused member slot");
  assert.equal(finalRelease.data, true);

  await Promise.all([
    ...sessions.map(({ client: userClient }) => userClient.auth.signOut()),
    memberSession.client.auth.signOut(),
  ]);

  const activeAfter = await admin
    .from("demo_leases")
    .select("id", { count: "exact", head: true })
    .is("released_at", null)
    .gt("expires_at", new Date().toISOString());
  expectNoError(activeAfter.error, "count active leases after verification");
  assert.equal(activeAfter.count, 0);
} finally {
  await Promise.allSettled(
    hashes.map((hash) =>
      admin.rpc("release_demo_sandbox", { p_lease_token_hash: hash }),
    ),
  );
}

process.stdout.write(
  "Hosted demo verified: 2 isolated leases, exhaustion, expiry, release, clean reuse, and zero active leases.\n",
);
