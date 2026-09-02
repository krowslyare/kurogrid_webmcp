import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  acknowledgeLeadAttention,
  createActionPlan,
} from "@/features/attention/server/actions";
import { updateAppointmentFromOwner } from "@/features/appointments/server/actions";
import { KuroBrand } from "@/components/KuroBrand";
import { WorkspacePulseIllustration } from "@/components/ProductIllustrations";
import { getViewer } from "@/features/auth/server/get-viewer";
import { AvailabilityControlRoom } from "@/features/availability/ui/AvailabilityControlRoom";
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
  title: "Mimo clinic workspace · Kuro Agent",
  icons: {
    icon: [{ url: "/mimo-icon.svg", type: "image/svg+xml" }],
    shortcut: "/mimo-icon.svg",
  },
};

type PageProps = {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ appointment?: string; mode?: string; availability?: string; tab?: string }>;
};

function contentObject(content: Json | undefined) {
  return content && typeof content === "object" && !Array.isArray(content)
    ? content
    : {};
}

function contentString(content: Record<string, Json | undefined>, key: string) {
  return typeof content[key] === "string" ? content[key] : "";
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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
        .select("id, site_id, version_number, published_at, source_draft_id, source_draft_revision, content")
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
    .select("id, access_token, status, pet_name, customer_email, proposed_starts_at, created_at, service_id, site_id, clinic_services(name, duration_minutes), appointment_slots(starts_at)")
    .eq("organization_id", membership.organizationId)
    .neq("status", "prepared")
    .order("created_at", { ascending: false });

  if (appointmentError) {
    throw new Error("Unable to load customer appointment requests.", {
      cause: appointmentError,
    });
  }

  // Proposal alternatives must be real, currently available slots — the same
  // state the availability plan derives — never a blind offset from the
  // requested time.
  const proposalServiceIds = Array.from(
    new Set(
      appointmentRequests
        .filter((request) => request.status === "requested")
        .map((request) => request.service_id),
    ),
  );
  const { data: availableSlots, error: availableSlotsError } = proposalServiceIds.length
    ? await supabase
        .from("appointment_slots")
        .select("service_id, starts_at")
        .in("site_id", siteIds)
        .in("service_id", proposalServiceIds)
        .eq("available", true)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
    : { data: [], error: null };

  if (availableSlotsError) {
    throw new Error("Unable to load proposal alternatives.", {
      cause: availableSlotsError,
    });
  }

  // The availability vertical can be deployed before its optional plan table is
  // present in a local database. Keep the existing workspace usable in that
  // case; the control room renders an honest empty state instead of a fixture
  // pretending to be a persisted plan.
  const availabilityDb = supabase as unknown as SupabaseClient;
  const { data: latestAvailabilityPlan, error: availabilityPlanError } = await availabilityDb
    .from("availability_plans")
    .select("*")
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const availabilityPlan = availabilityPlanError
    ? null
    : objectRecord(latestAvailabilityPlan);

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
    availabilityPlan
      ? [
          availabilityPlan.id ?? availabilityPlan.plan_id ?? availabilityPlan.availability_plan_id ?? null,
          availabilityPlan.status ?? availabilityPlan.plan_status ?? availabilityPlan.state ?? null,
          availabilityPlan.base_configuration_revision ?? null,
          availabilityPlan.plan_hash ?? null,
          availabilityPlan.configuration ?? null,
          availabilityPlan.preview ?? null,
          availabilityPlan.applied_result ?? null,
        ]
      : null,
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
    ? "Saturday care is live for customers and agents."
    : firstSiteApproved
      ? "The approved update is ready to publish."
      : firstDraft
        ? "Review the exact change before it goes live."
        : guidedPlan
          ? "The evidence is clear. Shape the Saturday message."
          : "Keep Mimo accurate for customers and their assistants.";
  const isMimoDemo = organizationSlug.startsWith("mimo-demo-") || organizationSlug.includes("mimo");
  const currentTab = notice.tab === "appointments" || Boolean(notice.appointment)
    ? "appointments"
    : notice.tab === "website"
      ? "website"
      : "schedule";
  const actionableAppointment = appointmentRequests.find((request) => request.status === "requested");
  const pendingAppointmentsCount = appointmentRequests.filter((request) => request.status === "requested").length;
  const appointmentInboxTitle = actionableAppointment
    ? `${actionableAppointment.pet_name} needs a reply.`
    : "Customer appointments";
  const appointmentInboxDescription = actionableAppointment
    ? "Respond once. Email brings the customer back if the appointment changes."
    : "Review requested appointments, accept times, or propose alternative openings.";

  return (
    <main className={`workspace-shell${isMimoDemo ? " clinic-workspace-shell" : ""}`}>
      <header className={`workspace-nav${isMimoDemo ? " clinic-workspace-nav" : ""}`}>
        {isMimoDemo ? (
          <Link className="clinic-workspace-brand" href={`/app/${organizationSlug}`} aria-label="Mimo staff workspace">
            <span className="clinic-workspace-mark" aria-hidden="true">
              <svg viewBox="0 0 40 40" role="presentation">
                <circle cx="11" cy="13" r="4" />
                <circle cx="20" cy="9" r="4" />
                <circle cx="29" cy="13" r="4" />
                <circle cx="33" cy="22" r="4" />
                <path d="M20 17c-7 0-12 6-12 12 0 4 3 6 7 5 3-1 4-3 5-3s2 2 5 3c4 1 7-1 7-5 0-6-5-12-12-12Z" />
              </svg>
            </span>
            <span><strong>Mimo</strong><small>Staff workspace</small></span>
          </Link>
        ) : (
          <KuroBrand href="/app" label={membership.organizationName} suffix="Guided demo" />
        )}
        {isMimoDemo ? (
          <nav className="clinic-workspace-tabs" aria-label="Workspace sections">
            <Link
              className={currentTab === "schedule" ? "is-active" : ""}
              href={`/app/${organizationSlug}?tab=schedule`}
            >
              Schedule
            </Link>
            <Link
              className={currentTab === "appointments" ? "is-active" : ""}
              href={`/app/${organizationSlug}?tab=appointments`}
            >
              Appointments
              {pendingAppointmentsCount > 0 ? (
                <span className="tab-badge">{pendingAppointmentsCount}</span>
              ) : null}
            </Link>
            <Link
              className={currentTab === "website" ? "is-active" : ""}
              href={`/app/${organizationSlug}?tab=website`}
            >
              Website
            </Link>
          </nav>
        ) : null}
        <div className="workspace-nav-meta">
          {isMimoDemo && firstSite ? (
            <Link href={`/sites/${firstSite.slug}`}>
              View customer site
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
              </svg>
            </Link>
          ) : <Link href="/app">Switch workspace</Link>}
          <span className="role-badge">{membership.role}</span>
        </div>
      </header>

      {currentTab === "schedule" ? (
        <>
          {isMimoDemo ? (
            <section className="clinic-workspace-intro" aria-labelledby="clinic-workspace-title">
              <div>
                <p>Clinic operations</p>
                <h1 id="clinic-workspace-title">Schedule &amp; Availability</h1>
                <span>Turn calendar conflicts and working-hour rules into one exact schedule update, then let affected customers decide.</span>
              </div>
              <aside>
                <small>Current task</small>
                <strong>September dermatology hours</strong>
                <span>One Owner request can update the schedule and prepare the customer notice</span>
              </aside>
            </section>
          ) : null}

          <AvailabilityControlRoom
            organizationSlug={organizationSlug}
            role={membership.role}
            plan={availabilityPlan}
            appointments={appointmentRequests.map((request) => ({
              id: request.id,
              proposed_starts_at: request.proposed_starts_at,
              starts_at: request.appointment_slots.starts_at,
              status: request.status,
            }))}
            notice={notice.availability}
          />

          {pendingAppointmentsCount > 0 ? (
            <div className="workspace-appointment-callout">
              <div>
                <span className="kicker">Needs staff attention</span>
                <strong>{pendingAppointmentsCount} customer booking request awaiting reply</strong>
              </div>
              <Link className="primary-action" href={`/app/${organizationSlug}?tab=appointments`}>
                Open appointments
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
                </svg>
              </Link>
            </div>
          ) : null}
        </>
      ) : null}

      {currentTab === "appointments" ? (
        <>
          {isMimoDemo ? (
            <section className="clinic-workspace-intro" aria-labelledby="appointment-inbox-title">
              <div>
                <p>Customer booking requests</p>
                <h1 id="appointment-inbox-title">{appointmentInboxTitle}</h1>
                <span>{appointmentInboxDescription}</span>
              </div>
              <aside>
                <small>Inbox summary</small>
                <strong>{pendingAppointmentsCount ? `${pendingAppointmentsCount} awaiting reply` : "All requests handled"}</strong>
                <span>Accept or propose alternative times directly</span>
              </aside>
            </section>
          ) : null}

          <section className="appointment-inbox is-tab-view" aria-labelledby="appointment-inbox-title">
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
                  const nextProposal = (availableSlots ?? []).find(
                    (slot) =>
                      slot.service_id === request.service_id
                      && new Date(slot.starts_at).getTime() > new Date(requestedAt).getTime(),
                  )?.starts_at;
                  return (
                    <article key={request.id}>
                      <div className="appointment-request-main">
                        <span className={`appointment-status is-${request.status}`}>{request.status.replaceAll("_", " ")}</span>
                        <h2>{request.pet_name} · {request.clinic_services.name}</h2>
                        <p>{appointmentTime(request.proposed_starts_at ?? requestedAt)} · {request.clinic_services.duration_minutes} minutes</p>
                        <small>Updates go to {request.customer_email}</small>
                        {isMimoDemo && firstSite && request.status === "time_proposed" ? (
                          <Link
                            className="appointment-customer-link"
                            href={`/sites/${firstSite.slug}?appointment=${request.id}&access=${request.access_token}`}
                          >
                            Open customer update
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
                            </svg>
                          </Link>
                        ) : null}
                      </div>
                      {membership.role === "owner" && request.status === "requested" ? (
                        <div className="appointment-owner-actions">
                          <form action={updateAppointmentFromOwner}>
                            <input name="organizationSlug" type="hidden" value={organizationSlug} />
                            <input name="requestId" type="hidden" value={request.id} />
                            <input name="decision" type="hidden" value="confirm" />
                            <button className="primary-action" type="submit">Accept requested time</button>
                          </form>
                          {nextProposal ? (
                            <form action={updateAppointmentFromOwner}>
                              <input name="organizationSlug" type="hidden" value={organizationSlug} />
                              <input name="requestId" type="hidden" value={request.id} />
                              <input name="decision" type="hidden" value="propose" />
                              <input name="proposedStartsAt" type="hidden" value={nextProposal} />
                              <button className="secondary-action" type="submit">Propose {appointmentTime(nextProposal)}</button>
                            </form>
                          ) : (
                            <small className="appointment-no-alternative">
                              No later opening left to propose — accept the requested time here, or the customer can decline from their link.
                            </small>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="appointment-empty-state">
                <p>No appointment requests yet. When customers book on the website or via an AI agent, their requests will appear here for review.</p>
                {firstSite ? (
                  <Link className="secondary-action" href={`/sites/${firstSite.slug}`}>
                    View customer site
                  </Link>
                ) : null}
              </div>
            )}
          </section>
        </>
      ) : null}

      {currentTab === "website" ? (
        <div className="clinic-website-operations-view">
          {isMimoDemo ? (
            <section className="clinic-workspace-intro" aria-labelledby="content-operations-title">
              <div>
                <p>Content &amp; publication</p>
                <h1 id="content-operations-title">Website operations</h1>
                <span>Update public copy and structured assistant facts. Both views update together from one approved revision.</span>
              </div>
              <aside>
                <small>Current publication</small>
                <strong>Version {firstPublishedVersion?.version_number ?? 1} live</strong>
                <span>{firstDraft ? `Draft v${firstDraft.revision} prepared` : "No pending draft"}</span>
              </aside>
            </section>
          ) : null}

      <section className="workspace-heading guided-heading">
        <div className="guided-heading-main">
          <div>
            <p className="kicker">Website settings</p>
            <h2>{workspaceTitle}</h2>
            <p>
              Update the public page once. Customers and assistants will see the
              same services and hours.
            </p>
          </div>
          <div className="workspace-illustration-wrap">
            <WorkspacePulseIllustration />
            <p><span>One approved change</span><strong>Customer page + assistant tools</strong></p>
          </div>
        </div>
        <ol className="workspace-progress" aria-label="Website update progress">
          {[
            [1, "Review", "Check what changed"],
            [2, "Draft", "Prepare the website change"],
            [3, "Approve", "Review the exact draft"],
            [4, "Publish", "Make it live or undo it"],
          ].map(([step, label, description]) => (
            <li
              className={Number(step) < currentStep ? "is-complete" : Number(step) === currentStep ? "is-current" : ""}
              key={String(step)}
            >
              <span aria-hidden="true">{Number(step) < currentStep ? "✓" : "•"}</span>
              <div><strong>{label}</strong><small>{description}</small></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="opportunity-section" aria-labelledby="opportunity-title">
        <div className="workspace-section-heading">
          <p className="kicker">Website signal</p>
          <h2 id="opportunity-title">What changed at Mimo?</h2>
          <p>
            Customers are looking for Saturday care, but the current site does
            not make it easy enough to spot.
          </p>
        </div>

        <div className="evidence-list" aria-label="Evidence behind the website update">
          {attention.length ? attention.map((item) => (
            <article key={item.id}>
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
              <h3>
                {currentDraftIsPublished
                  ? "The Saturday update is live and reversible."
                  : firstSiteApproved
                    ? "The exact draft is approved and ready to publish."
                    : firstDraft
                      ? "The draft is ready for Owner review."
                      : guidedPlan
                        ? "The update is ready to draft."
                        : "Prepare the Saturday update."}
              </h3>
              <p>
                {currentDraftIsPublished
                  ? "Customers and assistants now read the same published version."
                  : firstSiteApproved
                    ? "Publish below when you are ready to update both views together."
                    : firstDraft
                      ? "Compare both previews below, then approve that exact revision."
                      : guidedPlan
                        ? "Continue below and prepare the exact website copy."
                        : "Review the evidence, update the hours, then ask the Owner to approve it."}
              </p>
            </div>
            {guidedPlan ? (
              <ol className="plan-steps">
                {guidedPlanSteps.map((step) => (
                  <li key={step.kind}>{step.title}</li>
                ))}
              </ol>
            ) : (
              <form action={createActionPlan}>
                <input name="organizationSlug" type="hidden" value={organizationSlug} />
                <input name="attentionItemId" type="hidden" value={guidedAttention.id} />
                <button className="primary-action" type="submit">Prepare website update</button>
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
            <p className="kicker">Website draft and release</p>
            <h2 id="publication-title">Make Saturday care unmistakable.</h2>
          </div>
          <p>Turn the approved evidence into one clear message, then publish it for customers and assistants together.</p>
        </div>

        {sites.map((site) => {
          const draft = drafts.find((candidate) => candidate.site_id === site.id);
          const siteVersions = versions.filter((version) => version.site_id === site.id);
          const publishedVersion = siteVersions.find(
            (version) => version.id === site.published_version_id,
          );
          const publishedContent = contentObject(publishedVersion?.content);
          const publishedHours = contentObject(publishedContent.opening_hours);
          const proposedContent: Record<string, Json> = {
            headline: "Care that makes room for Saturday.",
            summary: "Thoughtful veterinary consultations, now with selected Saturday appointments.",
            opening_hours: {
              weekdays: contentString(publishedHours, "weekdays") || "Monday-Friday · 08:00-18:00",
              saturday: "Saturday · 09:00-14:00",
            },
            cta_label: "Find an appointment",
          };
          const content = draft ? contentObject(draft.content) : proposedContent;
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
                <div><span>Draft</span><strong>{draft ? `Version ${draft.revision}` : "Not started"}</strong></div>
                <div><span>Approval</span><strong>{hasExactApproval ? "Owner approved" : isCurrentDraftPublished ? "Used" : "Required"}</strong></div>
                <div><span>Website</span><strong>{site.published_version_id ? "Live" : "Not published"}</strong></div>
              </div>

              {guidedPlan || draft ? (
                <>
                  {!draft ? (
                    <div className="draft-change-summary" aria-label="Suggested change">
                      <div>
                        <span>Current website</span>
                        <strong>{contentString(publishedContent, "headline")}</strong>
                      </div>
                      <i className="change-arrow" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 8h10M9 4l4 4-4 4" />
                        </svg>
                      </i>
                      <div>
                        <span>Suggested from evidence</span>
                        <strong>{contentString(proposedContent, "headline")}</strong>
                      </div>
                      <em>Not saved yet</em>
                    </div>
                  ) : null}

                  <form className="publication-form" action={saveSiteDraft}>
                    <input name="organizationSlug" type="hidden" value={organizationSlug} />
                    <input name="siteId" type="hidden" value={site.id} />
                    <input name="draftId" type="hidden" value={draft?.id ?? ""} />
                    <input name="revision" type="hidden" value={draft?.revision ?? 0} />
                    <label>Page headline<input name="headline" defaultValue={contentString(content, "headline")} required /></label>
                    <label>Short introduction<textarea name="summary" defaultValue={contentString(content, "summary")} required /></label>
                    <div className="field-pair">
                      <label>Monday-Friday hours<input name="weekdayHours" defaultValue={contentString(hours, "weekdays")} required /></label>
                      <label>Saturday hours<input name="saturdayHours" defaultValue={contentString(hours, "saturday")} required /></label>
                    </div>
                    <label>Primary button label<input name="ctaLabel" defaultValue={contentString(content, "cta_label")} required /></label>
                    <button className="primary-action" type="submit">
                      {draft ? "Save website draft" : "Create this proposed draft"}
                    </button>
                  </form>
                </>
              ) : (
                <div className="draft-locked">
                  <span>Draft</span>
                  <div>
                    <strong>Prepare the update above to reveal the proposed copy.</strong>
                    <p>The suggestion stays locked until the evidence becomes an action plan.</p>
                  </div>
                </div>
              )}

              {draft || guidedPlan ? (
                <section className="publication-consequence-preview" aria-label="Publication consequence preview">
                  <header>
                    <div>
                      <p className="kicker">
                        {isCurrentDraftPublished
                          ? "Published consequence"
                          : hasExactApproval
                            ? "Approved consequence"
                            : draft
                              ? "Before you approve"
                              : "Suggested outcome"}
                      </p>
                      <h3>
                        {isCurrentDraftPublished
                          ? "One published version, two matching views."
                          : hasExactApproval
                            ? "One approved draft, two matching views."
                          : draft
                            ? "One draft, two matching views."
                            : "One proposal, two matching views."}
                      </h3>
                    </div>
                    <span>
                      {isCurrentDraftPublished
                        ? `Version ${publishedVersion?.version_number ?? "Not available"} · Live for customers and assistants`
                        : hasExactApproval
                          ? `Draft v${draft?.revision ?? "Not available"} · Approved, not live yet`
                        : `${draft ? `Draft v${draft.revision}` : "Suggested from evidence"} · Nothing is live yet`}
                    </span>
                  </header>
                  <div className="consequence-preview-grid">
                    <article className="human-consequence-preview">
                      <span>Customer preview</span>
                      <h4>{contentString(content, "headline")}</h4>
                      <p>{contentString(content, "summary")}</p>
                      <dl>
                        <div><dt>Saturday</dt><dd>{contentString(hours, "saturday")}</dd></div>
                        <div><dt>Button</dt><dd>{contentString(content, "cta_label")}</dd></div>
                      </dl>
                    </article>
                    <article className="agent-consequence-preview">
                      <span>Assistant preview</span>
                      <h4>Structured facts from this same version</h4>
                      <ul>
                        <li><strong>Opening hours</strong><small>{contentString(hours, "saturday")}</small></li>
                        <li><strong>Available services</strong><small>Published clinic catalog</small></li>
                        <li><strong>Appointment times</strong><small>Live availability only</small></li>
                      </ul>
                    </article>
                  </div>
                </section>
              ) : null}

              {draft ? (
                <div className="publication-actions">
                  <span>
                    {isCurrentDraftPublished
                      ? `Version ${publishedVersion?.version_number ?? "Not available"} is live. Any new edit will require a fresh approval.`
                      : `Draft v${draft.revision} is saved. Every edit requires a new approval.`}
                  </span>
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
                  <Link href={`/sites/${site.slug}`}>
                    View the live website
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
                    </svg>
                  </Link>
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

      {!appointmentRequests.length && currentDraftIsPublished && firstSite ? (
        <section className="workspace-customer-handoff" aria-labelledby="customer-handoff-title">
          <div>
            <p className="kicker">The customer chapter is ready</p>
            <h2 id="customer-handoff-title">See the update from the other side.</h2>
            <p>
              Version {firstPublishedVersion?.version_number ?? "Not available"} now powers both
              Mimo&apos;s public page and the actions available to assistants.
            </p>
          </div>
          <ol aria-label="What is now live">
            <li>Saturday hours are public</li>
            <li>Assistants can read current availability</li>
            <li>Customer requests return to this workspace</li>
          </ol>
          <Link href={`/sites/${firstSite.slug}`}>
            Continue on the customer site
            <span className="inline-arrow" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
              </svg>
            </span>
          </Link>
          </section>
        ) : null}
        </div>
      ) : null}

      <WebMcpRegistrar
        organizationSlug={organizationSlug}
        contextKey={capabilityContextKey}
      />
    </main>
  );
}
