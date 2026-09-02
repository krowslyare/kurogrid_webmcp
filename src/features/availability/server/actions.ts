"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

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
