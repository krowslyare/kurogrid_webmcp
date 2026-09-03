"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { manualConfigurationFromForm } from "@/features/availability/lib/manual-plan";
import { deliverAvailabilityNotifications } from "@/features/webmcp/server/execute-tool";
import { resolveAuthenticatedCapabilities } from "@/features/webmcp/server/resolve-capabilities";

function requiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing ${name}.`);
  }

  return value.trim();
}

function organizationSlugFromForm(formData: FormData) {
  const value = requiredString(formData, "organizationSlug");

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error("Invalid organization slug.");
  }

  return value;
}

function expectedRevisionFromForm(formData: FormData) {
  const value = Number(requiredString(formData, "expectedRevision"));

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid availability plan revision.");
  }

  return value;
}

function planHashFromForm(formData: FormData) {
  const value = requiredString(formData, "planHash");

  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new Error("Invalid availability plan hash.");
  }

  return value;
}

export async function approveAvailabilityPlan(formData: FormData) {
  const organizationSlug = organizationSlugFromForm(formData);
  const planId = requiredString(formData, "planId");
  const expectedRevision = expectedRevisionFromForm(formData);
  const planHash = planHashFromForm(formData);
  const supabase = await createClient();

  // The RPC is the authorization boundary. It re-reads the tenant-owned plan,
  // checks the authenticated Owner and exact revision, and records the approval.
  const availabilityDb = supabase as unknown as SupabaseClient;
  const { error } = await availabilityDb.rpc("approve_availability_plan", {
    p_plan_id: planId,
    p_expected_revision: expectedRevision,
    p_plan_hash: planHash,
  });

  if (error) {
    redirect(`/app/${organizationSlug}?availability=approval_error`);
  }

  revalidatePath(`/app/${organizationSlug}`);
  redirect(`/app/${organizationSlug}?availability=approved`);
}

export async function applyApprovedAvailabilityPlan(formData: FormData) {
  const organizationSlug = organizationSlugFromForm(formData);

  // Manual fallback: derive the exact plan server-side from current
  // capabilities instead of trusting hidden form fields. The RPC still
  // revalidates Owner role, revision, hash, and booking impact atomically.
  const capabilities = await resolveAuthenticatedCapabilities(organizationSlug);

  if (capabilities?.scope !== "authenticated" || capabilities.role !== "owner") {
    redirect(`/app/${organizationSlug}?availability=apply_error`);
  }

  const latest = capabilities.latestAvailabilityPlan;

  if (!capabilities.siteId || !latest?.canApply) {
    redirect(`/app/${organizationSlug}?availability=apply_error`);
  }

  const supabase = await createClient();
  const availabilityDb = supabase as unknown as SupabaseClient;
  const { data, error } = await availabilityDb.rpc("apply_approved_availability_plan", {
    p_plan_id: latest.id,
    p_expected_revision: latest.baseConfigurationRevision,
    p_plan_hash: latest.planHash,
    p_apply_idempotency_key: randomUUID(),
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    redirect(`/app/${organizationSlug}?availability=apply_error`);
  }

  await deliverAvailabilityNotifications(
    supabase,
    capabilities,
    data as Record<string, unknown>,
    latest.id,
  );

  revalidatePath(`/app/${organizationSlug}`);
  redirect(`/app/${organizationSlug}?availability=applied`);
}

export async function prepareAvailabilityPlanManually(formData: FormData) {
  const organizationSlug = organizationSlugFromForm(formData);
  const failUrl = `/app/${organizationSlug}?availability=prepare_error`;

  let configuration: ReturnType<typeof manualConfigurationFromForm>;

  try {
    configuration = manualConfigurationFromForm(formData);
  } catch {
    redirect(failUrl);
  }

  // Same Owner gate as the agent tool. The RPC validates the service,
  // the configuration shape, and tenant ownership again before persisting.
  const capabilities = await resolveAuthenticatedCapabilities(organizationSlug);

  if (!capabilities || capabilities.scope !== "authenticated" || capabilities.role !== "owner" || !capabilities.siteId) {
    redirect(failUrl);
  }

  const serviceSlug = requiredString(formData, "serviceSlug");

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(serviceSlug) || serviceSlug.length > 80) {
    redirect(failUrl);
  }

  const supabase = await createClient();
  const serviceResult = await supabase
    .from("clinic_services")
    .select("id")
    .eq("site_id", capabilities.siteId)
    .eq("slug", serviceSlug)
    .eq("active", true)
    .maybeSingle();

  if (serviceResult.error || !serviceResult.data) {
    redirect(failUrl);
  }

  const availabilityDb = supabase as unknown as SupabaseClient;
  const { data, error } = await availabilityDb.rpc("prepare_availability_plan", {
    p_site_id: capabilities.siteId,
    p_service_id: serviceResult.data.id,
    p_configuration: configuration,
    p_prepare_idempotency_key: randomUUID(),
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    redirect(failUrl);
  }

  revalidatePath(`/app/${organizationSlug}`);
  redirect(`/app/${organizationSlug}?availability=prepared`);
}
