"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { sendAppointmentUpdate } from "./notifications";

function required(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string" || !value) throw new Error(`missing_${name}`);
  return value;
}

export async function updateAppointmentFromOwner(formData: FormData) {
  const organizationSlug = required(formData, "organizationSlug");
  const requestId = required(formData, "requestId");
  const decision = required(formData, "decision");
  const proposedStartsAt = formData.get("proposedStartsAt");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("owner_update_appointment_request", {
    p_request_id: requestId,
    p_decision: decision,
    p_proposed_starts_at: typeof proposedStartsAt === "string" && proposedStartsAt
      ? new Date(proposedStartsAt).toISOString()
      : undefined,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Unable to update appointment request.", { cause: error });
  }

  const appointment = data as Record<string, unknown>;
  const delivery = await sendAppointmentUpdate({
    requestId,
    accessToken: String(appointment.access_token),
    siteSlug: String(appointment.site_slug),
    customerEmail: String(appointment.customer_email),
    petName: String(appointment.pet_name),
    service: String(appointment.service),
    startsAt: String(appointment.starts_at),
    status: String(appointment.status) as "confirmed" | "time_proposed",
  });

  revalidatePath(`/app/${organizationSlug}`);
  redirect(`/app/${organizationSlug}?appointment=${delivery.status}&mode=${delivery.mode}`);
}

export async function respondToAppointmentProposal(formData: FormData) {
  const siteSlug = required(formData, "siteSlug");
  const requestId = required(formData, "requestId");
  const accessToken = required(formData, "accessToken");
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_appointment_proposal", {
    p_request_id: requestId,
    p_access_token: accessToken,
    p_accept: required(formData, "response") === "accept",
  });

  if (error) throw new Error("Unable to respond to the proposed time.", { cause: error });

  revalidatePath(`/sites/${siteSlug}`);
  redirect(`/sites/${siteSlug}?appointment=${requestId}&access=${accessToken}`);
}
