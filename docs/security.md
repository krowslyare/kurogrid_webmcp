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
- reusable `SECURITY DEFINER` helpers live outside exposed schemas;
  intentionally exposed mutation RPCs fix their `search_path`, revoke default
  execution, grant only the required role, derive tenant scope from the target
  resource, and recheck `auth.uid()` plus membership/role internally.
- Secret and service-role keys never reach browser bundles.

Gate 1 uses one reviewed `SECURITY DEFINER` membership predicate in the
unexposed `private` schema to avoid recursive membership policies. It fixes an
empty `search_path`, resolves `auth.uid()` internally, and is executable only
by authenticated and service roles.

## Mutating tools

Tool arguments are untrusted input. Mutations require schema validation,
current server identity, organization ownership, expected revision, and an
idempotency key. Publish additionally requires an unused approval for the exact
draft revision. Every accepted or rejected high-risk mutation is auditable.

Logout, role changes, organization switches, and resource transitions abort
stale WebMCP registrations before exposing the new capability set.

Policy tests run at two boundaries: pgTAP validates grants and RLS in Postgres;
Data API integration tests authenticate real synthetic users and prove that a
valid JWT from organization A cannot reach organization B.

## Demo boundary

Sandbox allocation is not a public database capability. `/demo` verifies a
server-side access code, calls a service-only lease RPC, signs in one synthetic
identity, and stores only a random lease token in an HttpOnly same-site cookie.
The database stores the token hash. Allocation uses row locks and never falls
back to an occupied tenant; exhaustion is a visible unavailable state.
