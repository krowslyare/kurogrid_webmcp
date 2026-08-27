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
