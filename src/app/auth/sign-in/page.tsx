import type { Metadata } from "next";
import Link from "next/link";

import { KuroBrand } from "@/components/KuroBrand";
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
      <div className="auth-stage">
        <aside className="auth-context" aria-label="Kuro Agent access model">
          <KuroBrand className="auth-context-brand" />
          <div>
            <p className="kicker">A bounded operating surface</p>
            <h2>Identity changes what the agent can do.</h2>
            <p>Role, organization, resource and state resolve before any capability appears.</p>
          </div>
          <dl>
            <div><dt>Owner</dt><dd>Approve · publish · rollback</dd></div>
            <div><dt>Member</dt><dd>Read · prepare · preview</dd></div>
          </dl>
        </aside>

        <section className="auth-card" aria-labelledby="sign-in-title">
          <KuroBrand className="auth-card-brand" />

          <div className="auth-heading">
            <p className="kicker">Tenant-aware workspace</p>
            <h1 id="sign-in-title">Sign in to the demo</h1>
            <p>
              Accounts are synthetic and provisioned per sandbox. Public sign-up
              is intentionally unavailable.
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
            Password
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
              Those credentials could not be verified.
            </p>
          ) : null}

            <button type="submit">Sign in</button>
          </form>
          <Link className="auth-back-link" href="/demo">Need a fresh sandbox? Start here ↗</Link>
        </section>
      </div>
    </main>
  );
}
