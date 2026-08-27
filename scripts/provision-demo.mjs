import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

function localSupabaseEnvironment() {
  const output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
    encoding: "utf8",
  });

  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].replace(/^"|"$/g, "")]),
  );
}

const local = process.env.NEXT_PUBLIC_SUPABASE_URL ? {} : localSupabaseEnvironment();
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? local.API_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? local.SECRET_KEY;
const capacity = Number(process.env.DEMO_SANDBOX_CAPACITY ?? 2);
const password = process.env.DEMO_USER_PASSWORD
  ?? (apiUrl?.includes("127.0.0.1") ? "Local-demo-only-2026!" : undefined);

if (!apiUrl || !secretKey || !password) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, and DEMO_USER_PASSWORD.",
  );
}

if (!Number.isInteger(capacity) || capacity < 2 || capacity > 64) {
  throw new Error("DEMO_SANDBOX_CAPACITY must be an integer between 2 and 64.");
}

const admin = createClient(apiUrl, secretKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});

function id(prefix, slot) {
  return `${prefix}0000000-0000-4000-8000-${String(slot).padStart(12, "0")}`;
}

function assertNoError(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

async function ensureUser(userId, email) {
  const created = await admin.auth.admin.createUser({
    id: userId,
    email,
    password,
    email_confirm: true,
  });

  if (created.error && !created.error.message.toLowerCase().includes("already")) {
    throw new Error(`create ${email}: ${created.error.message}`);
  }

  const updated = await admin.auth.admin.updateUserById(userId, {
    email,
    password,
    email_confirm: true,
  });
  assertNoError(updated.error, `update ${email}`);
}

for (let slot = 1; slot <= capacity; slot += 1) {
  const suffix = String(slot).padStart(2, "0");
  const ownerId = id("1", slot);
  const memberId = id("2", slot);
  const organizationId = id("3", slot);
  const siteId = id("4", slot);
  const sandboxId = id("5", slot);
  const ownerEmail = `demo-owner-${suffix}@example.test`;
  const memberEmail = `demo-member-${suffix}@example.test`;

  await ensureUser(ownerId, ownerEmail);
  await ensureUser(memberId, memberEmail);

  const organization = await admin.from("organizations").upsert({
    id: organizationId,
    slug: `arboleda-demo-${suffix}`,
    name: `Clínica Veterinaria Arboleda · Sandbox ${suffix}`,
  });
  assertNoError(organization.error, `organization slot ${slot}`);

  const memberships = await admin.from("organization_memberships").upsert([
    { organization_id: organizationId, user_id: ownerId, role: "owner" },
    { organization_id: organizationId, user_id: memberId, role: "member" },
  ]);
  assertNoError(memberships.error, `memberships slot ${slot}`);

  const site = await admin.from("sites").upsert({
    id: siteId,
    organization_id: organizationId,
    slug: `arboleda-${suffix}`,
  });
  assertNoError(site.error, `site slot ${slot}`);

  const sandbox = await admin.from("demo_sandboxes").upsert({
    id: sandboxId,
    slot_number: slot,
    organization_id: organizationId,
    owner_user_id: ownerId,
    member_user_id: memberId,
    enabled: true,
  });
  assertNoError(sandbox.error, `sandbox slot ${slot}`);
}

const config = await admin
  .from("demo_runtime_config")
  .update({ capacity, updated_at: new Date().toISOString() })
  .eq("singleton", true);
assertNoError(config.error, "demo runtime config");

process.stdout.write(`Provisioned ${capacity} isolated demo sandboxes at ${apiUrl}.\n`);
