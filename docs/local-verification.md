# Local verification evidence

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

Hosted Supabase, deployment, ChatGPT-hosted evaluation, Chrome 149+, and
submission freeze remain explicit release operations, not inferred from this
local evidence.
