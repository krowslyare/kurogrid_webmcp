# Kurogrid WebMCP

A greenfield, public-safe implementation for demonstrating a tenant-aware
WebMCP workflow. This codebase does not reuse source code, migrations, customer
data, or internal documentation from the private Kurogrid Portal.

## Status

Gates 1–4 are implemented: tenant isolation, synthetic evidence and the fixed
Action Plan, exact site publication, and direct native WebMCP registration.
The final private-repository gate is demo sandboxing and release evidence.

## Demo contract

The P0 story is deliberately narrow:

1. Read one synthetic lead, one analytics snapshot, and one verified fact.
2. Produce a fixed three-step action plan.
3. Create and preview a structured website draft.
4. Publish only after exact, one-shot approval.
5. Prove parity between the published website and its public WebMCP tools.
6. List versions and roll back safely.

See [public scope](docs/public-scope.md), [architecture](docs/architecture.md),
and [security](docs/security.md).

## Local development

Requirements: Node 24 LTS (Node 26 is also accepted), npm, Docker, and the
Supabase CLI.

```bash
cp .env.example .env.local
npm install
npm run supabase:start
npm run dev
```

Copy the local publishable key printed by `supabase status` into `.env.local`.
No hosted project is required for local development.

The local stack uses ports `56320`–`56329` to avoid colliding with the default
Supabase CLI range.

## Verification

```bash
npm run check
npm run supabase:reset
npm test
```

`npm test` runs capability-profile unit tests, focused pgTAP policy tests, and
application-level Data API/RPC tests with valid users from separate
organizations. Tests require the local Supabase stack; they do not use GitHub
Actions or a hosted project.

## License

MIT. The license applies only to this repository, not to any private Kurogrid
codebase, service, dataset, trademark, or hosted environment.
