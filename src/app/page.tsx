import Link from "next/link";

import { KuroBrand, KuroMark } from "@/components/KuroBrand";
import { AppointmentHandoffIllustration } from "@/components/ProductIllustrations";

const journey = [
  ["Discover", "Read Mimo's services and current availability directly from its website."],
  ["Prepare", "Choose a suitable time and assemble the exact request without sending it."],
  ["Confirm", "Hand control back to the customer before the clinic receives anything."],
  ["Resolve", "Let the clinic accept or suggest another time, then return by email and add it to Calendar."],
] as const;

const clinicFlow = [
  ["Brief", "Describe the upcoming schedule once. The assistant brings calendar busy time as normalized ranges — never event titles or notes."],
  ["Exact plan", "Mimo derives slots, conflicts, and alternatives against real bookings. Nothing applies by itself."],
  ["One approval", "Approve and apply one exact plan. Affected customers then accept or decline their held alternative."],
] as const;

export default function Home() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <KuroBrand className="landing-brand" href="#top" />
        <nav aria-label="Primary navigation">
          <a href="#workflow">How it works</a>
          <a href="#why-webmcp">Why it matters</a>
          <Link href="/demo/simulator">Dual simulator</Link>
          <Link href="/sites/mimo-01">Customer site preview</Link>
          <Link className="landing-nav-cta" href="/demo">Run the full demo</Link>
        </nav>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <p className="landing-kicker">
            <span aria-hidden="true" /> Websites assistants can safely use
          </p>
          <h1>Customers book with their AI agent. Clinics manage availability with theirs.</h1>
          <p className="landing-lede">
            Kuro Agent turns a business website into actions AI assistants can
            safely use. Customers approve every request before it is sent, and
            the clinic applies one exact availability plan at a time.
          </p>
          <div className="landing-actions">
            <Link className="landing-primary-cta" href="/demo">
              Run the full demo
              <span className="landing-cta-arrow" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
                </svg>
              </span>
            </Link>
            <Link className="landing-secondary-link" href="/demo/simulator">
              Live parity simulator
              <span className="landing-inline-arrow" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
                </svg>
              </span>
            </Link>
          </div>
          <ul className="landing-proof" aria-label="Product guarantees">
            <li>Live availability</li>
            <li>Human confirmation</li>
            <li>Clinic response</li>
            <li>Owner-approved plans</li>
          </ul>
        </div>

        <div className="landing-product" aria-label="Kuro Agent product workflow preview">
          <div className="landing-product-bar">
            <span><i aria-hidden="true" /> Mimo Veterinary Care</span>
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
              can prepare a request, but only the customer can send it.
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
              <code>Find appointment times</code>
              <code>Prepare request</code>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-operating" id="workflow" aria-labelledby="workflow-title">
        <div className="landing-operating-heading">
          <div>
            <p className="landing-kicker"><span aria-hidden="true" /> One complete appointment</p>
            <h2 id="workflow-title">From a question to a confirmed visit.</h2>
          </div>
          <p>
            WebMCP lets an assistant discover and use the actions published by
            the website without bypassing the customer or the clinic.
          </p>
        </div>

        <div className="landing-operating-grid">
          <div className="landing-journey" aria-label="Kuro Agent customer workflow">
            {journey.map(([title, description]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="landing-clinic-flow" aria-labelledby="clinic-flow-title">
          <div className="landing-clinic-flow-heading">
            <p className="landing-kicker"><span aria-hidden="true" /> The clinic answers with one exact plan</p>
            <h3 id="clinic-flow-title">Availability is an Owner decision the agent prepares.</h3>
          </div>
          <div className="landing-journey" aria-label="Kuro Agent clinic workflow">
            {clinicFlow.map(([title, description]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="landing-parity" id="why-webmcp" aria-labelledby="parity-title">
          <div className="landing-parity-copy">
            <p>Built into the page</p>
            <h3 id="parity-title">The website becomes a working interface.</h3>
          </div>
          <div className="landing-outcome" aria-label="Confirmed appointment outcome">
            <div className="landing-outcome-status">
              <span>Clinic response</span>
              <strong>Confirmed</strong>
            </div>
            <div className="landing-outcome-visit">
              <span>Luna · Dermatology</span>
              <strong>Confirmed time</strong>
            </div>
            <ul>
              <li><span aria-hidden="true">✓</span> Email update sent</li>
              <li><span aria-hidden="true">＋</span> Ready for Calendar</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="landing-close" aria-labelledby="close-title">
        <div>
          <p>One fictional clinic. One real agent interaction.</p>
          <h2 id="close-title">Ask Mimo for Luna&apos;s next visit.</h2>
          <p className="landing-close-note">
            Independent preview of the customer site. The full guided journey —
            clinic plan, approval, and the customer&apos;s answer — starts in the
            control room.
          </p>
        </div>
        <Link className="landing-primary-cta landing-primary-cta-light" href="/sites/mimo-01">
          Try it on Mimo
          <span className="landing-cta-arrow" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
            </svg>
          </span>
        </Link>
      </section>

      <footer className="landing-footer">
        <span className="landing-footer-brand"><KuroMark className="kuro-mark kuro-mark--sm" /> Kuro Agent <i>by Kurogrid</i></span>
        <span>WebMCP Challenge · fictional clinic demo</span>
      </footer>
    </main>
  );
}
