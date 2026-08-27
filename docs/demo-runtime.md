# Demo runtime

The evaluator demo uses a finite pool of synthetic organizations. A lease owns
one complete sandbox; two simultaneous evaluators never share organization,
draft, version, attention, audit, or authentication state.

## Allocation contract

- `demo_runtime_config.capacity` is the enforced pool size and cannot be below 2.
- allocation is service-only and selects one free enabled slot with
  `FOR UPDATE SKIP LOCKED`;
- every claim atomically resets the selected organization to the three
  canonical synthetic evidence fixtures;
- leases expire after the configured duration and logout releases early;
- the raw lease token exists only in an HttpOnly same-site cookie; Postgres
  stores its SHA-256 hash;
- when no slot is free, `/demo` displays `All isolated demo slots are in use`
  and never reuses another evaluator's organization.

The access code, demo-user password, and Supabase secret key are server-only.
The claim RPC is not executable by `anon` or `authenticated`.

## Provisioning

Configure `DEMO_SANDBOX_CAPACITY` from 2 to 64 and run:

```bash
npm run demo:provision
```

The command is idempotent. It creates synthetic Owner/Member identities,
organizations, sites, and pool slots, then writes the same capacity to the
database. Local Supabase may use the script's local-only fallback password;
hosted environments require `DEMO_USER_PASSWORD` explicitly.

Provisioning is an explicit environment operation. It is not run by build,
tests, deployment, or GitHub Actions.
