import Link from "next/link";

import { claimDemoSandbox } from "@/features/demo/server/actions";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  access: "The demo access code is not valid.",
  capacity: "All isolated demo slots are in use. Try again after a lease expires.",
  configuration: "The demo runtime has not been configured on this environment.",
  claim: "The demo slot could not be allocated.",
  signin: "The synthetic demo identity could not be signed in.",
};

export default async function DemoPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card demo-card">
        <Link className="brand" href="/">
          <span className="mark" aria-hidden="true">K</span>
          <span>Kurogrid <b>WebMCP</b></span>
        </Link>
        <div className="auth-heading">
          <p className="kicker">Isolated evaluator sandbox</p>
          <h1>Start clean.</h1>
          <p>
            Each lease receives its own fictional organization and a reset
            synthetic dataset. No customer data is present.
          </p>
        </div>
        <form className="auth-form" action={claimDemoSandbox}>
          <label>
            Demo access code
            <input
              name="accessCode"
              type="password"
              autoComplete="off"
              minLength={24}
              maxLength={128}
              required
            />
          </label>
          <label>
            Role to evaluate
            <select name="role" defaultValue="owner">
              <option value="owner">Owner — full approved publication</option>
              <option value="member">Member — draft without publish</option>
            </select>
          </label>
          {error ? <p className="form-error">{errorMessages[error] ?? "Demo access failed."}</p> : null}
          <button type="submit">Claim isolated slot</button>
        </form>
      </section>
    </main>
  );
}
