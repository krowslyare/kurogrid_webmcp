import Link from "next/link";

import { claimDemoSandbox } from "@/features/demo/server/actions";
import { KuroSelect } from "@/components/ui/KuroSelect";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  access: "The demo access code is not valid.",
  capacity: "All isolated demo slots are in use. Try again after a lease expires.",
  configuration: "The demo runtime has not been configured on this environment.",
  claim: "The demo slot could not be allocated.",
  signin: "The demo workspace could not be opened.",
};

export default async function DemoPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <div className="auth-stage">
        <aside className="auth-context demo-context" aria-label="Demo workflow overview">
          <div>
            <p className="kicker">Mimo · WebMCP operations demo</p>
            <h2>Let the page coordinate the real day.</h2>
            <p>One claim creates one clean clinic workspace. The sandbox&apos;s customer site shares the same temporary data.</p>
          </div>
          <ol>
            <li>Open the Owner control room and claim a clean sandbox</li>
            <li>Prepare September availability with your agent</li>
            <li>Apply the exact plan from one Owner request</li>
            <li>Open this sandbox&apos;s customer site from the workspace</li>
            <li>Let the customer answer the clinic&apos;s proposal</li>
          </ol>
          <p className="demo-session-note">Isolated 30-minute session. Claiming resets the sandbox.</p>
        </aside>

        <section className="auth-card demo-card">
          <div className="auth-heading">
            <p className="kicker">Resettable workspace</p>
            <h1>Open a resettable demo.</h1>
            <p>
              Claim a clean clinic workspace with your access code. Its
              customer site opens from inside the workspace.
            </p>
          </div>
          <form className="auth-form" action={claimDemoSandbox}>
          <label>
            Workspace access code
            <input
              aria-describedby="demo-access-help"
              name="accessCode"
              type="password"
              autoComplete="off"
              maxLength={128}
            />
            <small id="demo-access-help">Use the code supplied with the submission.</small>
          </label>
          <div className="kuro-field demo-role-field">
            <span className="kuro-field-label">Workspace role</span>
            <KuroSelect
              name="role"
              defaultValue="owner"
              options={[
                { value: "owner", label: "Owner", hint: "can delegate exact application" },
                { value: "member", label: "Member", hint: "reviews and prepares" },
              ]}
            />
          </div>
          {error ? <p className="form-error">{errorMessages[error] ?? "Demo access failed."}</p> : null}
            <button type="submit">Open isolated demo</button>
          </form>
          <div className="demo-secondary">
            <span aria-hidden="true" />
            <p>or explore without a code</p>
            <span aria-hidden="true" />
          </div>
          <Link className="demo-public-link" href="/sites/mimo-01" target="_blank" rel="noopener">
            <span>Explore the Mimo customer site · independent preview</span>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
            </svg>
          </Link>
          <Link className="auth-back-link" href="/">Back to product overview</Link>
        </section>
      </div>
    </main>
  );
}
