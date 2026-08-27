# Release checklist

Nothing in this checklist authorizes a hosted Supabase mutation, deployment,
repository visibility change, or Devpost submission. Perform those operations
only after explicit approval.

## Reproducibility

- [ ] Install from the lockfile with the submission Node version.
- [ ] Reset a clean local database and run `npm test` plus `npm run check`.
- [ ] Run database lint with no warnings.
- [ ] Provision the configured sandbox count from a clean environment.
- [ ] Confirm two simultaneous leases receive different organizations.
- [ ] Confirm the next request receives the capacity-exhausted message.
- [ ] Confirm logout releases a lease and the next claim receives clean fixtures.

## Product evidence

- [ ] Owner sees the complete state-appropriate tool surface.
- [ ] Member can draft and preview but never discovers or executes publish/rollback.
- [ ] Logout and account/role change unregister the previous tool profile.
- [ ] Human approval causes `publish_site_draft` to appear; publish consumes it.
- [ ] Human page and public `get_opening_hours` return the same version.
- [ ] Rollback creates a new immutable version and updates both surfaces.
- [ ] Real ChatGPT in-app browser and supported Chrome smoke tests pass.

## Public-safety audit

- [ ] No Portal source, history, customer data, internal docs, or real PII exists.
- [ ] Secret scan is clean and `.env*` remains ignored except `.env.example`.
- [ ] Dependency and license review is current.
- [ ] Threat model, dataset card, provenance, compatibility pin, and README agree.
- [ ] Repository license and challenge-required public evidence are present.
- [ ] Freeze repository, deployment, and submission for the judging period.
