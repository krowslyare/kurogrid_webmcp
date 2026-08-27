const flow = [
  ["01", "Detect", "Combine an analytics signal, synthetic lead, and verified fact."],
  ["02", "Prepare", "Turn bounded evidence into a fixed plan and structured draft."],
  ["03", "Publish", "Require preview and exact approval before changing the public version."],
  ["04", "Verify", "The human page and tools read one version; rollback stays auditable."],
] as const;

const boundaries = [
  "Synthetic data with no PII or real providers",
  "Role and organization isolation",
  "Publish protected by one-shot exact approval",
  "Native WebMCP with a session-aware dynamic profile",
] as const;

export default function Home() {
  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top" aria-label="Kurogrid WebMCP, home">
          <span className="mark" aria-hidden="true">K</span>
          <span>Kurogrid <b>WebMCP</b></span>
        </a>
        <div className="nav-actions">
          <span className="status"><i /> Hosted demo · release smoke passed</span>
          <a className="demo-link" href="/demo">Open isolated demo</a>
        </div>
      </header>

      <section className="hero shell" id="top">
        <div className="eyebrow">Challenge edition · public-safe by design</div>
        <h1>Web operations an agent can understand, execute, and verify.</h1>
        <p className="lede">
          A bounded implementation of a real WebMCP workflow: from business
          evidence to reversible publication, without exposing the private
          product that inspired it.
        </p>
        <div className="hero-meta">
          <span>Next.js 16</span><span>React 19</span><span>Supabase</span><span>WebMCP nativo</span>
        </div>
      </section>

      <section className="flow shell" aria-labelledby="flow-title">
        <div className="section-heading">
          <p>One complete story</p>
          <h2 id="flow-title">From signal to published change.</h2>
        </div>
        <div className="flow-grid">
          {flow.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="boundary shell" aria-labelledby="boundary-title">
        <div>
          <p className="kicker">The cut is part of the design</p>
          <h2 id="boundary-title">The demo proves the contract, not the private Portal.</h2>
        </div>
        <ul>
          {boundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}
        </ul>
      </section>

      <footer className="shell">
        <span>Kurogrid WebMCP</span>
        <span>Hosted Supabase + Vercel · release smoke passed</span>
      </footer>
    </main>
  );
}
