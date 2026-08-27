# Architecture

## Runtime boundaries

- **Next.js App Router:** authenticated operator UI and published website.
- **WebMCP adapter:** direct browser-native tool registration, refreshed when
  session, role, organization, or resource state changes.
- **Server application layer:** validates identity, role, revision, approval,
  idempotency, and tenant ownership before privileged mutations.
- **Supabase:** Auth, Postgres persistence, RLS, and audit records.

The browser adapter is intentionally small. It fetches a server-resolved
capability profile, calls `document.modelContext.registerTool()` directly, and
routes execution through one same-origin endpoint. That endpoint resolves the
current session and capability profile again; a registered tool is never an
authorization credential.

## Canonical publication model

`site_version` is the source of truth for public content. Publishing creates an
immutable version and atomically advances the site's published pointer. The
website and public WebMCP readers resolve that same pointer. Rollback advances
the pointer to a previous immutable version and records a new audit event.

## Concurrency

Draft writes use expected revision checks. A stale mutation returns a conflict
instead of merging silently. Publish consumes an approval bound to the exact
draft revision. Retrying with the same idempotency key returns the original
result; a different operation cannot reuse the approval.

The demo environment must support at least two isolated concurrent sessions.
Slot exhaustion returns an explicit unavailable response and does not leak or
reuse another session's organization.
