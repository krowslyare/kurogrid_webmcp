import "server-only";

import type { Json } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendAppointmentUpdate } from "@/features/appointments/server/notifications";

import {
  WEBMCP_TOOL_NAMES,
  type WebMcpToolName,
} from "../contracts";
import {
  resolveAuthenticatedCapabilities,
  resolvePublicCapabilities,
  type ResolvedCapabilities,
} from "./resolve-capabilities";

type ToolRequest = {
  name: string;
  input: unknown;
  organizationSlug?: string;
  siteSlug?: string;
  appointmentId?: string;
  accessToken?: string;
  confirmationToken?: string;
};

function objectInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("tool_input_must_be_an_object");
  }

  return input as Record<string, unknown>;
}

function exactInputKeys(
  input: Record<string, unknown>,
  expectedKeys: readonly string[],
) {
  const actualKeys = Object.keys(input).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  if (
    actualKeys.length !== sortedExpectedKeys.length
    || actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new Error("tool_input_shape_mismatch");
  }
}

function uuidInput(input: Record<string, unknown>, name: string) {
  const value = input[name];

  if (
    typeof value !== "string"
    || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
  ) {
    throw new Error(`invalid_${name}`);
  }

  return value;
}

function planHashInput(input: Record<string, unknown>, name: string) {
  const value = input[name];

  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`invalid_${name}`);
  }

  return value;
}

function integerInput(
  input: Record<string, unknown>,
  name: string,
  minimum: number,
  maximum = Number.POSITIVE_INFINITY,
) {
  const value = input[name];

  if (
    !Number.isInteger(value)
    || (value as number) < minimum
    || (value as number) > maximum
  ) {
    throw new Error(`invalid_${name}`);
  }

  return value as number;
}

function stringInput(
  input: Record<string, unknown>,
  name: string,
  maximum: number,
) {
  const value = input[name];
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new Error(`invalid_${name}`);
  }
  return value.trim();
}

function booleanInput(input: Record<string, unknown>, name: string) {
  const value = input[name];
  if (typeof value !== "boolean") throw new Error(`invalid_${name}`);
  return value;
}

const availabilityBusySources = new Set([
  "calendar",
  "manual",
]);

const localTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

type AvailabilityRangeInput = {
  day_of_week: number;
  starts_at: string;
  ends_at: string;
};

type AvailabilityBusyIntervalInput = {
  starts_at: string;
  ends_at: string;
  source: string;
};

type AvailabilityPlanInput = {
  service_slug: string;
  period_start: string;
  period_end: string;
  timezone: string;
  slot_duration_minutes: number;
  weekly_ranges: AvailabilityRangeInput[];
  recurring_blocks: AvailabilityRangeInput[];
  busy_intervals: AvailabilityBusyIntervalInput[];
  preserve_existing_bookings: true;
  idempotency_key: string;
};

type UnregisteredRpcResult = {
  data: unknown;
  error: unknown | null;
};

type UnregisteredRpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<UnregisteredRpcResult>;
};

function callUnregisteredRpc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  args: Record<string, unknown>,
) {
  return (supabase as unknown as UnregisteredRpcClient).rpc(name, args);
}

function recordInput(value: unknown, errorName: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(errorName);
  }

  return value as Record<string, unknown>;
}

function dateInput(input: Record<string, unknown>, name: string) {
  const value = stringInput(input, name, 10);
  if (!datePattern.test(value)) throw new Error(`invalid_${name}`);

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`invalid_${name}`);
  }

  return value;
}

function localTimeInput(input: Record<string, unknown>, name: string) {
  const value = stringInput(input, name, 8);
  if (!localTimePattern.test(value)) throw new Error(`invalid_${name}`);
  return value;
}

function localTimeMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function dateTimeInput(input: Record<string, unknown>, name: string) {
  const value = stringInput(input, name, 40);
  if (!dateTimePattern.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`invalid_${name}`);
  }
  return value;
}

function availabilityRangeInput(value: unknown, name: string): AvailabilityRangeInput {
  const range = recordInput(value, `invalid_${name}`);
  exactInputKeys(range, ["day_of_week", "starts_at", "ends_at"]);

  const startsAt = localTimeInput(range, "starts_at");
  const endsAt = localTimeInput(range, "ends_at");
  if (localTimeMinutes(startsAt) >= localTimeMinutes(endsAt)) {
    throw new Error(`invalid_${name}`);
  }

  return {
    day_of_week: integerInput(range, "day_of_week", 0, 6),
    starts_at: startsAt,
    ends_at: endsAt,
  };
}

