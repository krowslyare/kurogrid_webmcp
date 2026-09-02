# Agent-managed availability

Status: implemented and verified locally. This replaces the editorial Owner workflow as the primary submission story. It does not authorize commit, push, deployment, repository visibility changes, or submission.

## Product thesis

Kuro lets a general-purpose assistant translate an Owner's operating intent and external context into a reviewable availability plan exposed by a website.

The assistant may already have access to Google Calendar, Outlook, another scheduling tool, or user-provided intervals. Mimo does not implement a personal calendar reader and never needs event titles, attendees, or notes. It accepts desired weekly ranges, service duration, recurring blocks, and normalized busy intervals; combines them with Mimo's existing bookings; prepares one exact plan; waits for Owner approval; and lets affected customers accept their own alternatives.

    Owner intent + external busy intervals
    → complete availability plan
    → Mimo computes slots and booking impact
    → Owner reviews and approves
    → customer receives a proposal
    → customer accepts
    → public availability is consistent

The product is not calendar synchronization or an AI form filler. It is delegated availability operations with visible consequences and human authority at the consequential boundaries.

## Submission missions

### Mission 1: Customer appointment

Retain the existing customer journey: discover services, find live times, prepare a request, require customer confirmation, and return a private status link. This establishes that Mimo is already agent-usable before the Owner changes availability.

### Mission 2: Owner availability setup

The Owner asks their general-purpose assistant:

> Set dermatology availability for September. Tuesdays and Thursdays from 9 to 1, Saturdays from 9 to 2, thirty-minute appointments, keep lunch blocked from 12 to 1, incorporate the busy ranges from my calendar, and preserve existing bookings. Prepare the changes for review.

The assistant passes the requested rules and only normalized external intervals to Mimo. Mimo, not the agent, derives:

- which public slots are generated or removed across the requested period;
- which times remain blocked for lunch and external commitments;
- which appointments overlap;
- which appointments remain unaffected;
- valid alternatives under a visible deterministic policy;
- the exact customer proposals that would be sent.

### Mission 3: Customer resolution

After Owner approval and agent application:

- the new weekly ranges, duration, recurring blocks, and busy intervals become active;
- an alternative slot is held, not silently accepted;
- the affected appointment becomes time_proposed;
- one idempotent customer notification is attempted;
- the customer accepts or declines through the private page or WebMCP;
- acceptance confirms the held alternative and releases the original slot;
- public availability reflects blocked, held, and confirmed state.

## Scope

Primary submission surface:

- Mimo public website and customer appointment journey;
- Owner availability workspace;
- exact Owner approval;
- customer proposal and Calendar handoff;
- public availability parity.

Secondary, retained but not featured:

- synthetic attention cards and fixed editorial plan;
- site drafts, content publication, versions, and rollback;
- Member editorial role demonstration.

These may remain under Content operations and in the README. They must not compete with availability operations in the main demo or video.

Explicitly excluded:

- Google Calendar OAuth or ingestion inside Mimo;
- background two-way calendar sync;
- recurring events;
- multiple clinicians or rooms;
- generic bulk rescheduling or optimization;
- generic notification tools or workflow builders;
- automatic customer acceptance;
- medical prioritization.

## WebMCP contract

Add exactly three authenticated Owner tools. Reading current configuration is
not an approval step; it gives the agent the business context needed to update
rules without replacing them blindly.

### get_availability_configuration

Read-only output:

- current configured period and timezone;
- service duration;
- weekly opening ranges;
- recurring blocks;
- active one-off busy intervals;
- schedule revision;
- existing bookings summarized without unnecessary customer data.

### prepare_availability_plan

Input:

- site, service, period, and timezone;
- weekly operating ranges;
- service duration in minutes;
- recurring blocked ranges;
- one or more normalized busy intervals;
- whether existing bookings must be preserved;
- source kind, never event title or notes.

Mimo computes and persists one exact private plan with no operational side effects.

When preserve_existing_bookings is true, new weekly ranges and recurring blocks
control future availability but grandfather existing confirmed appointments.
One-off external busy intervals represent real conflicts and may therefore
require a customer proposal. In the fixture, Max remains confirmed at 12:00
even though future 12:00 to 13:00 times are blocked for lunch; Luna requires a
proposal because the external 10:00 to 11:30 interval conflicts with her visit.

Output:

