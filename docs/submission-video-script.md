# Kuro Agent submission video

Target: 2:50 to 2:57, 1920 by 1080, spoken in English.

Core message: a website can expose enough structured capability for an
assistant to complete customer work and reconcile an Owner's real schedule,
while people keep control of the decisions that affect them.

## Recording setup

- Reset and provision the hosted demo immediately before recording.
- Start already signed in and record short clips, not one uninterrupted take.
- Keep four tabs ready: Mimo, the compatible assistant, the Owner workspace,
  and the private customer status page.
- Use the September fixture: Luna at 10:00, Max at 12:00, external busy range
  10:00–11:30, and proposed alternative 11:30.
- Configure `DEMO_NOTIFICATION_EMAIL` if a real Resend inbox will be shown;
  otherwise show the honest preview receipt.
- Hide access codes, IDs, unrelated tabs, developer tools, and loading time.

## Exact Owner prompt

> Set dermatology availability for September. Tuesdays and Thursdays from 9 to 1, Saturdays from 9 to 2, thirty-minute appointments, keep lunch blocked from 12 to 1, incorporate the busy ranges from my calendar, and preserve existing bookings. Prepare the exact plan, and if it matches these constraints, approve and apply it from my authenticated Owner session. Send the customer update.

The assistant should use these Owner tools:

1. `get_availability_configuration`
2. `prepare_availability_plan`
3. `apply_availability_plan`, which appears only for the exact prepared plan
   and binds its ID, revision, and hash

## Script and shot list

### 0:00–0:13 | Cold open: show the result first

Screen: fast cuts between the Owner timeline and the customer's confirmed
11:30 receipt. Hold on `10:00–11:30 blocked`, `Luna → 11:30`, and
`Max unchanged · 12:00`.

Narration:

> One instruction changed a month of clinic availability, resolved a real conflict, preserved an existing booking, and let the affected customer choose the new time. This is running through tools exposed by the website itself.

### 0:13–0:33 | A customer website with native capabilities

Screen: Mimo beside the assistant. Ask it to list the tools exposed by the
page, then show the exact five public names. Briefly show the normal booking
form as the non-agent fallback.

Narration:

> Mimo still works as a normal website. In a compatible browser it also publishes five customer-safe tools for content, services, live times, and appointment preparation. WebMCP adds an agent path without removing the human one.

### 0:33–1:19 | One Owner instruction updates the real schedule

Screen: start in the Owner workspace. Paste the exact prompt once. Let the
assistant call `get_availability_configuration`, `prepare_availability_plan`,
and the newly available `apply_availability_plan`. Cut directly to the applied
impact UI and the customer delivery receipt.

Narration:

> The Owner describes the whole outcome once. Their assistant already knows the calendar, so Mimo receives only normalized busy ranges, never event titles, attendees, or provider access. Mimo derives eighty-three September slots, finds one conflict, preserves Max at noon, and proposes 11:30 to Luna. Because the Owner explicitly asked to apply the matching result, the assistant completes it from the authenticated session.

On-screen labels:

- External context: 10:00–11:30
- Luna: affected at 10:00
- Max: preserved at 12:00
- Recommended: 11:30
- Changes applied: Yes
- Customer update: Sent

### 1:19–1:42 | Authority without a click maze

Screen: briefly pair the Owner's exact prompt with the applied receipt. Show
the manual review button only as the fallback, then focus on the blocked range,
held alternative, preserved booking, and notification status.

Narration:

> This is not an unrestricted automation toggle. The authenticated Owner explicitly requested application, and the server still revalidates the exact plan ID, revision, hash, schedule, and booking impact in one transaction. If the prompt asks only to prepare, Mimo stops for manual review. And the clinic still cannot accept the new time on Luna's behalf.

### 1:42–2:10 | The notification becomes a customer workflow

Screen: show the Resend email or preview receipt, open the private link, and
show the proposed 11:30 time. Give the customer assistant one short prompt to
compare it with their calendar and answer. Show
`respond_to_appointment_proposal` with `accept: true`.

Narration:

> Luna's owner receives a private update, opens it with their assistant, and asks one question: does this fit my calendar? The page exposes a capability specific to this proposal, so the assistant accepts 11:30. That response tool immediately disappears.

### 2:10–2:32 | Complete outcome

Screen: show the confirmed appointment receipt, then the Google Calendar and
ICS actions. Return briefly to the Owner receipt showing `Customer accepted`.

Narration:

> The appointment is now confirmed at 11:30. The customer can add it to Google Calendar or download an iCalendar file, while the clinic sees the same resolved state.

### 2:32–2:50 | Public parity

Screen: call `find_appointment_slots` for Saturday and show only 09:00, 09:30,
13:00, and 13:30. Pair it with the public human booking surface.

Narration:

> Human visitors and assistants now read the same availability. The busy range, lunch block, Max's preserved booking, and Luna's accepted time are all excluded from the public result. There is no second agent-only schedule to drift.

### 2:50–2:57 | Close

Screen: Mimo, Owner receipt, and confirmed customer receipt. End on Kuro Agent
and the live URL.

Narration:

> Kuro Agent turns a website into a shared operating surface for customers, owners, and their assistants.

## Editing rules

- Show working tool calls, not a technical architecture walkthrough.
- Do not type long prompts live; paste them or cut directly to the result.
- Keep tool names on screen only when they prove a capability change.
- Remove login, provisioning, waiting, and repeated demonstrations.
- If the cut runs long, shorten the initial customer discovery before removing
  Owner preparation, exact approval, or customer acceptance.

## Final preflight

- The first working result appears inside 10 seconds.
- The public page exposes five customer tools.
- The Owner begins with read and prepare; delegated apply appears only for the
  exact prepared plan.
- One explicit Owner prompt drives prepare and apply; no approval click is used
  in the primary cut.
- The manual review path remains available when the Owner asks only to prepare.
- Luna moves from 10:00 to a proposed 11:30; Max remains at 12:00.
- The customer accepts through the private page or its WebMCP tool.
- The confirmed receipt exposes Google Calendar and ICS.
- Public human and WebMCP availability match after the change.
- Every claim shown in the video is running in the recorded build.
- The final export is public on YouTube, includes audio, and stays below three
  minutes.
