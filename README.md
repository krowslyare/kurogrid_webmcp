# Kurogrid WebMCP

A greenfield, public-safe implementation for demonstrating a tenant-aware
WebMCP workflow. This codebase does not reuse source code, migrations, customer
data, or internal documentation from the private Kurogrid Portal.

## Status

Gate 0 foundation. The application shell and local Supabase configuration are
ready; the product workflow is specified but not yet implemented.

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

## Verification

```bash
npm run check
```

Database and tenant-boundary tests will be added with the first migration.

## License

MIT. The license applies only to this repository, not to any private Kurogrid
codebase, service, dataset, trademark, or hosted environment.
