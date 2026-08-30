# Kuro Agent submission video

Target: 2:50 to 3:00, 16:9, spoken in English.

Core message: a website can expose safe, contextual capabilities directly to any compatible assistant while people remain in control of consequential actions.

## Recording setup

- Reset and provision the demo immediately before recording.
- Keep three tabs ready: Mimo customer site, clinic workspace, and the assistant.
- Use one customer request throughout: Luna, dermatology, Saturday morning.
- Keep the customer site at version 1 before starting the owner chapter.
- Use an email address that can receive the Resend update in production.
- Hide browser bookmarks, developer tools, local URLs, and unrelated tabs.
- Record at 1920 by 1080. Keep the cursor movement slow and intentional.

## Script and shot list

### 0:00 to 0:16 | The problem

Screen: Kuro Agent landing, then open Mimo.

Narration:

> Most websites are designed to answer people, but assistants still have to guess from pixels or brittle page text. Kuro Agent lets a website expose useful, contextual actions directly to an assistant, without giving up human control.

### 0:16 to 0:32 | A real customer site

Screen: Mimo hero, services, current hours, and the appointment section.

Narration:

> This is Mimo, a fictional veterinary clinic. It works as a normal customer website, including a traditional booking form. But the same page also publishes structured capabilities for assistants.

### 0:32 to 1:27 | The customer moment

Screen: Give the assistant this request:

> Find a dermatology appointment for Luna on Saturday morning and email me if the clinic changes the time.

Show the assistant discovering Mimo's tools, reading live services, finding available times, and preparing the request. Return to the private review page. Pause on the exact service, time, pet, and email. Confirm only after the review is visible.

Narration:

> I can ask my assistant naturally. It discovers the capabilities registered by this page, reads Mimo's live services and availability, and prepares a specific request. It does not submit anything silently. The page returns an exact private review, and I remain the person who decides whether to send it.

> After confirmation, the available tools change with the appointment state. The assistant can now read the latest status, but the one-time confirmation action is gone.

### 1:27 to 2:05 | The business updates one source of truth

Screen: Clinic workspace. Show the three evidence cards. Click Prepare website update, create the draft, pause on the customer and assistant consequence previews, approve, then publish.

Narration:

> On the clinic side, Kuro Agent combines a customer question, a demand signal, and one approved business fact. It produces a fixed action plan and a structured site draft. The owner previews the consequences for both customers and assistants, approves that exact revision, and publishes once.

> The public page and its assistant tools now read from the same immutable version. There is no second integration to update and no hidden drift between what people see and what agents can do.

### 2:05 to 2:22 | Prove parity and reversibility

Screen: Refresh Mimo and show the new Saturday headline and live version. Return to publication history, restore version 1, then refresh Mimo again.

Narration:

> The change is immediately visible on the customer site and in the structured tool surface. Every version remains immutable, so the owner can restore an earlier version without rewriting history.

### 2:22 to 2:46 | Close the appointment loop

Screen: Return to the customer request. Trigger the clinic's proposed time, show the email update, accept the new time, then show the confirmed receipt and Calendar actions.

Narration:

> Mimo can accept the request or propose a new time. The customer receives an email with a private status link, stays in control of the response, and finishes with a clear receipt plus Google Calendar and iCalendar handoff.

### 2:46 to 2:58 | Closing statement

Screen: Confirmed receipt, then Kuro Agent mark.

Narration:

> Kuro Agent turns a website from passive content into a safe capability surface. Contextual tools, exact human approval, one published truth, and a complete customer outcome.

## Recording priorities

If the recording runs long, shorten the owner chapter before touching the customer moment. Do not spend time on login, access codes, technical tool schemas, tenant IDs, test results, or implementation details. The proof is the changing capability surface and the completed customer outcome.

## Final preflight

- Customer page starts clean with three available times.
- The assistant sees the five initial public tools.
- Prepared state adds status and confirmation tools.
- Confirmed state ends with status and Calendar tools.
- Owner publish changes both the headline and live version.
- Rollback restores the original headline as a new immutable version.
- Resend delivery succeeds in the hosted environment.
- The final recording stays below three minutes.
