"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { sendAppointmentUpdate } from "./notifications";

function required(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string" || !value) throw new Error(`missing_${name}`);
  return value;
}

function siteSlugFromForm(formData: FormData) {
  const value = required(formData, "siteSlug");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new Error("invalid_site_slug");
  return value;
}

export type BookingSlotOption = {
  slot_id: string;
  starts_at: string;
  duration_minutes: number;
};

// Live slot lookup for the manual booking form. Same tenant-safe RPC the
// agent tool uses; inputs are validated here and the RPC fails closed.
export async function findSlotsForBooking(
  siteSlug: string,
  serviceSlug: string,
  date: string,
): Promise<{ slots: BookingSlotOption[] } | { error: string }> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(siteSlug)) return { error: "invalid_site" };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(serviceSlug) || serviceSlug.length > 80) {
    return { error: "invalid_service" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return { error: "invalid_date" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_appointment_slots", {
    p_site_slug: siteSlug,
    p_service_slug: serviceSlug,
    p_date: date,
  });

  if (error || !Array.isArray(data)) return { error: "unavailable" };

  const slots: BookingSlotOption[] = [];

  for (const row of data) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;

    const slot = row as Record<string, unknown>;
    const slotId = slot.slot_id ?? slot.id;
    const startsAt = slot.starts_at;
    const duration = slot.duration_minutes;

    if (typeof slotId !== "string" || !slotId) continue;
    if (typeof startsAt !== "string" || Number.isNaN(Date.parse(startsAt))) continue;
    if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) continue;

    slots.push({ slot_id: slotId, starts_at: startsAt, duration_minutes: duration });
  }

  return { slots };
}

export async function prepareAppointmentFromPage(formData: FormData) {
  const siteSlug = siteSlugFromForm(formData);
  const serviceSlug = required(formData, "serviceSlug");
  const slotId = required(formData, "slotId");
  const petName = required(formData, "petName").trim();
  const customerEmail = required(formData, "customerEmail").trim();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prepare_appointment_request", {
    p_site_slug: siteSlug,
    p_service_slug: serviceSlug,
    p_slot_id: slotId,
    p_pet_name: petName,
    p_customer_email: customerEmail,
    p_idempotency_key: randomUUID(),
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    redirect(`/sites/${siteSlug}?bookingError=prepare#agent-booking`);
  }

  const prepared = data as Record<string, unknown>;
  const search = new URLSearchParams({
    appointment: String(prepared.request_id),
    access: String(prepared.access_token),
    confirm: String(prepared.confirmation_token),
  });

  redirect(`/sites/${siteSlug}?${search}#agent-booking`);
}

export async function confirmAppointmentFromPage(formData: FormData) {
  const siteSlug = siteSlugFromForm(formData);
  const requestId = required(formData, "requestId");
  const accessToken = required(formData, "accessToken");
  const confirmationToken = required(formData, "confirmationToken");
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_appointment_request", {
    p_request_id: requestId,
    p_confirmation_token: confirmationToken,
  });

  if (error) {
    redirect(`/sites/${siteSlug}?appointment=${requestId}&access=${accessToken}&bookingError=confirm#agent-booking`);
  }

  revalidatePath(`/sites/${siteSlug}`);
  redirect(`/sites/${siteSlug}?appointment=${requestId}&access=${accessToken}#agent-booking`);
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

export async function simulateClinicResponseFromPage(formData: FormData) {
  const siteSlug = siteSlugFromForm(formData);
  const requestId = required(formData, "requestId");
  const accessToken = required(formData, "accessToken");
  const decision = required(formData, "decision");

  if (decision !== "confirm" && decision !== "propose") {
    throw new Error("invalid_demo_response");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simulate_demo_clinic_response", {
    p_request_id: requestId,
    p_access_token: accessToken,
    p_decision: decision,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    const search = new URLSearchParams({
      appointment: requestId,
      access: accessToken,
      bookingError: "response",
    });
    redirect(`/sites/${siteSlug}?${search}#agent-booking`);
  }

  const appointment = data as Record<string, unknown>;
  const delivery = await sendAppointmentUpdate({
    requestId,
    accessToken,
    siteSlug: String(appointment.site_slug),
    customerEmail: String(appointment.customer_email),
    petName: String(appointment.pet_name),
    service: String(appointment.service),
    startsAt: String(appointment.starts_at),
    status: String(appointment.status) as "confirmed" | "time_proposed",
  });
  const search = new URLSearchParams({
    appointment: requestId,
    access: accessToken,
    delivery: delivery.status,
    mode: delivery.mode,
  });

  revalidatePath(`/sites/${siteSlug}`);
  redirect(`/sites/${siteSlug}?${search}#agent-booking`);
}

export async function respondToAppointmentProposal(formData: FormData) {
  const siteSlug = siteSlugFromForm(formData);
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
  redirect(`/sites/${siteSlug}?appointment=${requestId}&access=${accessToken}#agent-booking`);
}
