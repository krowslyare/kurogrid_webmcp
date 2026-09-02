import "server-only";

import { getViewer } from "@/features/auth/server/get-viewer";
import { createClient } from "@/lib/supabase/server";

import {
  type AvailabilityPlanStatus,
  definitionsForNames,
  toolNamesForState,
  type WebMcpToolName,
} from "../contracts";

type AttentionItem = {
  id: string;
  kind: "synthetic_lead" | "analytics_snapshot" | "verified_fact";
  status: "open" | "acknowledged";
  revision: number;
};

type AppointmentStatus =
  | "prepared"
  | "requested"
  | "confirmed"
  | "time_proposed"
  | "declined"
  | "cancelled";

type AvailabilityPlanRow = {
  id: string;
  status: string;
  base_configuration_revision: number;
  plan_hash: string;
  approval_expires_at: string | null;
};

type LatestAvailabilityPlan = {
  id: string;
  status: AvailabilityPlanStatus;
  baseConfigurationRevision: number;
  planHash: string;
  approvalExpiresAt: string | null;
  canApply: boolean;
};

type AvailabilityProposalQuery = {
  select(columns: string): AvailabilityProposalQuery;
  eq(column: string, value: string): AvailabilityProposalQuery;
  order(column: string, options: { ascending: boolean }): AvailabilityProposalQuery;
  limit(count: number): AvailabilityProposalQuery;
  maybeSingle(): Promise<{ data: unknown; error: unknown | null }>;
};

type AvailabilityProposalClient = {
  from(relation: string): AvailabilityProposalQuery;
};

function isAvailabilityPlanStatus(value: unknown): value is AvailabilityPlanStatus {
  return value === "prepared" || value === "approved" || value === "applied";
}

async function resolveLatestAvailabilityPlan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  siteId: string,
): Promise<LatestAvailabilityPlan | undefined> {
  const result = await (supabase as unknown as AvailabilityProposalClient)
    .from("availability_plans")
    .select("id, status, base_configuration_revision, plan_hash, approval_expires_at")
    .eq("organization_id", organizationId)
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw new Error("Unable to resolve availability capability state.", {
      cause: result.error,
    });
  }
  if (!result.data) return undefined;

  const row = result.data as unknown as AvailabilityPlanRow;
  if (
    typeof row.id !== "string"
    || !isAvailabilityPlanStatus(row.status)
    || !Number.isInteger(row.base_configuration_revision)
    || typeof row.plan_hash !== "string"
  ) {
    return undefined;
  }

  const approvalExpiresAt = typeof row.approval_expires_at === "string"
    ? row.approval_expires_at
    : null;

  return {
    id: row.id,
    status: row.status,
    baseConfigurationRevision: row.base_configuration_revision,
    planHash: row.plan_hash,
    approvalExpiresAt,
    canApply: row.status === "approved"
      && Boolean(approvalExpiresAt)
      && new Date(approvalExpiresAt!).getTime() > Date.now(),
  };
}

export type ResolvedCapabilities = {
  scope: "public" | "authenticated";
  role?: "owner" | "member";
  organizationId?: string;
  organizationSlug?: string;
  siteId?: string;
  siteSlug?: string;
  draft?: { id: string; revision: number; content: unknown };
  published?: { versionId: string; content: unknown };
  activeApproval?: { id: string; consequenceHash: string };
  latestAvailabilityPlan?: LatestAvailabilityPlan;
  attention: AttentionItem[];
  versions: Array<{ id: string; versionNumber: number }>;
  appointment?: {
    id: string;
    accessToken: string;
    confirmationToken?: string;
    status: AppointmentStatus;
    details: unknown;
  };
  names: WebMcpToolName[];
  definitions: ReturnType<typeof definitionsForNames>;
  signature: string;
};

export async function resolvePublicCapabilities(
  siteSlug: string,
  appointmentId?: string,
  accessToken?: string,
  confirmationToken?: string,
): Promise<ResolvedCapabilities> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_published_site", {
    p_slug: siteSlug,
  });
  const row = data?.[0];

  if (error) {
    throw new Error("Unable to resolve published WebMCP capabilities.", {
      cause: error,
    });
  }

  const appointmentResult = appointmentId && accessToken
    ? await supabase.rpc("get_appointment_status", {
        p_request_id: appointmentId,
        p_access_token: accessToken,
      })
    : { data: null, error: null };

  if (appointmentResult.error) {
    throw new Error("Unable to resolve appointment context.", {
      cause: appointmentResult.error,
    });
  }

  const appointment = appointmentResult.data && typeof appointmentResult.data === "object"
    ? appointmentResult.data as Record<string, unknown>
    : null;
  const appointmentStatus = typeof appointment?.status === "string"
    ? appointment.status as AppointmentStatus
    : undefined;
  const names = toolNamesForState({
    scope: "public",
    hasAttention: false,
    hasUnplannedAttention: false,
    hasOpenLead: false,
    hasSite: Boolean(row),
    hasDraft: false,
    hasPublished: Boolean(row),
    hasActiveApproval: false,
    versionCount: row ? 1 : 0,
    appointmentStatus,
    canConfirmAppointment: Boolean(confirmationToken),
  });

  return {
    scope: "public",
    siteSlug,
    published: row
      ? { versionId: row.version_id, content: row.content }
      : undefined,
    attention: [],
    versions: row ? [{ id: row.version_id, versionNumber: row.version_number }] : [],
    appointment: appointmentId && accessToken && appointmentStatus
      ? {
          id: appointmentId,
          accessToken,
          confirmationToken,
          status: appointmentStatus,
          details: appointment,
        }
      : undefined,
    names,
    definitions: definitionsForNames(names),
    signature: JSON.stringify([
      siteSlug,
      row?.version_id ?? null,
      appointmentId ?? null,
      appointmentStatus ?? null,
      names,
    ]),
  };
}

