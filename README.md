# Kuro Agent

### Websites assistants can safely use

Kuro Agent demonstrates two connected WebMCP journeys: a customer assistant can
complete an appointment outcome from a normal business website, and an Owner's
assistant can turn operating intent plus normalized calendar conflicts into an
exact availability plan without silently moving existing bookings.

[Live product](https://webmcp.kurogrid.com) ·
[Customer demo](https://webmcp.kurogrid.com/sites/mimo-01) ·
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

On the clinic side, an Owner can ask an assistant to configure a month of
service availability in one instruction. Mimo computes the generated slots,
conflicts, preserved bookings, and nearest valid alternatives. When that same
Owner instruction explicitly says to apply the matching result, the assistant
can approve and apply the exact plan from the authenticated session. Asking
only to prepare still stops for manual review. Each affected customer keeps
control of the proposed time.

The human website remains fully usable without WebMCP, including a traditional
booking form.

## Why this is not a CRUD demo

A booking form creates a record. Kuro Agent demonstrates a broader contract:

- **Contextual discovery:** tools appear only when the current role, resource,
  and state allow them.
- **Human authority:** an authenticated Owner may delegate exact application in
  the prompt or use the manual fallback; customers alone decide proposed times.
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
- **Derived operational impact:** the agent supplies desired ranges and
  normalized busy intervals; Mimo derives affected bookings and alternatives
  server-side instead of trusting agent-authored consequences.

WebMCP registration is not treated as authorization. Every execution is
resolved again on the server against the current session, tenant, role, and
resource state.

## Two connected product surfaces

### Customer: Mimo Veterinary Care

The public site exposes services, opening hours, availability, traditional
booking, and customer-safe WebMCP appointment tools. A prepared request always
returns to a private review page before it can be sent.

### Clinic: Kuro Agent workspace

The primary workspace is an availability control room. The Owner's assistant
can read the current schedule, prepare a September plan, and apply that exact
plan when the Owner's instruction explicitly asks it to. The server binds the
plan ID, revision, and hash and revalidates the schedule and booking impact in
one transaction. The concrete fixture blocks an external 10:00–11:30 conflict,
proposes 11:30 to Luna, and preserves Max's existing 12:00 booking even though
future lunch times are blocked.

The earlier editorial draft, publication, and rollback workflow remains as a
secondary surface. Neither workflow is a general CRM, calendar sync product,
or workflow builder.

## WebMCP surface

The browser adapter uses the imperative
`document.modelContext.registerTool()` API. Registrations are refreshed when
authentication, role, organization, resource, or appointment state changes.
Aborting the previous profile removes stale tools before the current profile is
registered.

Owner capabilities include:

```text
get_availability_configuration
prepare_availability_plan
apply_availability_plan           # exact Owner-delegated path after prepare
apply_approved_availability_plan  # appears only after exact Owner approval

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

Open the [Mimo customer demo](https://webmcp.kurogrid.com/sites/mimo-01)
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
curl 'https://webmcp.kurogrid.com/api/webmcp/capabilities?siteSlug=mimo-01'
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
        │ identity + role + exact plan + tenant checks
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

- Owner availability planning from weekly rules and normalized busy intervals
- server-derived conflict detection and deterministic nearest-later alternatives
- exact Owner approval before availability application
- customer-controlled proposal acceptance and public slot parity
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
DEMO_NOTIFICATION_EMAIL=your-demo-inbox@example.com
```

Synthetic `.test` addresses remain in preview mode unless
`DEMO_NOTIFICATION_EMAIL` is set. Provider failure does not roll back the
appointment or invalidate its private status link.

## Project boundary

This is a greenfield, public-safe implementation. It does not reuse source
code, migrations, customer data, or internal documentation from the private
Kurogrid Portal.

The MIT license applies only to this repository. It does not grant rights to
private Kurogrid code, services, datasets, trademarks, or hosted environments.
