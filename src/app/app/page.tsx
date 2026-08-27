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
        <Link className="brand" href="/" aria-label="Kurogrid WebMCP, inicio">
          <span className="mark" aria-hidden="true">K</span>
          <span>Kurogrid <b>WebMCP</b></span>
        </Link>
        <form action={signOut}>
          <button className="text-button" type="submit">Cerrar sesión</button>
        </form>
      </header>

      <section className="workspace-heading">
        <p className="kicker">Authenticated workspace</p>
        <h1>Tu acceso actual</h1>
        <p>{viewer.email ?? viewer.userId}</p>
      </section>

      <section className="membership-list" aria-labelledby="memberships-title">
        <div>
          <p className="kicker">RLS-resolved</p>
          <h2 id="memberships-title">Organizaciones visibles</h2>
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
            Esta identidad es válida, pero todavía no pertenece a una
            organización.
          </p>
        )}
      </section>
    </main>
  );
}
