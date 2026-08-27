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

- Build one demonstrable path: evidence -> fixed action plan -> site draft ->
  exact preview -> publish -> public parity -> rollback.
- Synthetic lead and analytics records are evidence fixtures, not general CRM
  or analytics products.
- Keep the public website derived only from a published site version.
- Do not add billing, providers, real communications, workflow engines, grants
  frameworks, or private Portal compatibility unless the public scope changes.

## Security boundary

- Every tenant-owned row carries `organization_id`; authorization is enforced
  by RLS and repeated in privileged server mutations.
- Never authorize from user-editable JWT metadata.
- Browser code uses only the publishable key. Secret or service-role keys stay
  server-side and are not a substitute for tenant checks.
- New exposed tables require explicit grants and RLS policies. Views must use
  `security_invoker` unless there is a reviewed reason not to.
- Publish consumes a one-shot approval for the exact draft revision and emits
  an audit record. Conflicts fail closed.
- WebMCP tools must be refreshed when auth, role, organization, or resource
  state changes; abort stale registrations.

## Operations

- Use current stable dependencies that are compatible with the stack. Keep the
  lockfile for reproducibility and review major updates rather than avoiding
  them indefinitely.
- Local Supabase is the default development target. Do not link, push, deploy,
  or mutate remote Supabase/Vercel resources without explicit authorization.
