# Public scope

## P0 outcome

Show that a browser agent can discover only the operations available to the
current user, execute a reversible business change, and verify the same result
through the public website.

## Tool surface

Owner tools:

- `get_attention`
- `create_action_plan`
- `acknowledge_lead_attention`
- `get_site_content`
- `create_or_patch_site_draft`
- `preview_publish_consequences`
- `publish_site_draft`
- `get_opening_hours`
- `list_site_versions`
- `rollback_site_version`

Members can read attention and site state and prepare drafts. They cannot
publish or roll back. The public website exposes only tools derived from the
published version.

## Explicit non-goals

- General CRM, analytics, workflow, policy, grant, or experiment engines
- Real lead outreach, messaging providers, PII, billing, or subscriptions
- Compatibility with private Portal schemas or APIs
- Generic site builders or arbitrary content models

The synthetic lead and analytics snapshot exist only to demonstrate composed
evidence. `acknowledge_lead_attention` records a reversible acknowledgement; it
does not contact anyone.
