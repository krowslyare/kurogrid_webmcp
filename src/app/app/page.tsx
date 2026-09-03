import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { KuroBrand } from "@/components/KuroBrand";
import { getViewer } from "@/features/auth/server/get-viewer";

export const metadata: Metadata = {
  title: "Mimo clinic workspace · Kuro Agent",
  icons: {
    icon: [
      { url: "/mimo-icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/mimo-icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/mimo-icon-32.png",
  },
};

export default async function WorkspacePage() {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/auth/sign-in?next=/app");
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-nav">
        <KuroBrand />
        <form action={signOut}>
          <button className="text-button" type="submit">Sign out</button>
        </form>
      </header>

      <section className="workspace-heading workspace-hero">
        <div>
          <p className="kicker">Demo access</p>
          <h1>Choose a workspace.</h1>
          <p>Signed in as {viewer.email ?? viewer.userId}</p>
        </div>
        <div className="workspace-stat">
          <span>Available workspaces</span>
          <strong>{String(viewer.memberships.length).padStart(2, "0")}</strong>
          <small>Your role decides which actions are available.</small>
        </div>
      </section>

      <section className="membership-list" aria-labelledby="memberships-title">
        <div>
          <p className="kicker">Continue the walkthrough</p>
          <h2 id="memberships-title">Available workspaces</h2>
        </div>

        {viewer.memberships.length ? (
          <ul>
            {viewer.memberships.map((membership) => (
              <li key={membership.organizationId}>
                <Link href={`/app/${membership.organizationSlug}`}>
                  <span className="membership-index">
                    Continue demo
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
                    </svg>
                  </span>
                  <strong>
                    {membership.organizationSlug.startsWith("mimo-demo-")
                      ? "Mimo Veterinary Care"
                      : membership.organizationName}
                  </strong>
                  <span>
                    /{membership.organizationSlug}
                  </span>
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
