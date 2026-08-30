import Link from "next/link";

import { KuroBrand, KuroMark } from "@/components/KuroBrand";

const journey = [
  ["01", "Discover", "Read Arboleda's services and current availability directly from its website."],
  ["02", "Prepare", "Choose a suitable time and assemble the exact request without sending it."],
  ["03", "Confirm", "Hand control back to the customer before the clinic receives anything."],
  ["04", "Resolve", "Let the clinic accept or suggest another time, then return by email and add it to Calendar."],
] as const;

export default function Home() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <KuroBrand className="landing-brand" href="#top" />
        <nav aria-label="Primary navigation">
          <a href="#workflow">How it works</a>
          <a href="#why-webmcp">Why it matters</a>
          <Link className="landing-nav-cta" href="/sites/arboleda-01">Try customer demo</Link>
        </nav>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <p className="landing-kicker">
            <span aria-hidden="true" /> Websites assistants can safely use
          </p>
          <h1>Let customers book through the agent they already use.</h1>
          <p className="landing-lede">
            Kuro Agent turns a business website into actions AI assistants can
            safely use. Customers find a time, review the exact request, and
            approve it before anything is sent.
          </p>
          <div className="landing-actions">
            <Link className="landing-primary-cta" href="/sites/arboleda-01">
              Try the customer demo <span aria-hidden="true">↗</span>
            </Link>
            <a className="landing-secondary-link" href="#workflow">
              See the complete story <span aria-hidden="true">↓</span>
            </a>
          </div>
          <ul className="landing-proof" aria-label="Product guarantees">
            <li>Live availability</li>
            <li>Human confirmation</li>
            <li>Clinic response</li>
          </ul>
        </div>

        <div className="landing-product" aria-label="Kuro Agent product workflow preview">
          <div className="landing-product-bar">
            <span><i aria-hidden="true" /> Clínica Arboleda</span>
            <span>Customer agent</span>
          </div>
          <div className="landing-product-body">
            <div className="landing-signal-label">
              <span>Appointment / Luna</span>
              <strong>3 times available</strong>
            </div>
            <h2>Find Luna a dermatology visit this Saturday.</h2>
            <p>
              Arboleda offers dermatology care on Saturday morning. The agent
              can prepare a request, but only the customer can send it.
            </p>
            <div className="landing-evidence">
              <span>Dermatology</span>
              <span>Saturday 09:30</span>
              <span>30 minutes</span>
            </div>
            <ol className="landing-mini-plan">
              <li><span>01</span><strong>Read services and live times</strong><i>Done</i></li>
              <li><span>02</span><strong>Prepare Saturday at 09:30</strong><i>Ready</i></li>
              <li><span>03</span><strong>Ask before sending</strong><i>Confirm</i></li>
            </ol>
          </div>
          <div className="landing-product-footer">
            <span>Available from this page</span>
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
          <div className="landing-journey" aria-label="Kuro Agent workflow">
            {journey.map(([number, title, description]) => (
              <article key={number}>
                <span>{number}</span>
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
          <div className="landing-parity-diagram" aria-label="Customer, agent, and clinic handoff">
            <div><span>Customer</span><strong>I need Saturday care</strong></div>
            <span aria-hidden="true">↔</span>
            <div className="landing-version"><span>Arboleda website + WebMCP</span><strong>Find times · prepare request</strong></div>
            <span aria-hidden="true">↔</span>
            <div><span>Clinic</span><strong>Accept or offer another time</strong></div>
          </div>
        </div>
      </section>

      <section className="landing-close" aria-labelledby="close-title">
        <div>
          <p>One fictional clinic. One real agent interaction.</p>
          <h2 id="close-title">Ask Arboleda for a Saturday visit.</h2>
        </div>
        <Link className="landing-primary-cta landing-primary-cta-light" href="/sites/arboleda-01">
          Try it on Arboleda <span aria-hidden="true">↗</span>
        </Link>
      </section>

      <footer className="landing-footer">
        <span className="landing-footer-brand"><KuroMark className="kuro-mark kuro-mark--sm" /> Kuro Agent <i>by Kurogrid</i></span>
        <span>WebMCP Challenge · fictional clinic demo</span>
      </footer>
    </main>
  );
}
