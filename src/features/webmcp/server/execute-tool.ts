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
};

function objectInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("tool_input_must_be_an_object");
  }

  return input as Record<string, unknown>;
}

function stringInput(input: Record<string, unknown>, name: string) {
  const value = input[name];

  if (typeof value !== "string" || !value) {
    throw new Error(`invalid_${name}`);
  }

  return value;
}

function integerInput(input: Record<string, unknown>, name: string) {
  const value = input[name];

  if (!Number.isInteger(value)) {
    throw new Error(`invalid_${name}`);
  }

  return value as number;
}

function isToolName(name: string): name is WebMcpToolName {
  return (WEBMCP_TOOL_NAMES as readonly string[]).includes(name);
}

async function resolveRequestCapabilities(request: ToolRequest) {
  if (request.organizationSlug) {
    return resolveAuthenticatedCapabilities(request.organizationSlug);
  }

  if (request.siteSlug) {
    return resolvePublicCapabilities(request.siteSlug);
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
      const { data, error } = await supabase
        .from("attention_items")
        .select("id, kind, title, summary, evidence, status, revision, created_at")
        .eq("organization_id", capabilities.organizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { attention: data };
    }

    case "create_action_plan": {
      const { data, error } = await supabase.rpc("create_action_plan", {
        p_attention_item_id: stringInput(input, "attention_item_id"),
        p_idempotency_key: stringInput(input, "idempotency_key"),
      });
      if (error) throw error;
      return { action_plan_id: data, capabilities_changed: true };
    }

    case "acknowledge_lead_attention": {
      const { data, error } = await supabase.rpc("acknowledge_lead_attention", {
        p_attention_item_id: stringInput(input, "attention_item_id"),
        p_expected_revision: integerInput(input, "expected_revision"),
      });
      if (error) throw error;
      return { revision: data, acknowledged: true, communication_sent: false, capabilities_changed: true };
    }

    case "get_site_content":
      return {
        site_slug: capabilities.siteSlug,
        draft: capabilities.scope === "authenticated" ? capabilities.draft ?? null : undefined,
        published: capabilities.published ?? null,
      };

    case "create_or_patch_site_draft": {
      if (!capabilities.siteId) throw new Error("site_unavailable");
      const content = input["content"];
      if (!content || typeof content !== "object" || Array.isArray(content)) {
        throw new Error("invalid_content");
      }
      const { data, error } = await supabase.rpc("create_or_patch_site_draft", {
        p_site_id: capabilities.siteId,
        p_expected_revision: integerInput(input, "expected_revision"),
        p_content: content as Json,
      });
      if (error) throw error;
      return { draft: data, capabilities_changed: true };
    }

    case "preview_publish_consequences": {
      if (!capabilities.draft) throw new Error("draft_unavailable");
      const { data, error } = await supabase.rpc("preview_publish_consequences", {
        p_draft_id: capabilities.draft.id,
      });
      if (error) throw error;
      return data;
    }

    case "publish_site_draft": {
      if (!capabilities.draft || !capabilities.activeApproval) {
        throw new Error("exact_owner_approval_required");
      }
      const { data, error } = await supabase.rpc("publish_site_draft", {
        p_draft_id: capabilities.draft.id,
        p_expected_revision: capabilities.draft.revision,
        p_approval_id: capabilities.activeApproval.id,
        p_consequence_hash: capabilities.activeApproval.consequenceHash,
        p_idempotency_key: stringInput(input, "idempotency_key"),
      });
      if (error) throw error;
      return { published_version_id: data, capabilities_changed: true };
    }

    case "get_opening_hours": {
      const content = publishedContent(capabilities);
      return {
        version_id: capabilities.published!.versionId,
        opening_hours: content["opening_hours"],
      };
    }

    case "list_site_versions":
      return {
        published_version_id: capabilities.published?.versionId ?? null,
        versions: capabilities.versions,
      };

    case "rollback_site_version": {
      if (!capabilities.siteId) throw new Error("site_unavailable");
      const targetVersionId = stringInput(input, "target_version_id");
      if (!capabilities.versions.some((version) => version.id === targetVersionId)) {
        throw new Error("target_version_unavailable");
      }
      const { data, error } = await supabase.rpc("rollback_site_version", {
        p_site_id: capabilities.siteId,
        p_target_version_id: targetVersionId,
        p_idempotency_key: stringInput(input, "idempotency_key"),
      });
      if (error) throw error;
      return { published_version_id: data, capabilities_changed: true };
    }
  }
}
