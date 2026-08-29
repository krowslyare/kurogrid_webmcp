import "server-only";

import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

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

function integerInput(
  input: Record<string, unknown>,
  name: string,
  minimum: number,
) {
  const value = input[name];

  if (!Number.isInteger(value) || (value as number) < minimum) {
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
      const title = `${String(details.service)} for ${String(details.pet_name)} · Arboleda`;
      const google = new URL("https://calendar.google.com/calendar/render");
      google.searchParams.set("action", "TEMPLATE");
      google.searchParams.set("text", title);
      google.searchParams.set("dates", `${calendarStamp(startsAt)}/${calendarStamp(endsAt)}`);
      google.searchParams.set("details", "Confirmed through Arboleda's WebMCP appointment flow.");
      google.searchParams.set("location", "Clínica Veterinaria Arboleda");
      const calendarSearch = new URLSearchParams({
        appointment: capabilities.appointment.id,
        access: capabilities.appointment.accessToken,
      });
      return {
        event: {
          title,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          location: "Clínica Veterinaria Arboleda",
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
