# Kurogrid WebMCP

A greenfield, public-safe implementation for demonstrating a tenant-aware
WebMCP workflow. This codebase does not reuse source code, migrations, customer
data, or internal documentation from the private Kurogrid Portal.

## Status

Gates 1–5 are implemented: tenant isolation, synthetic evidence and the fixed
Action Plan, exact site publication, direct native WebMCP registration, and an
isolated lease-backed demo pool. The hosted demo is live at
[kurogrid-webmcp.vercel.app](https://kurogrid-webmcp.vercel.app); its
Owner/Member workflow, parity, rollback, and isolation gates pass against the
dedicated hosted Supabase project.

## Demo contract

The P0 story is deliberately narrow:

1. Read one synthetic lead, one analytics snapshot, and one verified fact.
2. Produce a fixed three-step action plan.
3. Create and preview a structured website draft.
4. Publish only after exact, one-shot approval.
5. Prove parity between the published website and its public WebMCP tools.
6. List versions and roll back safely.

See [public scope](docs/public-scope.md), [architecture](docs/architecture.md),
[security](docs/security.md), and [demo runtime](docs/demo-runtime.md).

## Local development

Requirements: Node 24 LTS, npm, Docker, and the Supabase CLI. The repository
pins the Node major used by the submission deployment.

```bash
cp .env.example .env.local
npm install
npm run supabase:start
npm run demo:provision
npm run dev
```

Copy the local publishable and secret keys printed by `supabase status` into
`.env.local`, then set a demo access code and demo-user password. No hosted
project is required for local development.

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

Maintainers can run the destructive synthetic hosted-pool gate explicitly with
`npm run demo:verify-hosted`. It requires `.env.hosted.local`, refuses to run
against a busy pool, and finishes with zero active leases. It is never part of
build, test, or deployment.

## License

MIT. The license applies only to this repository, not to any private Kurogrid
codebase, service, dataset, trademark, or hosted environment.
