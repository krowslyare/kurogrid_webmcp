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

test("Public website exposes published-derived reads only", () => {
  const names = toolNamesForState({
    ...completeState,
    scope: "public",
    role: undefined,
  });

  assert.deepEqual(names, ["get_site_content", "get_opening_hours"]);
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
