import { KuroBrand, KuroMark } from "@/components/KuroBrand";

const journey = [
  ["01", "Understand the opportunity", "Review demand, one customer question, and the clinic's approved hours."],
  ["02", "Prepare the website update", "Turn that evidence into a fixed plan and the exact page content."],
  ["03", "Owner reviews the draft", "Nothing can go live until the Owner approves that exact version."],
  ["04", "Publish or undo", "Update the website and its AI-readable facts together, with rollback ready."],
] as const;

export default function Home() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <KuroBrand className="landing-brand" href="#top" />
        <nav aria-label="Primary navigation">
          <a href="#workflow">How it works</a>
          <a href="#why-webmcp">Why WebMCP</a>
          <a className="landing-nav-cta" href="/demo">Launch demo</a>
        </nav>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <p className="landing-kicker">
            <span aria-hidden="true" /> AI-assisted website operations
          </p>
          <h1>Turn business signals into approved website updates.</h1>
          <p className="landing-lede">
            Kuro Agent helps a team spot an opportunity, prepare the exact change,
            get Owner approval, and publish it—without giving the AI unchecked control.
          </p>
          <div className="landing-actions">
            <a className="landing-primary-cta" href="/demo">
              Open the live demo <span aria-hidden="true">↗</span>
            </a>
            <a className="landing-secondary-link" href="#workflow">
              See the complete story <span aria-hidden="true">↓</span>
            </a>
          </div>
          <ul className="landing-proof" aria-label="Product guarantees">
            <li>Live website updates</li>
            <li>Owner approval</li>
            <li>One-click rollback</li>
          </ul>
        </div>

        <div className="landing-product" aria-label="Kuro Agent product workflow preview">
          <div className="landing-product-bar">
            <span><i aria-hidden="true" /> Clínica Arboleda</span>
            <span>Owner workspace</span>
          </div>
          <div className="landing-product-body">
            <div className="landing-signal-label">
              <span>Opportunity / 01</span>
              <strong>Ready to review</strong>
            </div>
            <h2>Customers want Saturday appointments.</h2>
            <p>
              Weekend demand, one customer question, and approved opening hours
              point to a clear website update.
            </p>
            <div className="landing-evidence">
              <span>Weekend demand</span>
              <span>Customer question</span>
              <span>Approved hours</span>
            </div>
            <ol className="landing-mini-plan">
              <li><span>01</span><strong>Review the opportunity</strong><i>Done</i></li>
              <li><span>02</span><strong>Prepare the website update</strong><i>Ready</i></li>
              <li><span>03</span><strong>Owner approves and publishes</strong><i>Approval</i></li>
            </ol>
          </div>
          <div className="landing-product-footer">
            <span>WebMCP actions available now</span>
            <div>
              <code>Preview consequences</code>
              <code>Publish approved draft</code>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-operating" id="workflow" aria-labelledby="workflow-title">
        <div className="landing-operating-heading">
          <div>
            <p className="landing-kicker"><span aria-hidden="true" /> One complete story</p>
            <h2 id="workflow-title">One opportunity. One controlled website update.</h2>
          </div>
          <p>
            The AI can prepare the work, but its available actions change with
            the user&apos;s role and the current step. Publishing remains an Owner decision.
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
            <p>One approved version</p>
            <h3 id="parity-title">The live website is the source of truth.</h3>
          </div>
          <div className="landing-parity-diagram" aria-label="Human and agent publication parity">
            <div><span>Customer website</span><strong>Approved content</strong></div>
            <span aria-hidden="true">↔</span>
            <div className="landing-version"><span>Shared source</span><strong>Published version</strong></div>
            <span aria-hidden="true">↔</span>
            <div><span>AI via WebMCP</span><strong>The same facts</strong></div>
          </div>
        </div>
      </section>

      <section className="landing-close" aria-labelledby="close-title">
        <div>
          <p>Built to be explored, not explained away.</p>
          <h2 id="close-title">Run the complete workflow.</h2>
        </div>
        <a className="landing-primary-cta landing-primary-cta-light" href="/demo">
          Enter the isolated demo <span aria-hidden="true">↗</span>
        </a>
      </section>

      <footer className="landing-footer">
        <span className="landing-footer-brand"><KuroMark className="kuro-mark kuro-mark--sm" /> Kuro Agent <i>by Kurogrid</i></span>
        <span>WebMCP Challenge · fictional clinic demo</span>
      </footer>
    </main>
  );
}