- current schedule revision;
- normalized weekly ranges, duration, and recurring blocks;
- normalized intervals accepted;
- slots generated and removed from public availability;
- affected and unaffected appointments, calculated server-side;
- valid alternatives and deterministic recommendation;
- exact notification count;
- proposal identifier, revision, and consequence hash;
- original and proposed times;
- exact customer message preview;
- changes_applied: false;
- notifications_sent: false.

The agent cannot supply affected appointment IDs or declare alternatives.

### apply_approved_availability_plan

This tool appears only after an authenticated Owner approves the exact current proposal.

Transactional effects:

- revalidate proposal, revision, operating ranges, duration, recurring blocks, busy intervals, conflicts, holds, and approval;
- replace the requested period's configuration without overwriting other periods;
- activate busy intervals;
- generate the approved free slots and remove invalid overlapping slots;
- hold alternatives for affected appointments;
- set affected appointments to time_proposed;
- consume the approval;
- write one audit receipt.

Post-commit:

- attempt one idempotent notification per affected appointment;
- provider failure does not undo operational state;
- expose delivery status honestly.

The appointment is not moved or confirmed until the customer accepts.

## Alternative policy

Alternatives must:

1. use the same service;
2. preserve service duration;
3. fall inside published operating hours;
4. avoid busy intervals, existing bookings, and active holds;
5. prefer the nearest later time on the same day;
6. otherwise prefer the nearest earlier time;
7. return manual_resolution_required when no valid alternative exists.

Recurring availability rules never silently displace an existing confirmed
booking when preservation was requested. External busy intervals are evaluated
separately because the Owner has declared those times unavailable in practice.

The policy must be visible in the impact preview. Do not call a result best without showing the rule.

## Minimal persistence

clinic_availability_configurations:

- organization, site, service, period, and timezone;
- weekly operating ranges and slot duration;
- recurring blocked ranges;
- active revision and audit timestamps.

Normalized one-off busy intervals live inside the bounded configuration JSON.
They store timestamps and the source kind only. External event titles,
attendees, notes, and provider tokens are never persisted.

availability_plans:

- organization, site, creator, status, and revision;
- requested period, weekly ranges, duration, recurring blocks, and normalized intervals;
- generated and removed slots;
- computed affected and unaffected requests;
- selected alternatives and slot holds;
- expected schedule revision and consequence hash;
- notification preview;
- approval, application, and idempotency metadata.

One migration may add both tables and the narrow RPCs required by the three tools.

## Reuse

Reuse the current appointment slots and requests, time_proposed state, private customer access, proposal response, Resend adapter, Calendar handoff, Owner membership, exact-approval pattern, WebMCP refresh, and demo sandbox isolation.

## Owner experience

The default workspace becomes an operational control room.

Above the fold:

- one compact September availability summary for Tuesday, Thursday, and Saturday;
- thirty-minute duration and the recurring 12:00 to 13:00 lunch block;
- Saturday timeline from 09:00 to 14:00 as the concrete impact example;
- Luna confirmed at 10:00;
- Max at 12:00 as the unaffected control;
- external interval from 10:00 to 11:30;
- prominent Continue with your assistant prompt;
- persistent assistant activity.

Impact preview:

    3 weekly operating ranges
    30 minute appointments
    lunch remains blocked
    N slots generated · N slots removed
    1 appointment affected
    1 appointment unaffected
    2 valid alternatives
    0 changes applied
    0 notifications sent

Exact approval:

    Luna · Dermatology
    Saturday 10:00 → proposed 11:30
    Max remains at 12:00
    One customer will be notified
    Nothing changes until you approve

After application:

    10:00–11:30 blocked
    11:30 held for Luna
    Luna awaiting customer response
    Max unchanged
    Email accepted by Resend / preview available

The editorial CMS moves below or behind Content operations.

## Three-minute story

Target: 2:32 to 2:42. Hard stop: 2:50, leaving ten seconds of export safety.

### 0:00–0:12 | Intent and agent action

Start already authenticated. Paste the complete September instruction immediately and show the agent beginning the real WebMCP call.

> Instead of configuring calendars screen by screen, I give my agent the operating rules once. Existing bookings must survive the change.

### 0:12–0:24 | Cross-app handoff

Show the general-purpose agent reading Mimo's current configuration and passing normalized external busy ranges.

> Mimo does not read my personal calendar. My agent already can. It passes only the busy interval into Mimo's WebMCP surface.

### 0:24–0:58 | Prepared plan

