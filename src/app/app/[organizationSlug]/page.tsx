import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  acknowledgeLeadAttention,
  createActionPlan,
} from "@/features/attention/server/actions";
import { getViewer } from "@/features/auth/server/get-viewer";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Attention · Kurogrid WebMCP",
};

type PageProps = {
  params: Promise<{ organizationSlug: string }>;
};

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

  return (
    <main className="workspace-shell">
      <header className="workspace-nav">
        <Link className="brand" href="/app">
          <span className="mark" aria-hidden="true">K</span>
          <span>{membership.organizationName}</span>
        </Link>
        <span className="role-badge">{membership.role}</span>
      </header>

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
    </main>
  );
}