function availabilityRangesInput(
  input: Record<string, unknown>,
  name: "weekly_ranges" | "recurring_blocks",
) {
  const value = input[name];
  if (
    !Array.isArray(value)
    || value.length > 28
    || (name === "weekly_ranges" && value.length === 0)
  ) {
    throw new Error(`invalid_${name}`);
  }

  return value.map((range) => availabilityRangeInput(range, name));
}

function availabilityBusyIntervalsInput(input: Record<string, unknown>) {
  const value = input.busy_intervals;
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error("invalid_busy_intervals");
  }

  return value.map((interval) => {
    const item = recordInput(interval, "invalid_busy_intervals");
    exactInputKeys(item, ["starts_at", "ends_at", "source"]);

    const startsAt = dateTimeInput(item, "starts_at");
    const endsAt = dateTimeInput(item, "ends_at");
    if (Date.parse(startsAt) >= Date.parse(endsAt)) {
      throw new Error("invalid_busy_intervals");
    }

    const source = stringInput(item, "source", 32);
    if (!availabilityBusySources.has(source)) {
      throw new Error("invalid_busy_interval_source");
    }

    return { starts_at: startsAt, ends_at: endsAt, source };
  });
}

function availabilityPlanInput(input: Record<string, unknown>): AvailabilityPlanInput {
  const periodStart = dateInput(input, "period_start");
  const periodEnd = dateInput(input, "period_end");
  const periodStartMs = Date.parse(`${periodStart}T00:00:00.000Z`);
  const periodEndMs = Date.parse(`${periodEnd}T00:00:00.000Z`);
  const periodDays = (periodEndMs - periodStartMs) / 86_400_000;

  if (periodDays <= 0 || periodDays > 366) {
    throw new Error("invalid_availability_period");
  }

  const timezone = stringInput(input, "timezone", 64);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new Error("invalid_timezone");
  }

  const slotDuration = integerInput(input, "slot_duration_minutes", 5, 180);
  if (slotDuration % 5 !== 0) throw new Error("invalid_slot_duration_minutes");

  if (input.preserve_existing_bookings !== true) {
    throw new Error("preserve_existing_bookings_must_be_true");
  }

  return {
    service_slug: stringInput(input, "service_slug", 80),
    period_start: periodStart,
    period_end: periodEnd,
    timezone,
    slot_duration_minutes: slotDuration,
    weekly_ranges: availabilityRangesInput(input, "weekly_ranges"),
    recurring_blocks: availabilityRangesInput(input, "recurring_blocks"),
    busy_intervals: availabilityBusyIntervalsInput(input),
    preserve_existing_bookings: true,
    idempotency_key: uuidInput(input, "idempotency_key"),
  };
}

function availabilityObjectResult(data: unknown, errorName: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(errorName);
  }

  return data as Record<string, unknown>;
}

function shapedAvailabilityPlanResult(data: unknown, changesApplied: boolean) {
  const plan = availabilityObjectResult(data, "availability_plan_unavailable");
  const notificationsSent = changesApplied && plan.notifications_sent === true;

  return {
    availability_plan: plan,
    changes_applied: changesApplied,
    notifications_sent: notificationsSent,
    capabilities_changed: true,
  };
}

