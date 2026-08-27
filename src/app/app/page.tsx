import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { getViewer } from "@/features/auth/server/get-viewer";

export const metadata: Metadata = {
  title: "Workspace · Kurogrid WebMCP",
};

export default async function WorkspacePage() {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/auth/sign-in?next=/app");
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-nav">
        <Link className="brand" href="/" aria-label="Kurogrid WebMCP, home">
          <span className="mark" aria-hidden="true">K</span>
          <span>Kurogrid <b>WebMCP</b></span>
        </Link>
        <form action={signOut}>
          <button className="text-button" type="submit">Sign out</button>
        </form>
      </header>

      <section className="workspace-heading">
        <p className="kicker">Authenticated workspace</p>
        <h1>Your current access</h1>
        <p>{viewer.email ?? viewer.userId}</p>
      </section>

      <section className="membership-list" aria-labelledby="memberships-title">
        <div>
          <p className="kicker">RLS-resolved</p>
          <h2 id="memberships-title">Visible organizations</h2>
        </div>

        {viewer.memberships.length ? (
          <ul>
            {viewer.memberships.map((membership) => (
              <li key={membership.organizationId}>
                <Link href={`/app/${membership.organizationSlug}`}>
                  <strong>{membership.organizationName}</strong>
                  <span>/{membership.organizationSlug}</span>
                </Link>
                <span className="role-badge">{membership.role}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">
            This identity is valid but does not belong to an organization yet.
          </p>
        )}
      </section>
    </main>
  );
}
