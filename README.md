# Kuro Agent

A public WebMCP testbed built around Mimo, a fictional veterinary clinic. It
lets you inspect browser tools, try customer appointment flows, and see how an
authenticated Owner's tools change with the current schedule and session.

[Live site](https://webmcp.kurogrid.com) · [Mimo customer page](https://webmcp.kurogrid.com/sites/mimo-01) · [Demo workspace](https://webmcp.kurogrid.com/demo)

The repository uses synthetic data. It contains no private Kurogrid Portal code
or customer records.

## What to try

1. Open the [Mimo customer page](https://webmcp.kurogrid.com/sites/mimo-01).
   The public site works as a normal website even without WebMCP support.
2. Open the floating **WebMCP Inspector** to see the current tool names and
   schemas. A compatible WebMCP browser host can discover and execute them.
3. Find a service and an open slot, prepare an appointment, then review the
   exact details before sending the request. Preparation alone does not send it.
4. With a code from the demo operator, open the
   [isolated clinic workspace](https://webmcp.kurogrid.com/demo). The Owner can
   prepare availability from weekly rules and normalized busy intervals,
   inspect conflicts and alternatives, and apply an exact plan. Affected
   customers decide whether to accept proposed times.
5. Compare the public page with its WebMCP tools. Both resolve the same
   published service, slot, and appointment state.

The public page initially exposes `get_site_content`, `get_opening_hours`,
`get_clinic_services`, `find_appointment_slots`, and
`prepare_appointment_request`. Available tools change after preparation,
confirmation, and other state transitions. The workspace has a separate
role-aware tool set. See [public scope](docs/public-scope.md) and
[compatibility](docs/webmcp-compatibility.md).

Native registration uses `document.modelContext.registerTool()`. Tool execution
is checked again on the server against the current session, tenant, role, and
resource state. Registration itself grants no permission. The Inspector is
useful in any modern browser; native execution needs a compatible WebMCP host.

You can also inspect the server-resolved public capability profile:

```bash
curl 'https://webmcp.kurogrid.com/api/webmcp/capabilities?siteSlug=mimo-01'
```

That endpoint shows the profile and JSON Schemas. To verify browser-native
discovery and execution, use a compatible host; the endpoint alone does not
prove native execution.

## Local setup

Requirements: Node 24 LTS, npm, Docker, and the Supabase CLI.

```bash
cp .env.example .env.local
npm install
npm run supabase:start
npm run demo:provision
npm run dev
```

Copy the local publishable and secret keys printed by `supabase status` into
`.env.local`, then configure `DEMO_ACCESS_CODE` and `DEMO_USER_PASSWORD`. Keep
those values server-side. Local Supabase uses ports `56320` through `56329`.

Run the focused checks:

```bash
npm run check
npm run supabase:reset
npm test
```

`npm test` covers capability profiles, database policies, and cross-organization
Data API/RPC behavior with synthetic identities. The hosted pool verifier,
`npm run demo:verify-hosted`, is a separate destructive check for a dedicated
synthetic environment; it refuses to start while leases are active.

See [architecture](docs/architecture.md), [security](docs/security.md),
[demo runtime](docs/demo-runtime.md), and
[local verification evidence](docs/local-verification.md) for implementation
details. The dated verification document records a past run and should be rerun
against current code.

## Boundaries

Calendar providers are external context. The app stores normalized busy
intervals, not provider credentials or event details. Publication and
availability application require exact current revisions and one-shot approval
where applicable. Demo identities and appointments are synthetic. The project
is a WebMCP experiment, not a production clinic system.

The MIT license applies to this repository only. It does not grant rights to private Kurogrid code, services, datasets, trademarks, or hosted environments.
