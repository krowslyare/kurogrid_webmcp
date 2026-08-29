import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  acknowledgeLeadAttention,
  createActionPlan,
} from "@/features/attention/server/actions";
import { updateAppointmentFromOwner } from "@/features/appointments/server/actions";
import { KuroBrand } from "@/components/KuroBrand";
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
  title: "Website update · Kuro Agent",
};

type PageProps = {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ appointment?: string; mode?: string }>;
};

function contentObject(content: Json | undefined) {
  return content && typeof content === "object" && !Array.isArray(content)
    ? content
    : {};
}

function contentString(content: Record<string, Json | undefined>, key: string) {
  return typeof content[key] === "string" ? content[key] : "";
}

const evidenceLabels: Record<string, string> = {
  synthetic_lead: "Customer question",
  analytics_snapshot: "Demand signal",
  verified_fact: "Approved business fact",
};

function appointmentTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

export default async function OrganizationWorkspacePage({ params, searchParams }: PageProps) {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/auth/sign-in?next=/app");
  }

  const { organizationSlug } = await params;
  const notice = await searchParams;
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
        .select("id, site_id, version_number, published_at, source_draft_id, source_draft_revision")
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

  const { data: appointmentRequests, error: appointmentError } = await supabase
    .from("appointment_requests")
    .select("id, status, pet_name, customer_email, proposed_starts_at, created_at, clinic_services(name, duration_minutes), appointment_slots(starts_at)")
    .eq("organization_id", membership.organizationId)
    .neq("status", "prepared")
    .order("created_at", { ascending: false });

  if (appointmentError) {
    throw new Error("Unable to load customer appointment requests.", {
      cause: appointmentError,
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
    appointmentRequests.map((request) => [request.id, request.status, request.proposed_starts_at]),
  ]);

  const guidedAttention = attention.find((item) => item.kind === "synthetic_lead")
    ?? attention[0];
  const guidedPlan = guidedAttention
    ? plans.find((plan) => plan.attention_item_id === guidedAttention.id)
    : undefined;
  const guidedPlanSteps = guidedPlan
    ? steps.filter((step) => step.action_plan_id === guidedPlan.id)
    : [];
  const firstSite = sites[0];
  const firstDraft = firstSite
    ? drafts.find((draft) => draft.site_id === firstSite.id)
    : undefined;
  const firstSiteApproved = firstDraft
    ? activeApprovals.some(
        (approval) => approval.draft_id === firstDraft.id
          && approval.draft_revision === firstDraft.revision,
      )
    : false;
  const firstPublishedVersion = versions.find(
    (version) => version.id === firstSite?.published_version_id,
  );
  const currentDraftIsPublished = Boolean(
    firstDraft
      && firstPublishedVersion?.source_draft_id === firstDraft.id
      && firstPublishedVersion.source_draft_revision === firstDraft.revision,
  );
  const currentStep = currentDraftIsPublished ? 4 : firstSiteApproved ? 4 : firstDraft ? 3 : guidedPlan ? 2 : 1;
  const workspaceTitle = currentDraftIsPublished
    ? "The Saturday update is live."
    : firstSiteApproved
      ? "The exact draft is approved. Publish when ready."
      : firstDraft
        ? "Review the draft before it goes live."
        : guidedPlan
          ? "The opportunity is clear. Prepare the website change."
          : "Turn Saturday demand into a live website update.";

  return (
    <main className="workspace-shell">
      <header className="workspace-nav">
        <KuroBrand href="/app" label={membership.organizationName} suffix="Guided demo" />
        <div className="workspace-nav-meta">
          <Link href="/app">Switch workspace</Link>
          <span className="role-badge">{membership.role}</span>
        </div>
      </header>

      <section className="appointment-inbox" aria-labelledby="appointment-inbox-title">
        <div className="appointment-inbox-heading">
          <div>
            <p className="kicker">Customer activity · WebMCP</p>
            <h1 id="appointment-inbox-title">
              {appointmentRequests.length
                ? `${appointmentRequests[0].pet_name} is asking for Saturday care.`
                : "Let a customer agent start the story."}
            </h1>
          </div>
          <p>
            {appointmentRequests.length
              ? "Respond once. Email brings the customer back if the appointment changes."
              : "Open the public clinic and ask an assistant to find a dermatology appointment."}
          </p>
        </div>

        {notice.appointment ? (
          <p className={`appointment-notice is-${notice.appointment}`}>
            {notice.appointment === "sent"
              ? "Appointment updated · customer email accepted by Resend."
              : notice.appointment === "preview"
                ? "Appointment updated · demo email preview is ready."
                : "Appointment updated · email delivery failed, but the customer link still works."}
          </p>
        ) : null}

        {appointmentRequests.length ? (
          <div className="appointment-request-list">
            {appointmentRequests.map((request) => {
              const requestedAt = request.appointment_slots.starts_at;
              const nextProposal = new Date(new Date(requestedAt).getTime() + 60 * 60_000).toISOString();
              return (
                <article key={request.id}>
                  <div className="appointment-request-main">
                    <span className={`appointment-status is-${request.status}`}>{request.status.replaceAll("_", " ")}</span>
                    <h2>{request.pet_name} · {request.clinic_services.name}</h2>
                    <p>{appointmentTime(request.proposed_starts_at ?? requestedAt)} · {request.clinic_services.duration_minutes} minutes</p>
                    <small>Updates go to {request.customer_email}</small>
                  </div>
                  {membership.role === "owner" && request.status === "requested" ? (
                    <div className="appointment-owner-actions">
                      <form action={updateAppointmentFromOwner}>
                        <input name="organizationSlug" type="hidden" value={organizationSlug} />
                        <input name="requestId" type="hidden" value={request.id} />
                        <input name="decision" type="hidden" value="confirm" />
                        <button className="primary-action" type="submit">Accept requested time</button>
                      </form>
                      <form action={updateAppointmentFromOwner}>
                        <input name="organizationSlug" type="hidden" value={organizationSlug} />
                        <input name="requestId" type="hidden" value={request.id} />
                        <input name="decision" type="hidden" value="propose" />
                        <input name="proposedStartsAt" type="hidden" value={nextProposal} />
                        <button className="secondary-action" type="submit">Propose {appointmentTime(nextProposal)}</button>
                      </form>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="appointment-empty">
            <span>01</span>
            <div><strong>No appointment requests yet</strong><p>The customer journey starts on Arboleda, not in this workspace.</p></div>
            {firstSite ? <Link href={`/sites/${firstSite.slug}`}>Open customer experience ↗</Link> : null}
          </div>
        )}
      </section>

      <section className="workspace-heading guided-heading">
        <p className="kicker">Then adapt the business · Step {currentStep} of 4</p>
        <h2>{workspaceTitle}</h2>
        <p>
          Follow one fictional clinic update from business evidence to a public,
          reversible website change.
        </p>
        <ol className="workspace-progress" aria-label="Website update progress">
          {[
            [1, "Understand", "Review the opportunity"],
            [2, "Draft", "Prepare the website change"],
            [3, "Approve", "Owner reviews the exact draft"],
            [4, "Publish", "Make it live or roll it back"],
          ].map(([step, label, description]) => (
            <li
              className={Number(step) < currentStep ? "is-complete" : Number(step) === currentStep ? "is-current" : ""}
              key={String(step)}
            >
              <span>{String(step).padStart(2, "0")}</span>
              <div><strong>{label}</strong><small>{description}</small></div>
            </li>
          ))}
        </ol>
      </section>

      <WebMcpRegistrar
        organizationSlug={organizationSlug}
        contextKey={capabilityContextKey}
      />

      <section className="opportunity-section" aria-labelledby="opportunity-title">
        <div className="workspace-section-heading">
          <p className="kicker">01 · Understand</p>
          <h2 id="opportunity-title">Why should the website change?</h2>
          <p>
            Weekend interest is visible, a customer has asked about Saturday,
            and the clinic has already approved the hours.
          </p>
        </div>

        <div className="evidence-list" aria-label="Evidence behind the website update">
          {attention.length ? attention.map((item, index) => (
            <article key={item.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <p>{evidenceLabels[item.kind] ?? "Business evidence"}</p>
                <h3>{item.title}</h3>
                <small>{item.summary}</small>
              </div>
              <strong>{item.status === "acknowledged" ? "Reviewed" : "Ready"}</strong>
            </article>
          )) : <p className="empty-state">No demo evidence is available.</p>}
        </div>

        {guidedAttention ? (
          <div className="guided-action">
            <div>
              <p className="kicker">Recommended next step</p>
              <h3>{guidedPlan ? "The change plan is ready." : "Turn these signals into one bounded plan."}</h3>
              <p>
                {guidedPlan
                  ? "Continue below to prepare the exact website content."
                  : "The plan always contains three fixed steps and cannot become a general workflow."}
              </p>
            </div>
            {guidedPlan ? (
              <ol className="plan-steps">
                {guidedPlanSteps.map((step) => (
                  <li key={step.kind}>
                    <span>{String(step.position).padStart(2, "0")}</span>
                    {step.title}
                  </li>
                ))}
              </ol>
            ) : (
              <form action={createActionPlan}>
                <input name="organizationSlug" type="hidden" value={organizationSlug} />
                <input name="attentionItemId" type="hidden" value={guidedAttention.id} />
                <button className="primary-action" type="submit">Create the website update plan</button>
              </form>
            )}
            {guidedAttention.kind === "synthetic_lead" && guidedAttention.status === "open" ? (
              <form action={acknowledgeLeadAttention}>
                <input name="organizationSlug" type="hidden" value={organizationSlug} />
                <input name="attentionItemId" type="hidden" value={guidedAttention.id} />
                <input name="expectedRevision" type="hidden" value={guidedAttention.revision} />
                <button className="secondary-action" type="submit">Mark customer question as reviewed</button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="publication-section" aria-labelledby="publication-title">
        <div className="publication-heading">
          <div>
            <p className="kicker">02–04 · Draft, approve, publish</p>
            <h2 id="publication-title">Prepare the exact website update.</h2>
          </div>
          <p>Save the content, let the Owner approve that exact draft, then publish it to the public site and WebMCP together.</p>
        </div>

        {sites.map((site) => {
          const draft = drafts.find((candidate) => candidate.site_id === site.id);
          const siteVersions = versions.filter((version) => version.site_id === site.id);
          const publishedVersion = siteVersions.find(
            (version) => version.id === site.published_version_id,
          );
          const content = contentObject(draft?.content);
          const hours = contentObject(content.opening_hours);
          const hasExactApproval = draft
            ? activeApprovals.some(
                (approval) => approval.draft_id === draft.id
                  && approval.draft_revision === draft.revision,
              )
            : false;
          const isCurrentDraftPublished = Boolean(
            draft
              && publishedVersion?.source_draft_id === draft.id
              && publishedVersion.source_draft_revision === draft.revision,
          );

          return (
            <article className="publication-card" key={site.id}>
              <div className="publication-status">
                <div><span>01</span><strong>{draft ? `Draft v${draft.revision}` : "Draft not started"}</strong></div>
                <div><span>02</span><strong>{hasExactApproval ? "Owner approved" : isCurrentDraftPublished ? "Approval used" : "Approval required"}</strong></div>
                <div><span>03</span><strong>{site.published_version_id ? "Website live" : "Not published"}</strong></div>
              </div>

              <form className="publication-form" action={saveSiteDraft}>
                <input name="organizationSlug" type="hidden" value={organizationSlug} />
                <input name="siteId" type="hidden" value={site.id} />
                <input name="draftId" type="hidden" value={draft?.id ?? ""} />
                <input name="revision" type="hidden" value={draft?.revision ?? 0} />
                <label>Page headline<input name="headline" defaultValue={contentString(content, "headline")} required /></label>
                <label>Short introduction<textarea name="summary" defaultValue={contentString(content, "summary")} required /></label>
                <div className="field-pair">
                  <label>Monday–Friday hours<input name="weekdayHours" defaultValue={contentString(hours, "weekdays")} required /></label>
                  <label>Saturday hours<input name="saturdayHours" defaultValue={contentString(hours, "saturday")} required /></label>
                </div>
                <label>Primary button label<input name="ctaLabel" defaultValue={contentString(content, "cta_label")} required /></label>
                <button className="primary-action" type="submit">Save website draft</button>
              </form>

              {draft ? (
                <div className="publication-actions">
                  <span>Draft v{draft.revision} is saved. Every edit requires a new approval.</span>
                  {membership.role === "owner" ? (
                    <>
                      <form action={approveSiteDraft}>
                        <input name="organizationSlug" type="hidden" value={organizationSlug} />
                        <input name="siteId" type="hidden" value={site.id} />
                        <input name="draftId" type="hidden" value={draft.id} />
                        <input name="revision" type="hidden" value={draft.revision} />
                        <button className="secondary-action" disabled={hasExactApproval || isCurrentDraftPublished} type="submit">
                          {isCurrentDraftPublished ? "Published draft" : hasExactApproval ? "Exact draft approved" : "Approve this exact draft"}
                        </button>
                      </form>
                      <form action={publishSiteDraft}>
                        <input name="organizationSlug" type="hidden" value={organizationSlug} />
                        <input name="siteId" type="hidden" value={site.id} />
                        <input name="draftId" type="hidden" value={draft.id} />
                        <input name="revision" type="hidden" value={draft.revision} />
                        <button
                          className="primary-action"
                          disabled={!hasExactApproval || isCurrentDraftPublished}
                          title={hasExactApproval || isCurrentDraftPublished ? undefined : "Approve this exact revision before publishing."}
                          type="submit"
                        >
                          {isCurrentDraftPublished ? "Website is live" : "Publish to the live website"}
                        </button>
                      </form>
                    </>
                  ) : <span className="member-note">Your Member role can prepare drafts. An Owner must approve and publish.</span>}
                </div>
              ) : null}

              {siteVersions.length ? (
                <div className="version-list">
                  <Link href={`/sites/${site.slug}`}>View the live website ↗</Link>
                  <details>
                    <summary>Publication history · {siteVersions.length} version{siteVersions.length === 1 ? "" : "s"}</summary>
                    {siteVersions.map((version) => (
                      <div key={version.id}>
                        <span>Version {version.version_number}</span>
                        {membership.role === "owner" && version.id !== site.published_version_id ? (
                          <form action={rollbackSiteVersion}>
                            <input name="organizationSlug" type="hidden" value={organizationSlug} />
                            <input name="siteId" type="hidden" value={site.id} />
                            <input name="targetVersionId" type="hidden" value={version.id} />
                            <button className="text-button" type="submit">Restore this version</button>
                          </form>
                        ) : <span>{version.id === site.published_version_id ? "Currently live" : "Previous"}</span>}
                      </div>
                    ))}
                  </details>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
