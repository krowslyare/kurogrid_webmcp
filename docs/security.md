# Security contract

## Tenant isolation

Every tenant-owned row includes `organization_id`. RLS checks authenticated
membership and role for every read and mutation. Server-side operations repeat
organization and role checks; possession of a valid JWT is not sufficient.

Negative tests must prove that a valid user from organization A cannot read or
mutate organization B through UI routes, Data API requests, or RPC calls.

## Supabase exposure

- New tables are not auto-exposed.
- Data API grants are explicit and reviewed separately from RLS.
- User-editable metadata is never an authorization source.
- Views use `security_invoker` by default.
- `SECURITY DEFINER` functions, if unavoidable, live outside exposed schemas,
  fix their `search_path`, revoke public execution, and check membership.
- Secret and service-role keys never reach browser bundles.

## Mutating tools

Tool arguments are untrusted input. Mutations require schema validation,
current server identity, organization ownership, expected revision, and an
idempotency key. Publish additionally requires an unused approval for the exact
draft revision. Every accepted or rejected high-risk mutation is auditable.

Logout, role changes, organization switches, and resource transitions abort
stale WebMCP registrations before exposing the new capability set.
