"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

function requiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing ${name}.`);
  }

  return value.trim();
}

function jsonString(value: Json | undefined, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return typeof value[key] === "string" ? value[key] : null;
}

function context(formData: FormData) {
  return {
    organizationSlug: requiredString(formData, "organizationSlug"),
    siteId: requiredString(formData, "siteId"),
    draftId: formData.get("draftId")?.toString() || null,
    revision: Number(formData.get("revision") ?? 0),
  };
}

export async function saveSiteDraft(formData: FormData) {
  const { organizationSlug, siteId, revision } = context(formData);
  const content: Json = {
    headline: requiredString(formData, "headline"),
    summary: requiredString(formData, "summary"),
    opening_hours: {
      weekdays: requiredString(formData, "weekdayHours"),
      saturday: requiredString(formData, "saturdayHours"),
    },
    cta_label: requiredString(formData, "ctaLabel"),
  };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_or_patch_site_draft", {
    p_site_id: siteId,
    p_expected_revision: revision,
    p_content: content,
  });

  if (error) {
    throw new Error("Unable to save the site draft.", { cause: error });
  }

  revalidatePath(`/app/${organizationSlug}`);
}

export async function approveSiteDraft(formData: FormData) {
  const { organizationSlug, draftId, revision } = context(formData);

  if (!draftId) {
    throw new Error("A draft is required before approval.");
  }

  const supabase = await createClient();
  const preview = await supabase.rpc("preview_publish_consequences", {
    p_draft_id: draftId,
  });

  if (preview.error) {
    throw new Error("Unable to preview publication consequences.", {
      cause: preview.error,
    });
  }

  const consequenceHash = jsonString(preview.data ?? undefined, "consequence_hash");

  if (typeof consequenceHash !== "string") {
    throw new Error("The publication preview is invalid.");
  }

  const { error } = await supabase.rpc("approve_site_draft", {
    p_draft_id: draftId,
    p_expected_revision: revision,
    p_consequence_hash: consequenceHash,
  });

  if (error) {
    throw new Error("Unable to approve this exact draft.", { cause: error });
  }

  revalidatePath(`/app/${organizationSlug}`);
}

export async function publishSiteDraft(formData: FormData) {
  const { organizationSlug, draftId, revision } = context(formData);

  if (!draftId) {
    throw new Error("A draft is required before publishing.");
  }

  const supabase = await createClient();
  const preview = await supabase.rpc("preview_publish_consequences", {
    p_draft_id: draftId,
  });

  if (preview.error) {
    throw new Error("Unable to refresh publication consequences.", {
      cause: preview.error,
    });
  }

  const consequenceHash = jsonString(preview.data ?? undefined, "consequence_hash");

  if (!consequenceHash) {
    throw new Error("The publication preview is invalid.");
  }

  const { data: approval, error: approvalError } = await supabase
    .from("publish_approvals")
    .select("id")
    .eq("draft_id", draftId)
    .eq("draft_revision", revision)
    .eq("consequence_hash", consequenceHash)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("approved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (approvalError || !approval) {
    throw new Error("A current exact owner approval is required.", {
      cause: approvalError ?? undefined,
    });
  }

  const { error } = await supabase.rpc("publish_site_draft", {
    p_draft_id: draftId,
    p_expected_revision: revision,
    p_approval_id: approval.id,
    p_consequence_hash: consequenceHash,
    p_idempotency_key: randomUUID(),
  });

  if (error) {
    throw new Error("Unable to publish the approved draft.", { cause: error });
  }

  revalidatePath(`/app/${organizationSlug}`);
}

export async function rollbackSiteVersion(formData: FormData) {
  const { organizationSlug, siteId } = context(formData);
  const targetVersionId = requiredString(formData, "targetVersionId");
  const supabase = await createClient();
  const { error } = await supabase.rpc("rollback_site_version", {
    p_site_id: siteId,
    p_target_version_id: targetVersionId,
    p_idempotency_key: randomUUID(),
  });

  if (error) {
    throw new Error("Unable to rollback the site version.", { cause: error });
  }

  revalidatePath(`/app/${organizationSlug}`);
}
