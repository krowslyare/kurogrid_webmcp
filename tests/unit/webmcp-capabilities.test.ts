import assert from "node:assert/strict";
import test from "node:test";

import {
  definitionsForNames,
  toolNamesForState,
} from "../../src/features/webmcp/contracts.ts";

const completeState = {
  scope: "authenticated" as const,
  hasAttention: true,
  hasUnplannedAttention: true,
  hasOpenLead: true,
  hasSite: true,
  hasDraft: true,
  hasPublished: true,
  hasActiveApproval: true,
  versionCount: 2,
  latestAvailabilityPlanStatus: "approved" as const,
};

test("Owner receives the primary availability surface plus retained tools", () => {
  assert.deepEqual(toolNamesForState({ ...completeState, role: "owner" }), [
    "get_availability_configuration",
    "prepare_availability_plan",
    "apply_approved_availability_plan",
    "get_attention",
    "create_action_plan",
    "acknowledge_lead_attention",
    "get_site_content",
    "create_or_patch_site_draft",
    "preview_publish_consequences",
    "publish_site_draft",
    "get_opening_hours",
    "list_site_versions",
    "rollback_site_version",
  ]);
});

test("Member retains evidence, draft, preview, and reads without publish or rollback", () => {
  const names = toolNamesForState({ ...completeState, role: "member" });

  assert.equal(names.includes("get_availability_configuration"), false);
  assert.equal(names.includes("prepare_availability_plan"), false);
  assert.equal(names.includes("apply_availability_plan"), false);
  assert.equal(names.includes("apply_approved_availability_plan"), false);
  assert.equal(names.includes("publish_site_draft"), false);
  assert.equal(names.includes("rollback_site_version"), false);
  assert.equal(names.includes("create_or_patch_site_draft"), true);
  assert.equal(names.includes("preview_publish_consequences"), true);
});

test("Availability apply follows the prepared to approved to applied transition", () => {
  const prepared = toolNamesForState({
    ...completeState,
    role: "owner",
    latestAvailabilityPlanStatus: "prepared",
  });
  const approved = toolNamesForState({
    ...completeState,
    role: "owner",
    latestAvailabilityPlanStatus: "approved",
  });
  const applied = toolNamesForState({
    ...completeState,
    role: "owner",
    latestAvailabilityPlanStatus: "applied",
  });

  assert.equal(prepared.includes("get_availability_configuration"), true);
  assert.equal(prepared.includes("prepare_availability_plan"), true);
  assert.equal(prepared.includes("apply_availability_plan"), true);
  assert.equal(prepared.includes("apply_approved_availability_plan"), false);
  assert.equal(approved.includes("apply_availability_plan"), false);
  assert.equal(approved.includes("apply_approved_availability_plan"), true);
  assert.equal(applied.includes("get_availability_configuration"), true);
  assert.equal(applied.includes("prepare_availability_plan"), true);
  assert.equal(applied.includes("apply_availability_plan"), false);
  assert.equal(applied.includes("apply_approved_availability_plan"), false);
});

test("Delegated availability apply binds the exact prepared plan", () => {
  const [definition] = definitionsForNames(["apply_availability_plan"]);
  const schema = definition.inputSchema as {
    properties: Record<string, Record<string, unknown>>;
    required: string[];
    additionalProperties: boolean;
  };

  assert.deepEqual(schema.required, [
    "plan_id",
    "expected_revision",
    "plan_hash",
    "idempotency_key",
  ]);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.plan_hash.pattern, "^[0-9a-f]{64}$");
});

test("Availability prepare schema is bounded and cannot accept agent-derived impact", () => {
  const [definition] = definitionsForNames(["prepare_availability_plan"]);
  const schema = definition.inputSchema as {
    properties: Record<string, Record<string, unknown>>;
    required: string[];
    additionalProperties: boolean;
  };

  assert.deepEqual(schema.required, [
    "service_slug",
    "period_start",
    "period_end",
    "timezone",
    "slot_duration_minutes",
    "weekly_ranges",
    "recurring_blocks",
    "busy_intervals",
    "preserve_existing_bookings",
    "idempotency_key",
  ]);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.preserve_existing_bookings.const, true);
  assert.equal("appointment_ids" in schema.properties, false);
  assert.equal("alternatives" in schema.properties, false);
  assert.equal(schema.properties.busy_intervals.maxItems, 100);
});

test("Owner publish disappears when exact approval is absent", () => {
  const names = toolNamesForState({
    ...completeState,
    role: "owner",
    hasActiveApproval: false,
  });

  assert.equal(names.includes("publish_site_draft"), false);
  assert.equal(names.includes("rollback_site_version"), true);
});

test("Public website exposes the customer appointment entry surface", () => {
  const names = toolNamesForState({
    ...completeState,
    scope: "public",
    role: undefined,
  });

  assert.deepEqual(names, [
    "get_site_content",
    "get_opening_hours",
    "get_clinic_services",
    "find_appointment_slots",
    "prepare_appointment_request",
  ]);
});

test("Prepared request exposes exact confirmation, then removes it", () => {
  const prepared = toolNamesForState({
    ...completeState,
    scope: "public",
    role: undefined,
    appointmentStatus: "prepared",
    canConfirmAppointment: true,
  });
  const requested = toolNamesForState({
    ...completeState,
    scope: "public",
    role: undefined,
    appointmentStatus: "requested",
    canConfirmAppointment: true,
  });

  assert.equal(prepared.includes("confirm_appointment_request"), true);
  assert.equal(requested.includes("confirm_appointment_request"), false);
  assert.equal(requested.includes("get_appointment_status"), true);
});

test("Customer response and calendar tools follow appointment state", () => {
  const proposed = toolNamesForState({
    ...completeState,
    scope: "public",
    role: undefined,
    appointmentStatus: "time_proposed",
  });
  const confirmed = toolNamesForState({
    ...completeState,
    scope: "public",
    role: undefined,
    appointmentStatus: "confirmed",
  });

  assert.equal(proposed.includes("respond_to_appointment_proposal"), true);
  assert.equal(proposed.includes("get_appointment_calendar_event"), false);
  assert.equal(confirmed.includes("respond_to_appointment_proposal"), false);
  assert.equal(confirmed.includes("get_appointment_calendar_event"), true);
});

test("An unpublished public route exposes no tools", () => {
  const names = toolNamesForState({
    ...completeState,
    scope: "public",
    role: undefined,
    hasPublished: false,
  });

  assert.deepEqual(names, []);
});