async function deliverAvailabilityNotifications(
  supabase: Awaited<ReturnType<typeof createClient>>,
  capabilities: ResolvedCapabilities,
  applied: Record<string, unknown>,
  planId: string,
) {
  const pendingNotifications = Array.isArray(applied.customer_notifications)
    ? applied.customer_notifications
        .map((value) => value && typeof value === "object" && !Array.isArray(value)
          ? value as Record<string, unknown>
          : null)
        .filter((value): value is Record<string, unknown> => Boolean(value))
    : [];
  const serviceId = typeof applied.service_id === "string"
    ? applied.service_id
    : null;
  const serviceResult = serviceId
    ? await supabase
        .from("clinic_services")
        .select("name")
        .eq("id", serviceId)
        .maybeSingle()
    : { data: null, error: null };

  if (serviceResult.error) throw serviceResult.error;

  const deliveries = capabilities.siteSlug
    ? await Promise.all(pendingNotifications.map((notification) =>
        sendAppointmentUpdate({
          requestId: String(notification.appointment_id),
          accessToken: String(notification.access_token),
          siteSlug: capabilities.siteSlug!,
          customerEmail: String(notification.customer_email),
          petName: String(notification.pet_name),
          service: serviceResult.data?.name ?? "Dermatology consultation",
          startsAt: String(notification.proposed_starts_at),
          status: "time_proposed",
        })))
    : [];
  const notificationsSent = deliveries.length > 0
    && deliveries.every((delivery) => delivery.status === "sent");
  const notificationStatus = deliveries.some((delivery) => delivery.status === "failed")
    ? "failed"
    : notificationsSent
      ? "sent"
      : deliveries.some((delivery) => delivery.status === "preview")
        ? "preview"
        : "not_attempted";
  const appliedWithDelivery = {
    ...applied,
    notification_count: deliveries.length,
    notification_deliveries: deliveries,
    notification_status: notificationStatus,
    notifications_sent: notificationsSent,
  };

  if (capabilities.organizationId) {
    const admin = createAdminClient();
    const { error: receiptError } = await admin
      .from("availability_plans")
      .update({ applied_result: appliedWithDelivery as Json })
      .eq("id", planId)
      .eq("organization_id", capabilities.organizationId);

    if (receiptError) throw receiptError;
  }

  return {
    appliedWithDelivery,
    deliveries,
    notificationsSent,
  };
}

function isToolName(name: string): name is WebMcpToolName {
  return (WEBMCP_TOOL_NAMES as readonly string[]).includes(name);
}

async function resolveRequestCapabilities(request: ToolRequest) {
  if (request.organizationSlug) {
    return resolveAuthenticatedCapabilities(request.organizationSlug);
  }

  if (request.siteSlug) {
    return resolvePublicCapabilities(
      request.siteSlug,
      request.appointmentId,
      request.accessToken,
      request.confirmationToken,
    );
  }

  return null;
}

function publishedContent(capabilities: ResolvedCapabilities) {
  const content = capabilities.published?.content;

  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new Error("published_content_unavailable");
  }

  return content as Record<string, unknown>;
}

