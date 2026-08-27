import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  acknowledgeLeadAttention,
  createActionPlan,
} from "@/features/attention/server/actions";
import { getViewer } from "@/features/auth/server/get-viewer";
import {
  approveSiteDraft,
  publishSiteDraft,
  rollbackSiteVersion,
  saveSiteDraft,
} from "@/features/publication/server/actions";
import { WebMcpRegistrar } from "@/features/webmcp/client/webmcp-registrar";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Attention · Kurogrid WebMCP",
};

type PageProps = {
  params: Promise<{ organizationSlug: string }>;
};

function contentObject(content: Json | undefined) {
  return content && typeof content === "object" && !Array.isArray(content)
    ? content
    : {};
}

function contentString(content: Record<string, Json | undefined>, key: string) {
  return typeof content[key] === "string" ? content[key] : "";
}

export default async function OrganizationWorkspacePage({ params }: PageProps) {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/auth/sign-in?next=/app");
  }

  const { organizationSlug } = await params;
  const membership = viewer.memberships.find(
    (candidate) => candidate.organizationSlug === organizationSlug,
  );

  if (!membership) {
    notFound();
  }

  const supabase = await createClient();
  const { data: attention, error: attentionError } = await supabase
    .from("attention_items")
    .select("id, kind, title, summary, evidence, status, revision, created_at")
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: false });

  if (attentionError) {
    throw new Error("Unable to load attention evidence.", {
      cause: attentionError,
    });
  }

  const attentionIds = attention.map((item) => item.id);
  const { data: plans, error: plansError } = attentionIds.length
    ? await supabase
        .from("action_plans")
        .select("id, attention_item_id, created_at")
        .in("attention_item_id", attentionIds)
    : { data: [], error: null };

  if (plansError) {
    throw new Error("Unable to load action plans.", { cause: plansError });
  }

  const planIds = plans.map((plan) => plan.id);
  const { data: steps, error: stepsError } = planIds.length
    ? await supabase
        .from("action_plan_steps")
        .select("action_plan_id, position, kind, title")
        .in("action_plan_id", planIds)
        .order("position")
    : { data: [], error: null };

  if (stepsError) {
    throw new Error("Unable to load action plan steps.", { cause: stepsError });
  }

  const { data: sites, error: sitesError } = await supabase
    .from("sites")
    .select("id, slug, published_version_id")
    .eq("organization_id", membership.organizationId)
    .order("created_at");

  if (sitesError) {
    throw new Error("Unable to load sites.", { cause: sitesError });
  }

  const siteIds = sites.map((site) => site.id);
  const { data: drafts, error: draftsError } = siteIds.length
    ? await supabase
        .from("site_drafts")
        .select("id, site_id, revision, content, updated_at")
        .in("site_id", siteIds)
    : { data: [], error: null };
  const { data: versions, error: versionsError } = siteIds.length
    ? await supabase
        .from("site_versions")
        .select("id, site_id, version_number, published_at")
        .in("site_id", siteIds)
        .order("version_number", { ascending: false })
    : { data: [], error: null };

  if (draftsError || versionsError) {
    throw new Error("Unable to load publication state.", {
      cause: draftsError ?? versionsError,
    });
  }

  const draftIds = drafts.map((draft) => draft.id);
  const { data: activeApprovals, error: approvalsError } = draftIds.length
    ? await supabase
        .from("publish_approvals")
        .select("id, draft_id, draft_revision, expires_at")
        .in("draft_id", draftIds)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
    : { data: [], error: null };

  if (approvalsError) {
    throw new Error("Unable to load exact approval state.", {
      cause: approvalsError,
    });
  }

  const capabilityContextKey = JSON.stringify([
    membership.role,
    attention.map((item) => [item.id, item.status, item.revision]),
    plans.map((plan) => plan.id),
    drafts.map((draft) => [draft.id, draft.revision]),
    sites.map((site) => site.published_version_id),
    versions.map((version) => version.id),
    activeApprovals.map((approval) => [
      approval.id,
      approval.draft_id,
      approval.draft_revision,
      approval.expires_at,
    ]),
  ]);

  return (
    <main className="workspace-shell">
      <header className="workspace-nav">
        <Link className="brand" href="/app">
          <span className="mark" aria-hidden="true">K</span>
          <span>{membership.organizationName}</span>
        </Link>
        <span className="role-badge">{membership.role}</span>
      </header>

      <WebMcpRegistrar
        organizationSlug={organizationSlug}
        contextKey={capabilityContextKey}
      />

      <section className="workspace-heading compact-heading">
        <p className="kicker">Evidence, not a CRM</p>
        <h1>Attention queue</h1>
        <p>
          Synthetic, non-PII signals become a fixed three-step plan. No provider
          is contacted and no general workflow is created.
        </p>
      </section>

      <section className="attention-grid" aria-label="Attention items">
        {attention.length ? attention.map((item) => {
          const plan = plans.find(
            (candidate) => candidate.attention_item_id === item.id,
          );
          const planSteps = plan
            ? steps.filter((step) => step.action_plan_id === plan.id)
            : [];

          return (
            <article className="attention-card" key={item.id}>
              <div className="attention-meta">
                <span>{item.kind.replaceAll("_", " ")}</span>
                <span>{item.status}</span>
              </div>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>

              {plan ? (
                <ol className="plan-steps">
                  {planSteps.map((step) => (
                    <li key={step.kind}>
                      <span>{String(step.position).padStart(2, "0")}</span>
                      {step.title}
                    </li>
                  ))}
                </ol>
              ) : (
                <form action={createActionPlan}>
                  <input name="organizationSlug" type="hidden" value={organizationSlug} />
                  <input name="attentionItemId" type="hidden" value={item.id} />
                  <button className="primary-action" type="submit">Create action plan</button>
                </form>
              )}

              {item.kind === "synthetic_lead" && item.status === "open" ? (
                <form action={acknowledgeLeadAttention}>
                  <input name="organizationSlug" type="hidden" value={organizationSlug} />
                  <input name="attentionItemId" type="hidden" value={item.id} />
                  <input name="expectedRevision" type="hidden" value={item.revision} />
                  <button className="secondary-action" type="submit">
                    Record follow-up acknowledgement
                  </button>
                </form>
              ) : null}
            </article>
          );
        }) : (
          <p className="empty-state">No synthetic evidence has been seeded yet.</p>
        )}
      </section>

      <section className="publication-section" aria-labelledby="publication-title">
        <div className="publication-heading">
          <p className="kicker">Human + agent surface</p>
          <h2 id="publication-title">Structured publication</h2>
        </div>

        {sites.map((site) => {
          const draft = drafts.find((candidate) => candidate.site_id === site.id);
          const siteVersions = versions.filter((version) => version.site_id === site.id);
          const content = contentObject(draft?.content);
          const hours = contentObject(content.opening_hours);

          return (
            <article className="publication-card" key={site.id}>
              <div className="attention-meta">
                <span>/{site.slug}</span>
                <span>{site.published_version_id ? "published" : "draft only"}</span>
              </div>

              <form className="publication-form" action={saveSiteDraft}>
                <input name="organizationSlug" type="hidden" value={organizationSlug} />
                <input name="siteId" type="hidden" value={site.id} />
                <input name="draftId" type="hidden" value={draft?.id ?? ""} />
                <input name="revision" type="hidden" value={draft?.revision ?? 0} />
                <label>Headline<input name="headline" defaultValue={contentString(content, "headline")} required /></label>
                <label>Summary<textarea name="summary" defaultValue={contentString(content, "summary")} required /></label>
                <div className="field-pair">
                  <label>Weekdays<input name="weekdayHours" defaultValue={contentString(hours, "weekdays")} required /></label>
                  <label>Saturday<input name="saturdayHours" defaultValue={contentString(hours, "saturday")} required /></label>
                </div>
                <label>CTA label<input name="ctaLabel" defaultValue={contentString(content, "cta_label")} required /></label>
                <button className="primary-action" type="submit">Save revision</button>
              </form>

              {draft ? (
                <div className="publication-actions">
                  <span>Draft revision {draft.revision}</span>
                  {membership.role === "owner" ? (
                    <>
                      <form action={approveSiteDraft}>
                        <input name="organizationSlug" type="hidden" value={organizationSlug} />
                        <input name="siteId" type="hidden" value={site.id} />
                        <input name="draftId" type="hidden" value={draft.id} />
                        <input name="revision" type="hidden" value={draft.revision} />
                        <button className="secondary-action" type="submit">Approve exact preview</button>
                      </form>
                      <form action={publishSiteDraft}>
                        <input name="organizationSlug" type="hidden" value={organizationSlug} />
                        <input name="siteId" type="hidden" value={site.id} />
                        <input name="draftId" type="hidden" value={draft.id} />
                        <input name="revision" type="hidden" value={draft.revision} />
                        <button className="primary-action" type="submit">Publish approved revision</button>
                      </form>
                    </>
                  ) : <span className="member-note">Member can draft and preview; Owner publishes.</span>}
                </div>
              ) : null}

              {siteVersions.length ? (
                <div className="version-list">
                  <Link href={`/sites/${site.slug}`}>Open public version ↗</Link>
                  {siteVersions.map((version) => (
                    <div key={version.id}>
                      <span>Version {version.version_number}</span>
                      {membership.role === "owner" && version.id !== site.published_version_id ? (
                        <form action={rollbackSiteVersion}>
                          <input name="organizationSlug" type="hidden" value={organizationSlug} />
                          <input name="siteId" type="hidden" value={site.id} />
                          <input name="targetVersionId" type="hidden" value={version.id} />
                          <button className="text-button" type="submit">Restore as new version</button>
                        </form>
                      ) : <span>{version.id === site.published_version_id ? "Current" : "History"}</span>}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
