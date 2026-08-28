const journey = [
  ["01", "Read the signal", "The agent finds bounded business evidence, not a blank prompt."],
  ["02", "Prepare the change", "It turns that evidence into a fixed plan and structured draft."],
  ["03", "Approve exactly", "The Owner reviews the human and agent-visible consequences."],
  ["04", "Publish or reverse", "One version updates both surfaces; rollback stays available."],
] as const;

const principles = [
  ["Contextual", "Tools appear only when role, resource, and state allow them."],
  ["Human-led", "Drafting can be delegated. Publishing requires exact Owner approval."],
  ["One truth", "People and assistants read the same immutable published version."],
] as const;

export default function Home() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="Kurogrid, home">
          <span aria-hidden="true">K</span>
          <strong>Kurogrid</strong>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#workflow">How it works</a>
          <a href="#why-webmcp">Why WebMCP</a>
          <a className="landing-nav-cta" href="/demo">Launch demo</a>
        </nav>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <p className="landing-kicker">
            <span aria-hidden="true" /> Agent-native business operations
          </p>
          <h1>The website becomes an operating surface.</h1>
          <p className="landing-lede">
            Kurogrid lets an agent turn business evidence into a real, reversible
            website change—without stepping outside human authority.
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
            <li>Native WebMCP</li>
            <li>Exact approval</li>
            <li>Auditable rollback</li>
          </ul>
        </div>

        <div className="landing-product" aria-label="Kurogrid product workflow preview">
          <div className="landing-product-bar">
            <span><i aria-hidden="true" /> Clínica Arboleda</span>
            <span>Owner workspace</span>
          </div>
          <div className="landing-product-body">
            <div className="landing-signal-label">
              <span>Attention / 01</span>
              <strong>High confidence</strong>
            </div>
            <h2>Weekend demand is rising.</h2>
            <p>
              A verified analytics signal and an open lead point to one
              bounded website change.
            </p>
            <div className="landing-evidence">
              <span>Analytics signal</span>
              <span>Verified hours</span>
              <span>Synthetic lead</span>
            </div>
            <ol className="landing-mini-plan">
              <li><span>01</span><strong>Acknowledge attention</strong><i>Done</i></li>
              <li><span>02</span><strong>Prepare site draft</strong><i>Ready</i></li>
              <li><span>03</span><strong>Publish exact revision</strong><i>Approval</i></li>
            </ol>
          </div>
          <div className="landing-product-footer">
            <span>Capability surface</span>
            <div>
              <code>preview_publish_consequences</code>
              <code>publish_site_draft</code>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-principles" id="why-webmcp" aria-labelledby="why-title">
        <div className="landing-section-heading">
          <p>Why WebMCP</p>
          <h2 id="why-title">The right capability, at the right moment.</h2>
        </div>
        <div className="landing-principle-grid">
          {principles.map(([title, description], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-workflow" id="workflow" aria-labelledby="workflow-title">
        <div className="landing-section-heading">
          <p>One complete story</p>
          <h2 id="workflow-title">From signal to published change.</h2>
        </div>
        <div className="landing-journey">
          {journey.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-parity" aria-labelledby="parity-title">
        <div>
          <p className="landing-kicker">One published truth</p>
          <h2 id="parity-title">What people see is what agents read.</h2>
        </div>
        <div className="landing-parity-diagram" aria-label="Human and agent publication parity">
          <div><span>Human website</span><strong>Published content</strong></div>
          <span aria-hidden="true">↔</span>
          <div className="landing-version"><span>Canonical state</span><strong>site_version</strong></div>
          <span aria-hidden="true">↔</span>
          <div><span>WebMCP tools</span><strong>Published facts</strong></div>
        </div>
      </section>

      <section className="landing-close" aria-labelledby="close-title">
        <p>Built to be explored, not explained away.</p>
        <h2 id="close-title">Run the complete workflow.</h2>
        <a className="landing-primary-cta landing-primary-cta-light" href="/demo">
          Enter the isolated demo <span aria-hidden="true">↗</span>
        </a>
      </section>

      <footer className="landing-footer">
        <span>Kurogrid</span>
        <span>WebMCP Challenge · public-safe implementation</span>
      </footer>
    </main>
  );
}
