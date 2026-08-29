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
  signin: "The synthetic demo identity could not be signed in.",
};

export default async function DemoPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <div className="auth-stage">
        <aside className="auth-context demo-context" aria-label="Demo workflow overview">
          <KuroBrand className="auth-context-brand" />
          <div>
            <p className="kicker">One fictional clinic · One connected visit</p>
            <h2>Let an agent book care, not just browse a page.</h2>
            <p>Start as a customer. Ask for a time, hand control back to the person, and follow the clinic&apos;s response.</p>
          </div>
          <ol>
            <li><span>01</span>Discover services and live times</li>
            <li><span>02</span>Review the exact request</li>
            <li><span>03</span>Let the clinic accept or reschedule</li>
            <li><span>04</span>Return by email and add it to Calendar</li>
          </ol>
        </aside>

        <section className="auth-card demo-card">
          <KuroBrand className="auth-card-brand" />
          <div className="auth-heading">
            <p className="kicker">Isolated fictional demo</p>
            <h1>Start where the value is felt.</h1>
            <p>
              Customer is the main story. Workspace lets you inspect the
              clinic side and the original controlled publishing flow.
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
          <div className="kuro-field">
            <span className="kuro-field-label">Start the demo as</span>
            <KuroSelect
              name="journey"
              defaultValue="customer"
              options={[
                { value: "customer", label: "Customer", hint: "recommended · agent booking" },
                { value: "workspace", label: "Clinic team", hint: "requests and publishing" },
              ]}
            />
          </div>
          <div className="kuro-field demo-role-field">
            <span className="kuro-field-label">Workspace permission</span>
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
            <button type="submit">Begin isolated demo</button>
          </form>
          <Link className="auth-back-link" href="/">Back to product overview</Link>
        </section>
      </div>
    </main>
  );
}
