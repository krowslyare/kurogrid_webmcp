# Release checklist

Nothing in this checklist authorizes a hosted Supabase mutation, deployment,
repository visibility change, or Devpost submission. Perform those operations
only after explicit approval.

## Reproducibility

- [x] Install from the lockfile with the submission Node version.
- [x] Reset a clean local database and run `npm test` plus `npm run check`.
- [x] Run database lint with no warnings.
- [x] Provision the configured sandbox count from a clean environment.
- [x] Confirm two simultaneous leases receive different organizations.
- [x] Confirm the next request receives the capacity-exhausted message.
- [x] Confirm logout releases a lease and the next claim receives clean fixtures.
- [x] Confirm an expired lease loses direct Data API/RPC access before reuse.

## Product evidence

- [x] Owner sees the complete state-appropriate tool surface.
- [x] Member can draft and preview but never discovers or executes publish/rollback.
- [x] Logout and account/role change unregister the previous tool profile.
- [x] Human approval causes `publish_site_draft` to appear; publish consumes it.
- [x] Human page and public `get_opening_hours` return the same version.
- [x] Rollback creates a new immutable version and updates both surfaces.
- [x] Real ChatGPT in-app browser smoke passes.
- [ ] Chrome 149+ with the WebMCP runtime enabled passes native-tool smoke.

## Public-safety audit

- [x] No Portal source, history, customer data, internal docs, or real PII exists.
- [x] Secret scan is clean and `.env*` remains ignored except `.env.example`.
- [x] Dependency and license review is current.
- [x] Threat model, dataset card, provenance, compatibility pin, and README agree.
- [ ] Repository license and challenge-required public evidence are present.
- [ ] Freeze repository, deployment, and submission for the judging period.
