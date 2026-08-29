import assert from "node:assert/strict";
import test from "node:test";

import { toolNamesForState } from "../../src/features/webmcp/contracts.ts";

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
};

test("Owner receives the complete ten-tool surface only when state allows it", () => {
  assert.deepEqual(toolNamesForState({ ...completeState, role: "owner" }), [
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

  assert.equal(names.includes("publish_site_draft"), false);
  assert.equal(names.includes("rollback_site_version"), false);
  assert.equal(names.includes("create_or_patch_site_draft"), true);
  assert.equal(names.includes("preview_publish_consequences"), true);
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
