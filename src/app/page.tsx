import Link from "next/link";

import { KuroBrand, KuroMark } from "@/components/KuroBrand";
import { AppointmentHandoffIllustration } from "@/components/ProductIllustrations";

const LIVE_PRODUCT_URL = "https://webmcp.kurogrid.com";
const REPO_URL = "https://github.com/krowslyare/kurogrid_webmcp";
const docUrl = (path: string) => `${REPO_URL}/blob/main/${path}`;

const availabilityTools = [
  "get_availability_configuration",
  "prepare_availability_plan",
  "apply_availability_plan",
  "apply_approved_availability_plan",
] as const;

const appointmentTools = [
  "get_clinic_services",
  "get_opening_hours",
  "find_appointment_slots",
  "prepare_appointment_request",
  "confirm_appointment_request",
  "get_appointment_status",
  "respond_to_appointment_proposal",
  "get_appointment_calendar_event",
] as const;

const operationsTools = [
  "get_attention",
  "create_action_plan",
  "acknowledge_lead_attention",
  "get_site_content",
  "create_or_patch_site_draft",
  "preview_publish_consequences",
  "publish_site_draft",
  "list_site_versions",
  "rollback_site_version",
] as const;

const toolCount =
  availabilityTools.length + appointmentTools.length + operationsTools.length;

const steps = [
  {
    index: "01",
    title: "Customer books",
    route: "Talk to Mimo on /sites/mimo-01",
    body: "The assistant reads live services and slots, prepares the exact request, and stops. The customer reviews service, time, pet, and email before anything reaches the clinic. No agent on hand? The TraditionalBooking form books the same slots without WebMCP.",
    tools: [
      "find_appointment_slots",
      "prepare_appointment_request",
      "confirm_appointment_request",
    ],
  },
  {
    index: "02",
    title: "Owner reconciles",
    route: "Availability control room at /app/[slug]",
    body: "The Owner describes schedule intent once. The agent combines it with normalized busy intervals — never credentials, titles, attendees, or notes — and Mimo derives slots, conflicts, and held alternatives. Luna gets a proposed alternative while Max stays preserved. One exact plan applies under a one-shot approval; stale or conflicting plans fail closed with an audit record.",
    tools: ["prepare_availability_plan", "apply_availability_plan"],
  },
  {
    index: "03",
    title: "Parity holds",
    route: "One published truth",
    body: "The public page and its WebMCP tools resolve the same immutable publication version: same services, slots, holds, and appointment state. Tools register through document.modelContext and refresh when auth, role, organization, or resource state changes; stale registrations abort.",
    tools: ["get_site_content", "get_appointment_status"],
  },
] as const;

function ArrowIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="landing" id="top">
      <a className="landing-skip" href="#main-content">
        Skip to content
      </a>

      <header className="landing-nav">
        <KuroBrand className="landing-brand" href="#top" />
        <nav aria-label="Primary">
          <a href="#how-it-works">How it works</a>
          <a href="#webmcp-tools">WebMCP tools</a>
          <a href="#why-webmcp">Parity</a>
          <Link href="/demo/simulator">Simulator</Link>
          <Link href="/sites/mimo-01">Customer site</Link>
          <Link className="landing-nav-cta" href="/demo">
            Run the full demo
          </Link>
        </nav>
      </header>

      <div id="main-content">
        <section className="landing-hero" aria-labelledby="hero-title">
          <div className="landing-hero-copy">
            <p className="landing-kicker">
              <span aria-hidden="true" /> Websites assistants can safely use
            </p>
            <h1 id="hero-title">
              The clinic website your agent can act on, with a human in charge.
            </h1>
            <p className="landing-lede">
              Kuro Agent turns Mimo Veterinary Care, a fictional vet clinic,
              into a WebMCP capability surface. Customers approve every booking
              before it is sent, and the Owner reviews and applies one exact
              availability plan at a time. Live at webmcp.kurogrid.com.
            </p>
            <div className="landing-actions">
              <Link className="landing-primary-cta" href="/demo">
                Run the full demo
                <span className="landing-cta-arrow" aria-hidden="true">
                  <ArrowIcon />
                </span>
              </Link>
              <Link className="landing-secondary-link" href="/sites/mimo-01">
                Talk to Mimo, live customer demo
                <span className="landing-inline-arrow" aria-hidden="true">
                  <ArrowIcon />
                </span>
              </Link>
            </div>
            <ul className="landing-proof" aria-label="Product guarantees">
              <li>Live availability</li>
              <li>Customer approval first</li>
              <li>One exact plan</li>
              <li>Full audit trail</li>
            </ul>
          </div>

          <div
            className="landing-product"
            aria-label="Talk to Mimo booking preview"
          >
            <div className="landing-product-bar">
              <span>
                <i aria-hidden="true" /> Mimo Veterinary Care
              </span>
              <span>Customer agent</span>
            </div>
            <div className="landing-product-body">
              <div className="landing-product-illustration">
                <AppointmentHandoffIllustration />
                <span>Customer request</span>
                <span>Clinic response</span>
              </div>
              <div className="landing-signal-label">
                <span>Appointment / Luna</span>
                <strong>Live times available</strong>
              </div>
              <h2>Find Luna&apos;s next dermatology visit.</h2>
              <p>
                Mimo publishes its current dermatology availability. The agent
                prepares the exact request, but only the customer can send it.
                The same slots work in the traditional booking form.
              </p>
              <div className="landing-prepared-request">
                <span>Prepared for customer review</span>
                <strong>Dermatology · Selected opening</strong>
                <i>Nothing sent yet</i>
              </div>
            </div>
            <div className="landing-product-footer">
              <span>Agent capabilities on this page</span>
              <div>
                <code>find_appointment_slots</code>
                <code>prepare_appointment_request</code>
                <code>confirm_appointment_request</code>
              </div>
            </div>
          </div>
        </section>

        <section
          className="landing-operating"
          id="how-it-works"
          aria-labelledby="how-it-works-title"
        >
          <span id="workflow" aria-hidden="true" className="landing-anchor" />
          <div className="landing-operating-heading">
            <div>
              <p className="landing-kicker">
                <span aria-hidden="true" /> One complete appointment
              </p>
              <h2 id="how-it-works-title">
                From a question to a confirmed visit.
              </h2>
            </div>
            <p>
              WebMCP lets an assistant discover and use the actions published
              by the website, without bypassing the customer or the clinic.
              Three parties stay in control: the customer, the Owner, and the
              published page they both see.
            </p>
          </div>

          <ol className="landing-steps">
            {steps.map((step) => (
              <li key={step.index} className="landing-step">
                <p className="landing-step-index">{step.index}</p>
                <h3>{step.title}</h3>
                <p className="landing-step-route">{step.route}</p>
                <p className="landing-step-body">{step.body}</p>
                <ul
                  className="landing-step-tools"
                  aria-label={`Key tools for ${step.title}`}
                >
                  {step.tools.map((tool) => (
                    <li key={tool}>
                      <code>{tool}</code>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <div
            className="landing-parity"
            id="why-webmcp"
            aria-labelledby="parity-title"
          >
            <div className="landing-parity-copy">
              <p>Built into the page</p>
              <h3 id="parity-title">The website becomes a working interface.</h3>
              <p className="landing-parity-body">
                Luna books dermatology on Saturday morning while Max&apos;s
                booking stays untouched. The Owner applies the reconciled plan
                from the control room, the customer accepts the held
                alternative, and the confirmation lands by email with a Calendar
                handoff.
              </p>
            </div>
            <div
              className="landing-outcome"
              aria-label="Confirmed appointment outcome"
            >
              <div className="landing-outcome-status">
                <span>Clinic response</span>
                <strong>Confirmed</strong>
              </div>
              <div className="landing-outcome-visit">
                <span>Luna · Dermatology</span>
                <strong>Confirmed time</strong>
              </div>
              <ul>
                <li>Email update sent</li>
                <li>Ready for Calendar</li>
              </ul>
            </div>
          </div>
        </section>

        <section
          className="landing-tools"
          id="webmcp-tools"
          aria-labelledby="tools-title"
        >
          <div className="landing-tools-heading">
            <div>
              <p className="landing-kicker">
                <span aria-hidden="true" /> Capability surface ·{" "}
                {toolCount} tools
              </p>
              <h2 id="tools-title">Every tool the site publishes. Nothing else.</h2>
            </div>
            <p>
              Tools register through <code>document.modelContext</code> and
              execute server-side against the current session, tenant, role,
              and resource state. Registration is not authorization: every call
              is re-resolved, and consequential actions consume one-shot
              approvals with audit records.
            </p>
          </div>

          <div className="landing-tool-groups">
            <article aria-labelledby="tools-availability-title">
              <h3 id="tools-availability-title">
                Availability · Owner control room
              </h3>
              <p>
                Manual review, external-agent prompt, and WebMCP inspector over
                one exact plan.
              </p>
              <ul>
                {availabilityTools.map((tool) => (
                  <li key={tool}>
                    <code>{tool}</code>
                  </li>
                ))}
              </ul>
            </article>
            <article aria-labelledby="tools-appointments-title">
              <h3 id="tools-appointments-title">Appointments · Customer</h3>
              <p>
                Prepare first, send only on customer approval; the clinic
                accepts or proposes another time.
              </p>
              <ul>
                {appointmentTools.map((tool) => (
                  <li key={tool}>
                    <code>{tool}</code>
                  </li>
                ))}
              </ul>
            </article>
            <article aria-labelledby="tools-operations-title">
              <h3 id="tools-operations-title">Attention and content operations</h3>
              <p>
                Secondary demonstration: signals, drafts, publication versions,
                and rollback.
              </p>
              <ul>
                {operationsTools.map((tool) => (
                  <li key={tool}>
                    <code>{tool}</code>
                  </li>
                ))}
              </ul>
            </article>
          </div>
          <p className="landing-tools-note">
            Tool names match <code>src/features/webmcp/contracts.ts</code>{" "}
            exactly. Inspect them live in the Owner control room&apos;s WebMCP
            inspector or the parity simulator at{" "}
            <Link href="/demo/simulator">/demo/simulator</Link>.
          </p>
        </section>

        <section className="landing-live" id="live" aria-labelledby="live-title">
          <div className="landing-live-heading">
            <p className="landing-kicker">
              <span aria-hidden="true" /> Try it live
            </p>
            <h2 id="live-title">Three doors into the same clinic.</h2>
          </div>
          <div className="landing-live-grid">
            <article>
              <p className="landing-live-tag">Customer · /sites/mimo-01</p>
              <h3>Talk to Mimo</h3>
              <p>
                Ask for Luna&apos;s dermatology visit on Saturday morning. The
                assistant finds live slots and prepares the request for your
                review.
              </p>
              <Link href="/sites/mimo-01">
                Open the customer demo <span aria-hidden="true"><ArrowIcon /></span>
              </Link>
            </article>
            <article>
              <p className="landing-live-tag">Owner · /demo → /app/[slug]</p>
              <h3>Availability control room</h3>
              <p>
                Claim a resettable sandbox, prepare September availability with
                your agent, and apply one exact plan under Owner approval.
              </p>
              <Link href="/demo">
                Claim a demo workspace <span aria-hidden="true"><ArrowIcon /></span>
              </Link>
            </article>
            <article>
              <p className="landing-live-tag">Both · /demo/simulator</p>
              <h3>Parity simulator</h3>
              <p>
                Customer booking on the left, Owner copilot on the right, one
                shared truth in the middle — with a live WebMCP inspector.
              </p>
              <Link href="/demo/simulator">
                Open the simulator <span aria-hidden="true"><ArrowIcon /></span>
              </Link>
            </article>
          </div>
        </section>

        <section className="landing-close" aria-labelledby="close-title">
          <div>
            <p>One fictional clinic. One real agent interaction.</p>
            <h2 id="close-title">Ask Mimo for Luna&apos;s next visit.</h2>
          </div>
          <div className="landing-close-actions">
            <Link
              className="landing-primary-cta landing-primary-cta-light"
              href="/sites/mimo-01"
            >
              Try it on Mimo
              <span className="landing-cta-arrow" aria-hidden="true">
                <ArrowIcon />
              </span>
            </Link>
            <Link className="landing-close-ghost" href="/demo">
              Run the full demo
            </Link>
          </div>
        </section>
      </div>

      <footer className="landing-footer">
        <span className="landing-footer-brand">
          <KuroMark className="kuro-mark kuro-mark--sm" /> Kuro Agent{" "}
          <i>by Kurogrid</i>
        </span>
        <p className="landing-footer-note">
          Fictional Mimo clinic. No real customer data.
        </p>
        <nav aria-label="Project links">
          <a href={LIVE_PRODUCT_URL}>Live product</a>
          <Link href="/sites/mimo-01">Customer demo</Link>
          <Link href="/demo">Guided demo</Link>
          <Link href="/demo/simulator">Simulator</Link>
          <a href={REPO_URL}>Repository</a>
          <a href={docUrl("docs/architecture.md")}>Architecture</a>
          <a href={docUrl("docs/security.md")}>Security</a>
          <a href={docUrl("docs/demo-runtime.md")}>Demo runtime</a>
          <a href={docUrl("docs/webmcp-compatibility.md")}>WebMCP notes</a>
        </nav>
      </footer>
    </main>
  );
}