export async function executeWebMcpTool(request: ToolRequest) {
  if (!isToolName(request.name)) {
    throw new Error("unknown_tool");
  }

  const capabilities = await resolveRequestCapabilities(request);

  if (!capabilities || !capabilities.names.includes(request.name)) {
    throw new Error("tool_not_available_in_current_context");
  }

  const input = objectInput(request.input);
  const supabase = await createClient();

  switch (request.name) {
    case "get_attention": {
      exactInputKeys(input, []);
      const { data, error } = await supabase
        .from("attention_items")
        .select("id, kind, title, summary, evidence, status, revision, created_at")
        .eq("organization_id", capabilities.organizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { attention: data };
    }

    case "get_availability_configuration": {
      exactInputKeys(input, []);
      if (capabilities.scope !== "authenticated" || capabilities.role !== "owner") {
        throw new Error("availability_owner_required");
      }
      if (!capabilities.siteId) throw new Error("site_unavailable");

      const serviceResult = await supabase
        .from("clinic_services")
        .select("id")
        .eq("site_id", capabilities.siteId)
        .eq("slug", "dermatology")
        .eq("active", true)
        .maybeSingle();
      if (serviceResult.error) throw serviceResult.error;
      if (!serviceResult.data) throw new Error("availability_service_unavailable");

      const { data, error } = await callUnregisteredRpc(
        supabase,
        "get_availability_configuration",
        {
          p_site_id: capabilities.siteId,
          p_service_id: serviceResult.data.id,
        },
      );
      if (error) throw error;
      return {
        availability_configuration: availabilityObjectResult(
          data,
          "availability_configuration_unavailable",
        ),
      };
    }

    case "prepare_availability_plan": {
      exactInputKeys(input, [
        "busy_intervals",
        "idempotency_key",
        "period_end",
        "period_start",
        "preserve_existing_bookings",
        "recurring_blocks",
        "service_slug",
        "slot_duration_minutes",
        "timezone",
        "weekly_ranges",
      ]);
      if (capabilities.scope !== "authenticated" || capabilities.role !== "owner") {
        throw new Error("availability_owner_required");
      }
      if (!capabilities.siteId) throw new Error("site_unavailable");

      const planInput = availabilityPlanInput(input);
      const serviceResult = await supabase
        .from("clinic_services")
        .select("id")
        .eq("site_id", capabilities.siteId)
        .eq("slug", planInput.service_slug)
        .eq("active", true)
        .maybeSingle();
      if (serviceResult.error) throw serviceResult.error;
      if (!serviceResult.data) throw new Error("availability_service_unavailable");
      const { data, error } = await callUnregisteredRpc(
        supabase,
        "prepare_availability_plan",
        {
          p_site_id: capabilities.siteId,
          p_service_id: serviceResult.data.id,
          p_configuration: {
            period_start: planInput.period_start,
            period_end: planInput.period_end,
            timezone: planInput.timezone,
            slot_duration_minutes: planInput.slot_duration_minutes,
            weekly_ranges: planInput.weekly_ranges,
            recurring_blocks: planInput.recurring_blocks,
            busy_intervals: planInput.busy_intervals,
            preserve_existing_bookings: planInput.preserve_existing_bookings,
          },
          p_prepare_idempotency_key: planInput.idempotency_key,
        },
      );
      if (error) throw error;

      return {
        ...shapedAvailabilityPlanResult(data, false),
        preserve_existing_bookings: true,
      };
    }

    case "apply_approved_availability_plan": {
      exactInputKeys(input, ["idempotency_key"]);
      if (capabilities.scope !== "authenticated" || capabilities.role !== "owner") {
        throw new Error("availability_owner_required");
      }
      if (!capabilities.siteId || !capabilities.latestAvailabilityPlan?.canApply) {
        throw new Error("exact_owner_approval_required");
      }

      const { data, error } = await callUnregisteredRpc(
        supabase,
        "apply_approved_availability_plan",
        {
          p_plan_id: capabilities.latestAvailabilityPlan.id,
          p_expected_revision:
            capabilities.latestAvailabilityPlan.baseConfigurationRevision,
          p_plan_hash: capabilities.latestAvailabilityPlan.planHash,
          p_apply_idempotency_key: uuidInput(input, "idempotency_key"),
        },
      );
      if (error) throw error;
      const applied = availabilityObjectResult(
        data,
        "availability_plan_unavailable",
      );
      const { appliedWithDelivery, deliveries, notificationsSent } =
        await deliverAvailabilityNotifications(
          supabase,
          capabilities,
          applied,
          capabilities.latestAvailabilityPlan.id,
        );

      return {
        ...shapedAvailabilityPlanResult(appliedWithDelivery, true),
        notification_deliveries: deliveries,
        notifications_sent: notificationsSent,
      };
    }

    case "apply_availability_plan": {
      exactInputKeys(input, [
        "expected_revision",
        "idempotency_key",
        "plan_hash",
        "plan_id",
      ]);
      if (capabilities.scope !== "authenticated" || capabilities.role !== "owner") {
        throw new Error("availability_owner_required");
      }

      const latestPlan = capabilities.latestAvailabilityPlan;
      const planId = uuidInput(input, "plan_id");
      const expectedRevision = integerInput(input, "expected_revision", 0);
      const planHash = planHashInput(input, "plan_hash");
      if (
        !capabilities.siteId
        || latestPlan?.status !== "prepared"
        || latestPlan.id !== planId
        || latestPlan.baseConfigurationRevision !== expectedRevision
        || latestPlan.planHash !== planHash
      ) {
        throw new Error("prepared_availability_plan_changed");
      }

      const { data, error } = await callUnregisteredRpc(
        supabase,
        "approve_and_apply_availability_plan",
        {
          p_plan_id: planId,
          p_expected_revision: expectedRevision,
          p_plan_hash: planHash,
          p_apply_idempotency_key: uuidInput(input, "idempotency_key"),
        },
      );
      if (error) throw error;
      const applied = availabilityObjectResult(
        data,
        "availability_plan_unavailable",
      );
      const { appliedWithDelivery, deliveries, notificationsSent } =
        await deliverAvailabilityNotifications(
          supabase,
          capabilities,
          applied,
          planId,
        );

      return {
        ...shapedAvailabilityPlanResult(appliedWithDelivery, true),
        notification_deliveries: deliveries,
        notifications_sent: notificationsSent,
      };
    }

    case "create_action_plan": {
      exactInputKeys(input, ["attention_item_id", "idempotency_key"]);
      const { data, error } = await supabase.rpc("create_action_plan", {
        p_attention_item_id: uuidInput(input, "attention_item_id"),
        p_idempotency_key: uuidInput(input, "idempotency_key"),
      });
      if (error) throw error;
      return { action_plan_id: data, capabilities_changed: true };
    }

    case "acknowledge_lead_attention": {
      exactInputKeys(input, ["attention_item_id", "expected_revision"]);
      const { data, error } = await supabase.rpc("acknowledge_lead_attention", {
        p_attention_item_id: uuidInput(input, "attention_item_id"),
        p_expected_revision: integerInput(input, "expected_revision", 1),
      });
      if (error) throw error;
      return { revision: data, acknowledged: true, communication_sent: false, capabilities_changed: true };
    }

    case "get_site_content":
      exactInputKeys(input, []);
      return {
        site_slug: capabilities.siteSlug,
        draft: capabilities.scope === "authenticated" ? capabilities.draft ?? null : undefined,
        published: capabilities.published ?? null,
      };

    case "create_or_patch_site_draft": {
      exactInputKeys(input, ["content", "expected_revision"]);
      if (!capabilities.siteId) throw new Error("site_unavailable");
      const content = input["content"];
      if (!content || typeof content !== "object" || Array.isArray(content)) {
        throw new Error("invalid_content");
      }
      const { data, error } = await supabase.rpc("create_or_patch_site_draft", {
        p_site_id: capabilities.siteId,
        p_expected_revision: integerInput(input, "expected_revision", 0),
        p_content: content as Json,
      });
      if (error) throw error;
      return { draft: data, capabilities_changed: true };
    }

    case "preview_publish_consequences": {
      exactInputKeys(input, []);
      if (!capabilities.draft) throw new Error("draft_unavailable");
      const { data, error } = await supabase.rpc("preview_publish_consequences", {
        p_draft_id: capabilities.draft.id,
      });
      if (error) throw error;
      return data;
    }

    case "publish_site_draft": {
      exactInputKeys(input, ["idempotency_key"]);
      if (!capabilities.draft || !capabilities.activeApproval) {
        throw new Error("exact_owner_approval_required");
      }
      const { data, error } = await supabase.rpc("publish_site_draft", {
        p_draft_id: capabilities.draft.id,
        p_expected_revision: capabilities.draft.revision,
        p_approval_id: capabilities.activeApproval.id,
        p_consequence_hash: capabilities.activeApproval.consequenceHash,
        p_idempotency_key: uuidInput(input, "idempotency_key"),
      });
      if (error) throw error;
      return { published_version_id: data, capabilities_changed: true };
    }

    case "get_opening_hours": {
      exactInputKeys(input, []);
      const content = publishedContent(capabilities);
      return {
        version_id: capabilities.published!.versionId,
        opening_hours: content["opening_hours"],
      };
    }

    case "get_clinic_services": {
      exactInputKeys(input, []);
      if (!capabilities.siteSlug) throw new Error("site_unavailable");
      const { data, error } = await supabase.rpc("get_clinic_services", {
        p_site_slug: capabilities.siteSlug,
      });
      if (error) throw error;
      return { services: data };
    }

    case "find_appointment_slots": {
      exactInputKeys(input, ["date", "service_slug"]);
      if (!capabilities.siteSlug) throw new Error("site_unavailable");
      const date = stringInput(input, "date", 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("invalid_date");
      const { data, error } = await supabase.rpc("find_appointment_slots", {
        p_site_slug: capabilities.siteSlug,
        p_service_slug: stringInput(input, "service_slug", 80),
        p_date: date,
      });
      if (error) throw error;
      return { slots: data };
    }

    case "prepare_appointment_request": {
      exactInputKeys(input, [
        "customer_email",
        "idempotency_key",
        "pet_name",
        "service_slug",
        "slot_id",
      ]);
      if (!capabilities.siteSlug) throw new Error("site_unavailable");
      const { data, error } = await supabase.rpc("prepare_appointment_request", {
        p_site_slug: capabilities.siteSlug,
        p_service_slug: stringInput(input, "service_slug", 80),
        p_slot_id: uuidInput(input, "slot_id"),
        p_pet_name: stringInput(input, "pet_name", 80),
        p_customer_email: stringInput(input, "customer_email", 200),
        p_idempotency_key: uuidInput(input, "idempotency_key"),
      });
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("appointment_request_unavailable");
      }
      const prepared = data as Record<string, unknown>;
      const search = new URLSearchParams({
        appointment: String(prepared.request_id),
        access: String(prepared.access_token),
        confirm: String(prepared.confirmation_token),
      });
      return {
        appointment: prepared,
        confirmation_required: true,
        navigate_to: `/sites/${capabilities.siteSlug}?${search}`,
        capabilities_changed: true,
      };
    }

    case "confirm_appointment_request": {
      exactInputKeys(input, []);
      if (!capabilities.appointment?.confirmationToken) {
        throw new Error("appointment_confirmation_unavailable");
      }
      const { data, error } = await supabase.rpc("confirm_appointment_request", {
        p_request_id: capabilities.appointment.id,
        p_confirmation_token: capabilities.appointment.confirmationToken,
      });
      if (error) throw error;
      return {
        appointment: data,
        updates_channel: "email",
        capabilities_changed: true,
      };
    }

    case "get_appointment_status":
      exactInputKeys(input, []);
      if (!capabilities.appointment) throw new Error("appointment_unavailable");
      return { appointment: capabilities.appointment.details };

    case "respond_to_appointment_proposal": {
      exactInputKeys(input, ["accept"]);
      if (!capabilities.appointment) throw new Error("appointment_unavailable");
      const { data, error } = await supabase.rpc("respond_to_appointment_proposal", {
        p_request_id: capabilities.appointment.id,
        p_access_token: capabilities.appointment.accessToken,
        p_accept: booleanInput(input, "accept"),
      });
      if (error) throw error;
      return { appointment: data, capabilities_changed: true };
    }

    case "get_appointment_calendar_event": {
      exactInputKeys(input, []);
      if (!capabilities.appointment || capabilities.appointment.status !== "confirmed") {
        throw new Error("confirmed_appointment_required");
      }
      const details = capabilities.appointment.details as Record<string, unknown>;
      const startsAt = new Date(String(details.starts_at));
      const duration = Number(details.duration_minutes);
      const endsAt = new Date(startsAt.getTime() + duration * 60_000);
      const calendarStamp = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      const title = `${String(details.service)} for ${String(details.pet_name)} · Mimo`;
      const google = new URL("https://calendar.google.com/calendar/render");
      google.searchParams.set("action", "TEMPLATE");
      google.searchParams.set("text", title);
      google.searchParams.set("dates", `${calendarStamp(startsAt)}/${calendarStamp(endsAt)}`);
      google.searchParams.set("details", "Confirmed through Mimo's WebMCP appointment flow.");
      google.searchParams.set("location", "Clínica Veterinaria Mimo");
      const calendarSearch = new URLSearchParams({
        appointment: capabilities.appointment.id,
        access: capabilities.appointment.accessToken,
      });
      return {
        event: {
          title,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          location: "Clínica Veterinaria Mimo",
        },
        google_calendar_url: google.toString(),
        ics_download_url: `/api/appointments/calendar?${calendarSearch}`,
      };
    }

    case "list_site_versions":
      exactInputKeys(input, []);
      return {
        published_version_id: capabilities.published?.versionId ?? null,
        versions: capabilities.versions,
      };

    case "rollback_site_version": {
      exactInputKeys(input, ["idempotency_key", "target_version_id"]);
      if (!capabilities.siteId) throw new Error("site_unavailable");
      const targetVersionId = uuidInput(input, "target_version_id");
      if (!capabilities.versions.some((version) => version.id === targetVersionId)) {
        throw new Error("target_version_unavailable");
      }
      if (capabilities.published?.versionId === targetVersionId) {
        throw new Error("target_version_already_published");
      }
      const { data, error } = await supabase.rpc("rollback_site_version", {
        p_site_id: capabilities.siteId,
        p_target_version_id: targetVersionId,
        p_idempotency_key: uuidInput(input, "idempotency_key"),
      });
      if (error) throw error;
      return { published_version_id: data, capabilities_changed: true };
    }
  }
}
