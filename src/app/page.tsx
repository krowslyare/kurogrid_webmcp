const flow = [
  ["01", "Detectar", "Combina una señal analítica, un lead sintético y un hecho verificado."],
  ["02", "Preparar", "Convierte evidencia acotada en un plan fijo y un borrador estructurado."],
  ["03", "Publicar", "Exige preview y aprobación exacta antes de cambiar la versión pública."],
  ["04", "Comprobar", "La web y sus tools leen la misma versión; rollback queda auditado."],
] as const;

const boundaries = [
  "Datos sintéticos, sin PII ni proveedores reales",
  "Roles y aislamiento por organización",
  "Publish protegido por aprobación de una sola vez",
  "WebMCP nativo con registro dinámico por sesión",
] as const;

export default function Home() {
  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top" aria-label="Kurogrid WebMCP, inicio">
          <span className="mark" aria-hidden="true">K</span>
          <span>Kurogrid <b>WebMCP</b></span>
        </a>
        <span className="status"><i /> Baseline greenfield</span>
      </header>

      <section className="hero shell" id="top">
        <div className="eyebrow">Challenge edition · public-safe by design</div>
        <h1>Operaciones web que un agente puede entender, ejecutar y verificar.</h1>
        <p className="lede">
          Una implementación acotada para demostrar WebMCP sobre un flujo real:
          desde evidencia operativa hasta publicación reversible, sin exponer el
          producto privado que la inspiró.
        </p>
        <div className="hero-meta">
          <span>Next.js 16</span><span>React 19</span><span>Supabase</span><span>WebMCP nativo</span>
        </div>
      </section>

      <section className="flow shell" aria-labelledby="flow-title">
        <div className="section-heading">
          <p>Una sola historia completa</p>
          <h2 id="flow-title">De señal a cambio publicado.</h2>
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
          <p className="kicker">El recorte es parte del diseño</p>
          <h2 id="boundary-title">La demo prueba el contrato, no replica el Portal.</h2>
        </div>
        <ul>
          {boundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}
        </ul>
      </section>

      <footer className="shell">
        <span>Kurogrid WebMCP</span>
        <span>Gate 0 · foundation in progress</span>
      </footer>
    </main>
  );
}
