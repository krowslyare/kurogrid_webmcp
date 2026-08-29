import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { createClient } from "@supabase/supabase-js";

function localSupabaseEnvironment() {
  const output = execFileSync(
    "npx",
    ["supabase", "status", "-o", "env"],
    { encoding: "utf8" },
  );

  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => {
        const [, name, rawValue] = match;
        const value = rawValue.replace(/^"|"$/g, "");
        return [name, value];
      }),
  );
}

function supabaseClient(url, key) {
  return createClient(url, key, {
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

const environment = localSupabaseEnvironment();
const apiUrl = environment.API_URL;
const publishableKey = environment.PUBLISHABLE_KEY;
const secretKey = environment.SECRET_KEY;

assert.ok(apiUrl, "Supabase local API_URL is unavailable");
assert.ok(publishableKey, "Supabase local PUBLISHABLE_KEY is unavailable");
assert.ok(secretKey, "Supabase local SECRET_KEY is unavailable");

const runId = randomUUID();
const password = `Local-only-${runId}`;
const ids = {
  ownerA: randomUUID(),
  memberA: randomUUID(),
  ownerB: randomUUID(),
  outsider: randomUUID(),
  organizationA: randomUUID(),
  organizationB: randomUUID(),
  attentionA: randomUUID(),
  attentionB: randomUUID(),
  siteA: randomUUID(),
  siteB: randomUUID(),
  sandboxA: randomUUID(),
  sandboxB: randomUUID(),
};
const emails = {
  ownerA: `owner-a-${runId}@example.test`,
  memberA: `member-a-${runId}@example.test`,
  ownerB: `owner-b-${runId}@example.test`,
  outsider: `outsider-${runId}@example.test`,
};

const siteContent = {
  headline: "Care that stays open when demand shifts",
  summary: "A synthetic veterinary demo with published business hours.",
  opening_hours: { weekdays: "08:00–18:00", saturday: "09:00–14:00" },
  cta_label: "Book a visit",
};

const revisedSiteContent = {
  ...siteContent,
  headline: "Weekend care, now clearly published",
  opening_hours: { weekdays: "08:00–18:00", weekend: "09:00–14:00" },
};

const admin = supabaseClient(apiUrl, secretKey);
const anonymous = supabaseClient(apiUrl, publishableKey);
const clients = {
  ownerA: supabaseClient(apiUrl, publishableKey),
  memberA: supabaseClient(apiUrl, publishableKey),
  ownerB: supabaseClient(apiUrl, publishableKey),
  outsider: supabaseClient(apiUrl, publishableKey),
};

before(async () => {
  for (const [name, id] of Object.entries({
    ownerA: ids.ownerA,
    memberA: ids.memberA,
    ownerB: ids.ownerB,
    outsider: ids.outsider,
  })) {
    const { error } = await admin.auth.admin.createUser({
      id,
      email: emails[name],
      password,
      email_confirm: true,
    });
    expectNoError(error, `create ${name}`);
  }

  const { error: organizationsError } = await admin
    .from("organizations")
    .insert([
      {
        id: ids.organizationA,
        slug: `alpha-${runId}`,
        name: "Alpha Studio",
      },
      {
        id: ids.organizationB,
        slug: `bravo-${runId}`,
        name: "Bravo Works",
      },
    ]);
  expectNoError(organizationsError, "create organizations");

  const { error: sitesError } = await admin.from("sites").insert([
    {
      id: ids.siteA,
      organization_id: ids.organizationA,
      slug: `alpha-site-${runId}`,
    },
    {
      id: ids.siteB,
      organization_id: ids.organizationB,
      slug: `bravo-site-${runId}`,
    },
  ]);
  expectNoError(sitesError, "create sites");

  const { error: membershipsError } = await admin
    .from("organization_memberships")
    .insert([
      {
        organization_id: ids.organizationA,
        user_id: ids.ownerA,
        role: "owner",
      },
      {
        organization_id: ids.organizationA,
        user_id: ids.memberA,
        role: "member",
      },
      {
        organization_id: ids.organizationB,
        user_id: ids.ownerB,
        role: "owner",
      },
    ]);
  expectNoError(membershipsError, "create memberships");

  const { error: auditError } = await admin.from("audit_events").insert([
    {
      organization_id: ids.organizationA,
      actor_user_id: ids.ownerA,
      action: "organization.created",
      target_type: "organization",
    },
    {
      organization_id: ids.organizationB,
      actor_user_id: ids.ownerB,
      action: "organization.created",
      target_type: "organization",
    },
  ]);
  expectNoError(auditError, "create audit events");

  const { error: attentionError } = await admin.from("attention_items").insert([
    {
      id: ids.attentionA,
      organization_id: ids.organizationA,
      kind: "synthetic_lead",
      title: "Weekend demand is going unanswered",
      summary: "A synthetic inquiry arrived outside the published hours.",
      evidence: { source: "fixture", metric: "weekend_inquiry" },
    },
    {
      id: ids.attentionB,
      organization_id: ids.organizationB,
      kind: "synthetic_lead",
      title: "A different tenant signal",
      summary: "This evidence must remain isolated from organization A.",
      evidence: { source: "fixture", metric: "isolated_signal" },
    },
  ]);
  expectNoError(attentionError, "create attention fixtures");

  for (const [name, client] of Object.entries(clients)) {
    const { error } = await client.auth.signInWithPassword({
      email: emails[name],
      password,
    });
    expectNoError(error, `sign in ${name}`);
  }
});

after(async () => {
  await admin.from("organizations").delete().in("id", [
    ids.organizationA,
    ids.organizationB,
  ]);

  for (const id of [ids.ownerA, ids.memberA, ids.ownerB, ids.outsider]) {
    await admin.auth.admin.deleteUser(id);
  }
});

test("anonymous requests hold no Data API table grant", async () => {
  const { data, error } = await anonymous.from("organizations").select("id");

  assert.equal(data, null);
  assert.equal(error?.code, "42501");
});

test("public account registration is disabled", async () => {
  const { data, error } = await anonymous.auth.signUp({
    email: `uninvited-${runId}@example.test`,
    password,
  });

  assert.equal(data.user, null);
  assert.equal(data.session, null);
  assert.match(error?.message ?? "", /signups? not allowed/i);
});

test("owner A sees only organization A", async () => {
  const { data, error } = await clients.ownerA
    .from("organizations")
    .select("id, slug");

  expectNoError(error, "owner A organizations");
  assert.deepEqual(data, [
    { id: ids.organizationA, slug: `alpha-${runId}` },
  ]);
});

test("a valid JWT from A cannot target organization B", async () => {
  const { data, error } = await clients.ownerA
    .from("organizations")
    .select("id")
    .eq("id", ids.organizationB);

  expectNoError(error, "owner A cross-tenant read");
  assert.deepEqual(data, []);
});

test("member A sees organization membership but no audit events", async () => {
  const memberships = await clients.memberA
    .from("organization_memberships")
    .select("organization_id, role")
    .order("role");
  const auditEvents = await clients.memberA.from("audit_events").select("id");

  expectNoError(memberships.error, "member A memberships");
  expectNoError(auditEvents.error, "member A audit events");
  assert.deepEqual(memberships.data, [
    {
      organization_id: ids.organizationA,
      role: "member",
    },
  ]);
  assert.ok(
    memberships.data.every(
      (membership) => membership.organization_id === ids.organizationA,
    ),
  );
  assert.deepEqual(auditEvents.data, []);
});

test("owner B sees only organization B and its audit stream", async () => {
  const organizations = await clients.ownerB
    .from("organizations")
    .select("id");
  const auditEvents = await clients.ownerB
    .from("audit_events")
    .select("organization_id");

  expectNoError(organizations.error, "owner B organizations");
  expectNoError(auditEvents.error, "owner B audit events");
  assert.deepEqual(organizations.data, [{ id: ids.organizationB }]);
  assert.deepEqual(auditEvents.data, [
    { organization_id: ids.organizationB },
  ]);
});

test("an authenticated outsider sees no tenant rows", async () => {
  const organizations = await clients.outsider
    .from("organizations")
    .select("id");
  const memberships = await clients.outsider
    .from("organization_memberships")
    .select("organization_id");
  const auditEvents = await clients.outsider.from("audit_events").select("id");

  expectNoError(organizations.error, "outsider organizations");
  expectNoError(memberships.error, "outsider memberships");
  expectNoError(auditEvents.error, "outsider audit events");
  assert.deepEqual(organizations.data, []);
  assert.deepEqual(memberships.data, []);
  assert.deepEqual(auditEvents.data, []);
});

test("authenticated clients cannot create organizations directly", async () => {
  const { error } = await clients.ownerA.from("organizations").insert({
    slug: `forbidden-${runId}`,
    name: "Forbidden",
  });

  assert.equal(error?.code, "42501");
});

test("members see only their tenant evidence", async () => {
  const { data, error } = await clients.memberA
    .from("attention_items")
    .select("id, organization_id");

  expectNoError(error, "member A attention");
  assert.deepEqual(data, [
    { id: ids.attentionA, organization_id: ids.organizationA },
  ]);
});

test("action plan creation is atomic, fixed, and idempotent", async () => {
  const idempotencyKey = randomUUID();
  const first = await clients.memberA.rpc("create_action_plan", {
    p_attention_item_id: ids.attentionA,
    p_idempotency_key: idempotencyKey,
  });
  const second = await clients.memberA.rpc("create_action_plan", {
    p_attention_item_id: ids.attentionA,
    p_idempotency_key: idempotencyKey,
  });

  expectNoError(first.error, "create action plan");
  expectNoError(second.error, "retry action plan");
  assert.equal(second.data, first.data);

  const { data: steps, error } = await clients.memberA
    .from("action_plan_steps")
    .select("position, kind")
    .eq("action_plan_id", first.data)
    .order("position");

  expectNoError(error, "read action plan steps");
  assert.deepEqual(steps, [
    { position: 1, kind: "acknowledge_attention" },
    { position: 2, kind: "draft_site_update" },
    { position: 3, kind: "review_publication" },
  ]);
});

test("a valid JWT cannot create a plan for another tenant", async () => {
  const { data, error } = await clients.ownerA.rpc("create_action_plan", {
    p_attention_item_id: ids.attentionB,
    p_idempotency_key: randomUUID(),
  });

  assert.equal(data, null);
  assert.equal(error?.code, "42501");
});

test("privileged writes cannot mismatch a plan and attention tenant", async () => {
  const { error } = await admin.from("action_plans").insert({
    organization_id: ids.organizationA,
    attention_item_id: ids.attentionB,
    created_by: ids.ownerA,
    idempotency_key: randomUUID(),
  });

  assert.equal(error?.code, "23503");
});

test("lead acknowledgement records intent without communication", async () => {
  const first = await clients.memberA.rpc("acknowledge_lead_attention", {
    p_attention_item_id: ids.attentionA,
    p_expected_revision: 1,
  });
  const retry = await clients.memberA.rpc("acknowledge_lead_attention", {
    p_attention_item_id: ids.attentionA,
    p_expected_revision: 1,
  });

  expectNoError(first.error, "acknowledge attention");
  expectNoError(retry.error, "retry acknowledgement");
  assert.equal(first.data, 2);
  assert.equal(retry.data, 2);

  const { data, error } = await clients.memberA
    .from("attention_items")
    .select("status, revision, evidence")
    .eq("id", ids.attentionA)
    .single();

  expectNoError(error, "read acknowledged attention");
  assert.equal(data.status, "acknowledged");
  assert.equal(data.revision, 2);
  assert.deepEqual(data.evidence, {
    source: "fixture",
    metric: "weekend_inquiry",
  });
});

test("site content rejects non-renderable opening hours", async () => {
  const { data, error } = await clients.ownerB.rpc("create_or_patch_site_draft", {
    p_site_id: ids.siteB,
    p_expected_revision: 0,
    p_content: {
      ...siteContent,
      opening_hours: { weekdays: { start: "08:00", end: "18:00" } },
    },
  });

  assert.equal(data, null);
  assert.equal(error?.code, "22023");
});

test("privileged writes cannot mismatch a draft and site tenant", async () => {
  const { error } = await admin.from("site_drafts").insert({
    organization_id: ids.organizationA,
    site_id: ids.siteB,
    content: siteContent,
    updated_by: ids.ownerA,
  });

  assert.equal(error?.code, "23503");
});

test("draft publication is exact, owner-only, idempotent, public, and reversible", async () => {
  const draftResult = await clients.memberA.rpc("create_or_patch_site_draft", {
    p_site_id: ids.siteA,
    p_expected_revision: 0,
    p_content: siteContent,
  });
  expectNoError(draftResult.error, "member creates draft");
  assert.equal(draftResult.data.revision, 1);

  const crossTenant = await clients.ownerA.rpc("create_or_patch_site_draft", {
    p_site_id: ids.siteB,
    p_expected_revision: 0,
    p_content: siteContent,
  });
  assert.equal(crossTenant.data, null);
  assert.equal(crossTenant.error?.code, "42501");

  const preview = await clients.memberA.rpc("preview_publish_consequences", {
    p_draft_id: draftResult.data.id,
  });
  expectNoError(preview.error, "member previews consequences");
  assert.equal(preview.data.draft_revision, 1);
  assert.deepEqual(preview.data.agent_surface.published_tools, [
    "get_opening_hours",
  ]);

  const memberApproval = await clients.memberA.rpc("approve_site_draft", {
    p_draft_id: draftResult.data.id,
    p_expected_revision: 1,
    p_consequence_hash: preview.data.consequence_hash,
  });
  assert.equal(memberApproval.data, null);
  assert.equal(memberApproval.error?.code, "42501");

  const approval = await clients.ownerA.rpc("approve_site_draft", {
    p_draft_id: draftResult.data.id,
    p_expected_revision: 1,
    p_consequence_hash: preview.data.consequence_hash,
  });
  expectNoError(approval.error, "owner approves exact preview");

  const publishKeys = [randomUUID(), randomUUID()];
  const ownerSession = await clients.ownerA.auth.getSession();
  expectNoError(ownerSession.error, "read owner session for concurrent publish");
  assert.ok(ownerSession.data.session?.access_token);
  const memberSession = await clients.memberA.auth.getSession();
  expectNoError(memberSession.error, "read member session for revision conflict");
  assert.ok(memberSession.data.session?.access_token);
  const publishClients = publishKeys.map(() => createClient(
    apiUrl,
    publishableKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${ownerSession.data.session.access_token}`,
        },
      },
    },
  ));
  const publishAttempts = await Promise.all(
    publishKeys.map((idempotencyKey, index) =>
      publishClients[index].rpc("publish_site_draft", {
        p_draft_id: draftResult.data.id,
        p_expected_revision: 1,
        p_approval_id: approval.data,
        p_consequence_hash: preview.data.consequence_hash,
        p_idempotency_key: idempotencyKey,
      }),
    ),
  );
  const successfulPublishIndexes = publishAttempts
    .map((attempt, index) => (attempt.error ? null : index))
    .filter((index) => index !== null);
  const failedPublishAttempts = publishAttempts.filter(
    (attempt) => attempt.error,
  );

  assert.equal(successfulPublishIndexes.length, 1);
  assert.equal(failedPublishAttempts.length, 1);
  assert.equal(failedPublishAttempts[0].error?.code, "22023");

  const successfulPublishIndex = successfulPublishIndexes[0];
  const publishKey = publishKeys[successfulPublishIndex];
  const published = publishAttempts[successfulPublishIndex];
  const publishRetry = await clients.ownerA.rpc("publish_site_draft", {
    p_draft_id: draftResult.data.id,
    p_expected_revision: 1,
    p_approval_id: approval.data,
    p_consequence_hash: preview.data.consequence_hash,
    p_idempotency_key: publishKey,
  });
  expectNoError(publishRetry.error, "retry publish");
  assert.equal(publishRetry.data, published.data);

  const reusedPublishKey = await clients.ownerA.rpc("publish_site_draft", {
    p_draft_id: draftResult.data.id,
    p_expected_revision: 1,
    p_approval_id: approval.data,
    p_consequence_hash: "0".repeat(64),
    p_idempotency_key: publishKey,
  });
  assert.equal(reusedPublishKey.data, null);
  assert.equal(reusedPublishKey.error?.code, "22023");

  const crossSitePointer = await admin
    .from("sites")
    .update({ published_version_id: published.data })
    .eq("id", ids.siteB);
  assert.equal(crossSitePointer.error?.code, "23503");

  const publicVersion = await anonymous.rpc("get_published_site", {
    p_slug: `alpha-site-${runId}`,
  });
  expectNoError(publicVersion.error, "read public site");
  assert.equal(publicVersion.data[0].version_id, published.data);
  assert.deepEqual(publicVersion.data[0].content, siteContent);

  const stalePatchResponse = await fetch(
    `${apiUrl}/rest/v1/rpc/create_or_patch_site_draft`,
    {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${memberSession.data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_site_id: ids.siteA,
        p_expected_revision: 0,
        p_content: revisedSiteContent,
      }),
    },
  );
  const stalePatch = await stalePatchResponse.json();
  assert.equal(stalePatchResponse.ok, false);
  assert.equal(stalePatch.code, "PT409");

  const revisedDraft = await clients.memberA.rpc("create_or_patch_site_draft", {
    p_site_id: ids.siteA,
    p_expected_revision: 1,
    p_content: revisedSiteContent,
  });
  expectNoError(revisedDraft.error, "update draft at expected revision");

  const revisedPreview = await clients.ownerA.rpc("preview_publish_consequences", {
    p_draft_id: draftResult.data.id,
  });
  expectNoError(revisedPreview.error, "preview revised draft");
  const revisedApproval = await clients.ownerA.rpc("approve_site_draft", {
    p_draft_id: draftResult.data.id,
    p_expected_revision: 2,
    p_consequence_hash: revisedPreview.data.consequence_hash,
  });
  expectNoError(revisedApproval.error, "approve revised draft");
  const secondVersion = await clients.ownerA.rpc("publish_site_draft", {
    p_draft_id: draftResult.data.id,
    p_expected_revision: 2,
    p_approval_id: revisedApproval.data,
    p_consequence_hash: revisedPreview.data.consequence_hash,
    p_idempotency_key: randomUUID(),
  });
  expectNoError(secondVersion.error, "publish revised draft");

  const rollbackKey = randomUUID();
  const rollback = await clients.ownerA.rpc("rollback_site_version", {
    p_site_id: ids.siteA,
    p_target_version_id: published.data,
    p_idempotency_key: rollbackKey,
  });
  const rollbackRetry = await clients.ownerA.rpc("rollback_site_version", {
    p_site_id: ids.siteA,
    p_target_version_id: published.data,
    p_idempotency_key: rollbackKey,
  });
  expectNoError(rollback.error, "rollback to first version");
  expectNoError(rollbackRetry.error, "retry rollback");
  assert.equal(rollbackRetry.data, rollback.data);
  assert.notEqual(rollback.data, published.data);
  assert.notEqual(rollback.data, secondVersion.data);

  const reusedRollbackKey = await clients.ownerA.rpc("rollback_site_version", {
    p_site_id: ids.siteA,
    p_target_version_id: secondVersion.data,
    p_idempotency_key: rollbackKey,
  });
  assert.equal(reusedRollbackKey.data, null);
  assert.equal(reusedRollbackKey.error?.code, "22023");

  const redundantRollback = await clients.ownerA.rpc("rollback_site_version", {
    p_site_id: ids.siteA,
    p_target_version_id: rollback.data,
    p_idempotency_key: randomUUID(),
  });
  assert.equal(redundantRollback.data, null);
  assert.equal(redundantRollback.error?.code, "22023");

  const restoredPublicVersion = await anonymous.rpc("get_published_site", {
    p_slug: `alpha-site-${runId}`,
  });
  expectNoError(restoredPublicVersion.error, "read rolled back public site");
  assert.equal(restoredPublicVersion.data[0].version_id, rollback.data);
  assert.equal(restoredPublicVersion.data[0].version_number, 3);
  assert.deepEqual(restoredPublicVersion.data[0].content, siteContent);
});

test("demo pool isolates two leases, reports exhaustion, and resets on reuse", async () => {
  await admin.from("demo_leases").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("demo_sandboxes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { error: configError } = await admin
    .from("demo_runtime_config")
    .update({ capacity: 2 })
    .eq("singleton", true);
  expectNoError(configError, "configure demo capacity");
  const { error: sandboxMemberError } = await admin
    .from("organization_memberships")
    .insert({
      organization_id: ids.organizationB,
      user_id: ids.outsider,
      role: "member",
    });
  expectNoError(sandboxMemberError, "create sandbox B member");
  const { error: sandboxesError } = await admin.from("demo_sandboxes").insert([
    {
      id: ids.sandboxA,
      slot_number: 1,
      organization_id: ids.organizationA,
      owner_user_id: ids.ownerA,
      member_user_id: ids.memberA,
    },
    {
      id: ids.sandboxB,
      slot_number: 2,
      organization_id: ids.organizationB,
      owner_user_id: ids.ownerB,
      member_user_id: ids.outsider,
    },
  ]);
  expectNoError(sandboxesError, "create demo sandboxes");

  const hashes = ["a".repeat(64), "b".repeat(64), "c".repeat(64), "d".repeat(64)];
  const concurrentClaims = await Promise.all(
    hashes.slice(0, 2).map(async (leaseTokenHash) => ({
      leaseTokenHash,
      result: await admin.rpc("claim_demo_sandbox", {
        p_lease_token_hash: leaseTokenHash,
        p_requested_role: "owner",
      }),
    })),
  );
  concurrentClaims.forEach(({ result }, index) => {
    expectNoError(result.error, `claim concurrent demo slot ${index + 1}`);
  });
  concurrentClaims.sort(
    (left, right) =>
      left.result.data[0].slot_number - right.result.data[0].slot_number,
  );
  const [{ result: first, leaseTokenHash: firstHash }] = concurrentClaims;
  const { result: second, leaseTokenHash: secondHash } = concurrentClaims[1];

  assert.equal(first.data[0].slot_number, 1);
  assert.equal(second.data[0].slot_number, 2);
  assert.notEqual(first.data[0].organization_slug, second.data[0].organization_slug);

  const ownerAClaims = await clients.ownerA.auth.getClaims();
  const ownerBClaims = await clients.ownerB.auth.getClaims();
  expectNoError(ownerAClaims.error, "read owner A session claims");
  expectNoError(ownerBClaims.error, "read owner B session claims");
  const ownerASessionId = ownerAClaims.data.claims.session_id;
  const ownerBSessionId = ownerBClaims.data.claims.session_id;
  assert.equal(typeof ownerASessionId, "string");
  assert.equal(typeof ownerBSessionId, "string");

  const wrongUserBinding = await admin.rpc("bind_demo_sandbox_session", {
    p_lease_token_hash: firstHash,
    p_auth_session_id: ownerBSessionId,
    p_user_id: ids.ownerB,
  });
  expectNoError(wrongUserBinding.error, "reject wrong demo user binding");
  assert.equal(wrongUserBinding.data, false);

  const firstBound = await admin.rpc("bind_demo_sandbox_session", {
    p_lease_token_hash: firstHash,
    p_auth_session_id: ownerASessionId,
    p_user_id: ids.ownerA,
  });
  const secondBound = await admin.rpc("bind_demo_sandbox_session", {
    p_lease_token_hash: secondHash,
    p_auth_session_id: ownerBSessionId,
    p_user_id: ids.ownerB,
  });
  expectNoError(firstBound.error, "bind first demo session");
  expectNoError(secondBound.error, "bind second demo session");
  assert.equal(firstBound.data, true);
  assert.equal(secondBound.data, true);

  const activeOwnerRead = await clients.ownerA
    .from("organizations")
    .select("id")
    .eq("id", ids.organizationA);
  expectNoError(activeOwnerRead.error, "active lease owner read");
  assert.deepEqual(activeOwnerRead.data, [{ id: ids.organizationA }]);

  const exhausted = await admin.rpc("claim_demo_sandbox", {
    p_lease_token_hash: hashes[2],
    p_requested_role: "owner",
  });
  assert.equal(exhausted.data, null);
  assert.equal(exhausted.error?.message, "demo_capacity_exhausted");

  const anonymousClaim = await anonymous.rpc("claim_demo_sandbox", {
    p_lease_token_hash: "e".repeat(64),
    p_requested_role: "owner",
  });
  assert.equal(anonymousClaim.data, null);
  assert.equal(anonymousClaim.error?.code, "42501");

  const expiredLease = await admin
    .from("demo_leases")
    .update({
      leased_at: new Date(Date.now() - 120_000).toISOString(),
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })
    .eq("lease_token_hash", secondHash);
  expectNoError(expiredLease.error, "expire second demo lease");

  const expiredOwnerRead = await clients.ownerB
    .from("organizations")
    .select("id")
    .eq("id", ids.organizationB);
  expectNoError(expiredOwnerRead.error, "expired lease owner read");
  assert.deepEqual(expiredOwnerRead.data, []);

  const released = await admin.rpc("release_demo_sandbox", {
    p_lease_token_hash: firstHash,
  });
  expectNoError(released.error, "release first demo slot");
  assert.equal(released.data, true);

  const releasedOwnerRead = await clients.ownerA
    .from("organizations")
    .select("id")
    .eq("id", ids.organizationA);
  expectNoError(releasedOwnerRead.error, "released lease owner read");
  assert.deepEqual(releasedOwnerRead.data, []);

  const reused = await admin.rpc("claim_demo_sandbox", {
    p_lease_token_hash: hashes[3],
    p_requested_role: "member",
  });
  expectNoError(reused.error, "reuse released demo slot");
  assert.equal(reused.data[0].slot_number, 1);

  const memberAClaims = await clients.memberA.auth.getClaims();
  expectNoError(memberAClaims.error, "read member A session claims");
  const memberASessionId = memberAClaims.data.claims.session_id;
  assert.equal(typeof memberASessionId, "string");
  const reusedBound = await admin.rpc("bind_demo_sandbox_session", {
    p_lease_token_hash: hashes[3],
    p_auth_session_id: memberASessionId,
    p_user_id: ids.memberA,
  });
  expectNoError(reusedBound.error, "bind reused demo session");
  assert.equal(reusedBound.data, true);

  const reusedMemberRead = await clients.memberA
    .from("organizations")
    .select("id")
    .eq("id", ids.organizationA);
  expectNoError(reusedMemberRead.error, "reused member lease read");
  assert.deepEqual(reusedMemberRead.data, [{ id: ids.organizationA }]);

  const { count, error } = await admin
    .from("attention_items")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ids.organizationA);
  expectNoError(error, "count reset attention fixtures");
  assert.equal(count, 3);
});