export async function resolveAuthenticatedCapabilities(
  organizationSlug: string,
): Promise<ResolvedCapabilities | null> {
  const viewer = await getViewer();
  const membership = viewer?.memberships.find(
    (candidate) => candidate.organizationSlug === organizationSlug,
  );

  if (!membership) {
    return null;
  }

  const supabase = await createClient();
  const attentionResult = await supabase
    .from("attention_items")
    .select("id, kind, status, revision")
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: false });
  const plansResult = await supabase
    .from("action_plans")
    .select("attention_item_id")
    .eq("organization_id", membership.organizationId);
  const siteResult = await supabase
    .from("sites")
    .select("id, slug, published_version_id")
    .eq("organization_id", membership.organizationId)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (attentionResult.error || plansResult.error || siteResult.error) {
    throw new Error("Unable to resolve authenticated WebMCP capabilities.", {
      cause: attentionResult.error ?? plansResult.error ?? siteResult.error,
    });
  }

  const site = siteResult.data;
  const draftResult = site
    ? await supabase
        .from("site_drafts")
        .select("id, revision, content")
        .eq("site_id", site.id)
        .maybeSingle()
    : { data: null, error: null };
  const versionsResult = site
    ? await supabase
        .from("site_versions")
        .select("id, version_number, content")
        .eq("site_id", site.id)
        .order("version_number", { ascending: false })
    : { data: [], error: null };

  if (draftResult.error || versionsResult.error) {
    throw new Error("Unable to resolve site capability state.", {
      cause: draftResult.error ?? versionsResult.error,
    });
  }

  const draft = draftResult.data;
  const activeApprovalResult =
    membership.role === "owner" && draft
      ? await supabase
          .from("publish_approvals")
          .select("id, consequence_hash")
          .eq("draft_id", draft.id)
          .eq("draft_revision", draft.revision)
          .is("consumed_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("approved_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null, error: null };

  if (activeApprovalResult.error) {
    throw new Error("Unable to resolve approval capability state.", {
      cause: activeApprovalResult.error,
    });
  }

  const latestAvailabilityPlan = site && membership.role === "owner"
    ? await resolveLatestAvailabilityPlan(
        supabase,
        membership.organizationId,
        site.id,
      )
    : undefined;

  const plannedAttention = new Set(
    plansResult.data.map((plan) => plan.attention_item_id),
  );
  const attention = attentionResult.data;
  const versions = versionsResult.data;
  const names = toolNamesForState({
    scope: "authenticated",
    role: membership.role,
    hasAttention: attention.length > 0,
    hasUnplannedAttention: attention.some((item) => !plannedAttention.has(item.id)),
    hasOpenLead: attention.some(
      (item) => item.kind === "synthetic_lead" && item.status === "open",
    ),
    hasSite: Boolean(site),
    hasDraft: Boolean(draft),
    hasPublished: Boolean(site?.published_version_id),
    hasActiveApproval: Boolean(activeApprovalResult.data),
    versionCount: versions.length,
    latestAvailabilityPlanStatus: latestAvailabilityPlan?.canApply
      ? "approved"
      : latestAvailabilityPlan?.status === "approved"
        ? "prepared"
        : latestAvailabilityPlan?.status,
  });
  const publishedVersion = versions.find(
    (version) => version.id === site?.published_version_id,
  );

  return {
    scope: "authenticated",
    role: membership.role,
    organizationId: membership.organizationId,
    organizationSlug,
    siteId: site?.id,
    siteSlug: site?.slug,
    draft: draft
      ? { id: draft.id, revision: draft.revision, content: draft.content }
      : undefined,
    published: publishedVersion
      ? { versionId: publishedVersion.id, content: publishedVersion.content }
      : undefined,
    activeApproval: activeApprovalResult.data
      ? {
          id: activeApprovalResult.data.id,
          consequenceHash: activeApprovalResult.data.consequence_hash,
        }
      : undefined,
    latestAvailabilityPlan,
    attention,
    versions: versions.map((version) => ({
      id: version.id,
      versionNumber: version.version_number,
    })),
    names,
    definitions: definitionsForNames(names),
    signature: JSON.stringify([
      membership.role,
      attention.map((item) => [item.id, item.status, item.revision]),
      draft ? [draft.id, draft.revision] : null,
      site?.published_version_id ?? null,
      activeApprovalResult.data?.id ?? null,
      latestAvailabilityPlan
        ? [
            latestAvailabilityPlan.id,
            latestAvailabilityPlan.status,
            latestAvailabilityPlan.baseConfigurationRevision,
            latestAvailabilityPlan.planHash,
            latestAvailabilityPlan.approvalExpiresAt,
          ]
        : null,
      versions.map((version) => version.id),
      names,
    ]),
  };
}
