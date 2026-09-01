# Kuro Agent

### Websites assistants can safely use

Kuro Agent demonstrates a customer journey in which a compatible AI assistant
discovers actions directly from a business website, reads live information,
prepares a request, and stops before a consequential action requires human
approval.

[Live product](https://webmcp.kurogrid.com) ·
[Customer demo](https://webmcp.kurogrid.com/sites/arboleda-01) ·
[Architecture](docs/architecture.md) ·
[Security model](docs/security.md) ·
[Video script](docs/submission-video-script.md)

> Mimo is a fictional veterinary clinic built to prove one complete WebMCP
> interaction. No customer data or private Kurogrid code is included.

## The idea

Most websites expose pages. Assistants still have to interpret those pages,
guess what can be done, and hand users into a separate workflow.

Kuro Agent makes the website itself a contextual capability surface:

1. A customer asks for a dermatology visit on Saturday morning.
2. The assistant discovers Mimo's current services and appointment tools.
3. It reads live availability and prepares an exact request.
4. The customer reviews the service, time, pet, and email before sending.
5. The clinic accepts the request or proposes another time.
6. The customer receives a private update and can add the result to Calendar.

The human website remains fully usable without WebMCP, including a traditional
booking form.

## Why this is not a CRUD demo

A booking form creates a record. Kuro Agent demonstrates a broader contract:

- **Contextual discovery:** tools appear only when the current role, resource,
  and state allow them.
- **Human authority:** the assistant can prepare work, but exact one-shot
  approval protects consequential publication and customer actions.
- **One published truth:** the public page and its WebMCP tools resolve the same
  immutable site version.
- **Role boundaries:** Members can prepare drafts; only Owners can publish or
  roll back.
- **Stateful capability changes:** appointment tools change after preparation,
  confirmation, acceptance, or rescheduling.
- **Reversibility and auditability:** publication creates immutable versions;
  rollback restores an earlier version without rewriting history.
- **A completed outcome:** the flow ends with a clinic response, private status
  link, email update, and Calendar handoff.

WebMCP registration is not treated as authorization. Every execution is
resolved again on the server against the current session, tenant, role, and
resource state.

## Two connected product surfaces

### Customer: Mimo Veterinary Care

The public site exposes services, opening hours, availability, traditional
booking, and customer-safe WebMCP appointment tools. A prepared request always
returns to a private review page before it can be sent.

### Clinic: Kuro Agent workspace

The workspace combines a synthetic customer signal, analytics snapshot, and
verified business fact into a fixed action plan. The Owner can create a site
draft, preview the consequences for people and assistants, approve the exact
revision, publish it, prove public parity, and roll it back.

The synthetic evidence demonstrates cross-module reasoning. It is intentionally
not a general CRM, analytics suite, workflow engine, or site builder.

## WebMCP surface

The browser adapter uses the imperative
`document.modelContext.registerTool()` API. Registrations are refreshed when
authentication, role, organization, resource, or appointment state changes.
Aborting the previous profile removes stale tools before the current profile is
registered.

Owner capabilities include:

```text
get_attention
create_action_plan
acknowledge_lead_attention
get_site_content
create_or_patch_site_draft
preview_publish_consequences
publish_site_draft
get_opening_hours
list_site_versions
rollback_site_version
```

Members receive the read and drafting subset. The public Mimo page exposes only
customer-safe capabilities derived from the published site and appointment
state. See the complete [public scope](docs/public-scope.md) and
[WebMCP compatibility notes](docs/webmcp-compatibility.md).

### Observe the native capability surface

Open the [Mimo customer demo](https://webmcp.kurogrid.com/sites/arboleda-01)
in a compatible WebMCP host. The reviewed Chrome setup requires the WebMCP
testing flag described in the compatibility notes. The initial public profile
registers five tools:

```text
get_site_content
get_opening_hours
get_clinic_services
find_appointment_slots
prepare_appointment_request
```

Preparing an appointment changes the resource state and refreshes the available
tools. Confirmation is separate and one-time; preparation never submits the
request silently.

Without a compatible host, the server-resolved public profile remains
inspectable as JSON:

```bash
curl 'https://webmcp.kurogrid.com/api/webmcp/capabilities?siteSlug=arboleda-01'
```

That endpoint proves the schema and contextual profile, while the submission
video demonstrates native discovery and execution inside the browser.

## Architecture

```text
Compatible assistant
        │
        ▼
Browser-native WebMCP registration
        │ same-origin execution
        ▼
Next.js application layer
        │ identity + role + revision + approval + tenant checks
        ▼
Supabase Auth + Postgres + RLS + audit log
        │
        ├── immutable published version ──► human website
        └── immutable published version ──► public WebMCP tools
```

- **Next.js 16 / React 19:** public site, customer review, and clinic workspace.
- **Supabase:** authentication, Postgres persistence, RLS, RPCs, and audit
  records.
- **Resend:** best-effort appointment updates with deterministic idempotency.
- **Vercel:** hosted product and isolated demo runtime.

Read [architecture](docs/architecture.md), [security](docs/security.md), and
[dataset provenance](docs/provenance.md) for the reviewed contracts.

## Demo and verification

The live customer surface needs no access code. The isolated clinic walkthrough
uses the code supplied with the challenge submission. Demo sessions are backed
by a bounded lease pool, separated by organization, and reset for reuse.

The verified release covers:

- Owner publish and immutable rollback
- Member draft access without publish or rollback
- parity between public HTML and public WebMCP data
- two concurrent isolated demo leases
- explicit capacity exhaustion, expiry, release, and clean reuse
- cross-organization Data API and RPC isolation
- restricted Resend sender and successful delivery request from a verified domain

Run the local quality gates with:

```bash
npm run check
npm run supabase:reset
npm test
```

`npm test` runs capability-profile unit tests, focused pgTAP policy tests, and
application-level Data API/RPC tests with valid users from separate
organizations. It does not require GitHub Actions or a hosted project.

Maintainers can run the destructive synthetic hosted-pool gate explicitly with
`npm run demo:verify-hosted`. It refuses to run against a busy pool and finishes
with zero active leases.

## Local development

Requirements: Node 24 LTS, npm, Docker, and the Supabase CLI.

```bash
cp .env.example .env.local
npm install
npm run supabase:start
npm run demo:provision
npm run dev
```

Copy the local publishable and secret keys printed by `supabase status` into
`.env.local`, then configure a demo access code and demo-user password. The
local stack uses ports `56320` through `56329` to avoid the default Supabase
range.

### Optional email delivery

Without a provider, the demo shows an honest in-product email preview. To send
the same appointment update through Resend, configure these server-only values:

```bash
APP_BASE_URL=https://your-deployment.example
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="Mimo <appointments@your-verified-domain.example>"
```

Provider failure does not roll back the appointment or invalidate its private
status link.

## Project boundary

This is a greenfield, public-safe implementation. It does not reuse source
code, migrations, customer data, or internal documentation from the private
Kurogrid Portal.

The MIT license applies only to this repository. It does not grant rights to
private Kurogrid code, services, datasets, trademarks, or hosted environments.
