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
};
const emails = {
  ownerA: `owner-a-${runId}@example.test`,
  memberA: `member-a-${runId}@example.test`,
  ownerB: `owner-b-${runId}@example.test`,
  outsider: `outsider-${runId}@example.test`,
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
