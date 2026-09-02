<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kurogrid WebMCP working contract

This repository is a greenfield, public-safe challenge implementation. Do not
copy source code, migrations, fixtures, secrets, customer data, or internal
documentation from the private Kurogrid Portal.

## Product boundary

- Build one primary operational path: an authenticated Owner describes
  availability rules, an agent combines that intent with normalized external
  busy intervals, Mimo derives slots and booking conflicts, the Owner reviews
  the exact plan, and affected customers decide on proposed alternatives.
- The public website and public WebMCP tools must resolve the same current
  services, slots, holds, and appointment state.
- Calendar providers remain external agent context. Store only normalized busy
  intervals, never provider credentials, event titles, attendees, or notes.
- Editorial drafts, publication versions, and rollback remain a secondary
  content-operations demonstration, not the primary challenge story.
- Do not add billing, calendar OAuth, background synchronization, generic
  workflow engines, multi-resource scheduling, grants frameworks, or private
  Portal compatibility.

## Security boundary

- Every tenant-owned row carries `organization_id`; authorization is enforced
  by RLS and repeated in privileged server mutations.
- Never authorize from user-editable JWT metadata.
- Browser code uses only the publishable key. Secret or service-role keys stay
  server-side and are not a substitute for tenant checks.
- New exposed tables require explicit grants and RLS policies. Views must use
  `security_invoker` unless there is a reviewed reason not to.
- Consequential publication and availability application consume one-shot
  approvals for exact current revisions and emit audit records. Conflicts and
  stale plans fail closed.
- WebMCP tools must be refreshed when auth, role, organization, or resource
  state changes; abort stale registrations.

## Operations

- Use current stable dependencies that are compatible with the stack. Keep the
  lockfile for reproducibility and review major updates rather than avoiding
  them indefinitely.
- Local Supabase is the default development target. Do not link, push, deploy,
  or mutate remote Supabase/Vercel resources without explicit authorization.