Call get_availability_configuration and prepare_availability_plan. Show Tuesday, Thursday, and Saturday rules; duration and lunch; generated and removed slots; Luna affected; Max unaffected; deterministic alternative; exact message; and zero side effects.

> Mimo turns intent into real availability, then checks that plan against its own bookings. The agent cannot declare who is affected or invent an alternative.

### 0:58–1:14 | Human authority

Owner approves the exact plan. apply_approved_availability_plan appears.

> I approve the exact interval, held alternative, and notification consequence.

### 1:14–1:36 | Apply

Agent applies. Show block, hold, unaffected appointment, audit receipt, and delivery status.

> Mimo publishes the September schedule, keeps lunch and external commitments blocked, and proposes a new time where required. It still does not accept on the customer's behalf.

### 1:36–2:00 | Customer decision

Open private status. The customer agent reads and accepts the proposal. Show the final receipt and Calendar handoff.

> Luna's owner reviews and accepts separately. The appointment becomes confirmed only now.

### 2:00–2:20 | Public parity

Use find_appointment_slots and the human booking UI. Show blocked and held times absent while other availability remains.

> People and agents now see the same operational truth.

### 2:20–2:40 | Close

Three-panel recap: Owner configured, customer confirmed, public availability current.

> One agent connected external context to a website operation, humans controlled both consequential decisions, and Mimo kept every surface consistent.

## Adversarial review disposition

Accepted from Luna:

- pivot from editorial publication to operational availability;
- receive normalized intervals rather than implement Google integration;
- derive affected appointments server-side;
- keep the Owner surface intentionally narrow around three business operations;
- remove analytics, drafts, publication, and rollback from the video;
- use one affected and one unaffected appointment;
- define a visible alternative policy;
- require five clean fixture runs before recording.

Modified:

- impact preview and proposal preparation remain one exact no-side-effect operation;
- reading current availability is a separate read-only operation because the agent must update rather than overwrite existing rules;
- applying a schedule change does not move the customer appointment;
- the alternative is held and proposed, then confirmed by the customer;
- held times are unavailable publicly;
- the CMS remains secondary rather than being deleted.

Rejected:

- showing raw idempotency keys in the video;
- requiring authenticated Google Calendar for judgeability;
- opening with a long list of internal tool names instead of the conflict.

## Gates

### Gate 1: Domain and data

- schedule revision and interval validation;
- overlap detection and alternative policy;
- active slot holds and stale proposal rejection;
- customer acceptance finalizes the held time;
- decline releases the hold and leaves manual resolution visible.

### Gate 2: WebMCP

- exactly three authenticated Owner tools;
- no apply tool before exact approval;
- refresh capabilities after prepare, approve, apply, accept, decline, logout, and role change;
- every execution re-resolves role, organization, proposal, and revision.

### Gate 3: Product UI

- Owner timeline and impact preview;
- exact approval surface;
- persistent agent activity;
- customer proposal receipt;
- human booking parity;
- content operations visually secondary.

### Gate 4: Verification

- affected and unaffected appointments calculated correctly;
- no side effects before approval;
- no duplicate block, proposal, hold, or email on retry;
- stale proposals and cross-tenant access fail;
- held and blocked slots do not appear publicly;
- acceptance confirms the hold and decline releases it;
- provider failure remains visible without corrupting schedule state.

### Gate 5: Demo readiness

- reset provisions Luna at 10:00 and Max at 12:00;
- external block is 10:00 to 11:30;
- deterministic alternative exists at 11:30;
- complete hosted workflow succeeds five consecutive times;
- preview responds in under two seconds in the fixture;
- apply responds in under three seconds excluding provider delivery;
- rehearsal lands below 2:42;
- no login, access code, analytics, editorial draft, rollback, or test output appears in the video.

## GO / NO-GO

GO only when:

- the delegated availability task is understood in the first twelve seconds;
- Mimo derives affected appointments and alternatives;
- Owner approval and customer acceptance are visibly separate;
- no side effect happens before approval;
- human and agent availability match afterward;
- the full hosted flow passes five consecutive resets;
- the final edit stays under 2:59.

NO-GO when:

- the flow is reducible to either a schedule form or reschedule_appointment(id, time);
- Google authentication is required for Mimo to work;
- the customer is moved before accepting;
- the video needs editorial publication or rollback to feel substantial;
- impact exists only in tool JSON or narration;
- the product cannot show one unaffected control appointment.
