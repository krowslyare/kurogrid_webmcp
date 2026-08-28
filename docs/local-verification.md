# Verification evidence

Verified on 2026-08-27 against local Supabase and the Codex in-app browser's
native WebMCP host.

## Automated

- 5 capability-profile unit tests pass.
- 112 pgTAP schema, grant, RLS, and function assertions pass.
- 17 direct Data API/RPC flows pass with real synthetic JWTs, including lease
  binding, expiration, release, exhaustion, and reuse.
- lint, TypeScript, production build, database lint, and `git diff --check` pass.
- production dependency audit reports zero known vulnerabilities.

## Native browser smoke

- Owner began with five state-appropriate tools.
- `get_attention` returned exactly the three synthetic fixtures.
- creating the lead Action Plan updated the human UI and registration profile.
- acknowledging the lead removed that capability and reported
  `communication_sent: false`.
- creating a draft caused `preview_publish_consequences` to appear.
- the human approval action caused `publish_site_draft` to appear.
- native publish consumed approval, removed publish, and exposed published
  reads plus version history.
- the public page registered only `get_site_content` and `get_opening_hours`.
- public WebMCP returned the same canonical version and hours rendered by the
  human page.
- switching to Member reset the sandbox and exposed no publish/rollback tools.
- leaving the workspace unregistered its tools; logout released the lease and
  left zero active local leases.

## Hosted release smoke

Verified on 2026-08-27 at
[`kurogrid-webmcp.vercel.app`](https://kurogrid-webmcp.vercel.app):

- the linked hosted database applied exactly the four repository migrations and
  passed remote schema lint;
- two isolated sandboxes and four synthetic demo identities were provisioned;
- public signup and anonymous table access were denied;
- Owner completed evidence, fixed Action Plan, acknowledgement without
  communication, draft, exact preview, human approval, and native publish;
- publish consumed its one-shot approval and exposed the published reads and
  immutable version history;
- the public human page and both public tools returned the same canonical
  version and Saturday hours;
- a second publish followed by rollback created version 3 and restored version
  1 content on both public surfaces;
- Member created and previewed a draft but never discovered publish or rollback;
- role changes and both logouts unregistered the previous tool profile;
- the explicit hosted-pool verifier proved two concurrent isolated leases,
  third-request exhaustion, direct cross-tenant Data API denial, expiry and
  release denial, clean reuse, and zero active leases afterward.

Chrome 151.0.0.0 with `#enable-webmcp-testing` enabled exposed
`document.modelContext`, registered the five initial Owner tools, and executed
native `get_attention` with the three synthetic fixtures. The smoke uncovered
and fixed a host-compatibility edge: Chrome omitted the optional execution
context, so the adapter now preserves cancellation when present without
requiring that argument. Logout left `getTools()` empty. Repository
visibility/public evidence, the video, and the judging-period freeze remain the
explicit pre-submission gates.
