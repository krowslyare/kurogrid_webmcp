import type { Metadata } from "next";
import Link from "next/link";

import { signIn } from "../actions";

export const metadata: Metadata = {
  title: "Sign in · Kurogrid WebMCP",
};

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const hasError = params.error === "invalid_credentials";

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="sign-in-title">
        <Link className="brand" href="/" aria-label="Kurogrid WebMCP, inicio">
          <span className="mark" aria-hidden="true">K</span>
          <span>Kurogrid <b>WebMCP</b></span>
        </Link>

        <div className="auth-heading">
          <p className="kicker">Tenant-aware workspace</p>
          <h1 id="sign-in-title">Ingresar a la demo</h1>
          <p>
            Las cuentas son sintéticas y se provisionan por sandbox. No hay
            registro público en este gate.
          </p>
        </div>

        <form action={signIn} className="auth-form">
          <input type="hidden" name="next" value={params.next ?? "/app"} />

          <label>
            Email
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              required
              type="email"
            />
          </label>

          <label>
            Contraseña
            <input
              autoComplete="current-password"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </label>

          {hasError ? (
            <p className="form-error" role="alert">
              No pudimos validar esas credenciales.
            </p>
          ) : null}

          <button type="submit">Ingresar</button>
        </form>
      </section>
    </main>
  );
}
