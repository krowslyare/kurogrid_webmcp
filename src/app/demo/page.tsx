import Link from "next/link";

import { claimDemoSandbox } from "@/features/demo/server/actions";
import { KuroSelect } from "@/components/ui/KuroSelect";
import { KuroBrand } from "@/components/KuroBrand";

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
          <KuroBrand className="auth-context-brand" />
          <div>
            <p className="kicker">Mimo · Live appointment demo</p>
            <h2>Ask for a visit. Let the page do more than answer.</h2>
            <p>Your assistant can find a current time, prepare the request, and stop before anything is sent.</p>
          </div>
          <ol>
            <li>Ask for Saturday care</li>
            <li>Review before sending</li>
            <li>Receive the clinic&apos;s response</li>
            <li>Return by email and add it to Calendar</li>
          </ol>
        </aside>

        <section className="auth-card demo-card">
          <KuroBrand className="auth-card-brand" />
          <div className="auth-heading">
            <p className="kicker">Isolated walkthrough</p>
            <h1>Open a resettable demo.</h1>
            <p>
              Use the supplied code to start on Mimo or inside the clinic.
              Both sides share the same temporary data.
            </p>
          </div>
          <Link className="demo-public-link" href="/sites/arboleda-01">
            Public customer demo. No code needed ↗
          </Link>
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
          <div className="kuro-field">
            <span className="kuro-field-label">Open first</span>
            <KuroSelect
              name="journey"
              defaultValue="customer"
              options={[
                { value: "customer", label: "Mimo website", hint: "customer appointment" },
                { value: "workspace", label: "Clinic workspace", hint: "requests and publishing" },
              ]}
            />
          </div>
          <div className="kuro-field demo-role-field">
            <span className="kuro-field-label">Workspace role</span>
            <KuroSelect
              name="role"
              defaultValue="owner"
              options={[
                { value: "owner", label: "Owner", hint: "can approve and publish" },
                { value: "member", label: "Member", hint: "can prepare drafts only" },
              ]}
            />
          </div>
          {error ? <p className="form-error">{errorMessages[error] ?? "Demo access failed."}</p> : null}
            <button type="submit">Open isolated demo</button>
          </form>
          <Link className="auth-back-link" href="/">Back to product overview</Link>
        </section>
      </div>
    </main>
  );
}
