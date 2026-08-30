import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { CopyAgentPrompt } from "@/components/CopyAgentPrompt";
import {
  confirmAppointmentFromPage,
  prepareAppointmentFromPage,
  respondToAppointmentProposal,
  simulateClinicResponseFromPage,
} from "@/features/appointments/server/actions";
import { WebMcpRegistrar } from "@/features/webmcp/client/webmcp-registrar";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ siteSlug: string }>;
  searchParams: Promise<{
    access?: string;
    appointment?: string;
    bookingError?: string;
    confirm?: string;
    delivery?: string;
    mode?: string;
  }>;
};

type PublishedContent = {
  headline: string;
  summary: string;
  opening_hours: Record<string, string>;
  cta_label: string;
};

const scheduleOrder = [
  "weekdays",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "weekend",
] as const;

const getPublishedSite = cache(async (siteSlug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_published_site", {
    p_slug: siteSlug,
  });

  return error ? null : data?.[0] ?? null;
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { siteSlug } = await params;
  const published = await getPublishedSite(siteSlug);

  if (!published) {
    return {};
  }

  const content = published.content as PublishedContent;

  return {
    title: `Arboleda — ${content.headline}`,
    description: content.summary,
  };
}

function customerTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function nextSaturdayInLima(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Lima",
    year: "numeric",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)));
  const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  const rawOffset = 6 - isoWeekday;
  date.setUTCDate(date.getUTCDate() + (rawOffset <= 0 ? rawOffset + 7 : rawOffset));
  return date.toISOString().slice(0, 10);
}

function slotTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function slotDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function oneHourLater(value: string) {
  return new Date(new Date(value).getTime() + 60 * 60_000).toISOString();
}

function appointmentReference(value: string | undefined) {
  return value ? `ARB-${value.replaceAll("-", "").slice(-8).toUpperCase()}` : "ARB-DEMO";
}

function appointmentJourney(status: unknown) {
  const current = String(status);
  const index = current === "prepared" ? 0
    : current === "requested" ? 1
      : current === "time_proposed" ? 2
        : current === "confirmed" ? 3
          : 1;

  return ["Reviewed", "Sent", "Clinic reply", "Calendar"].map((label, step) => ({
    label,
    state: step < index ? "complete" : step === index ? "current" : "upcoming",
  }));
}

function googleCalendarUrl(appointment: Record<string, unknown>) {
  const startsAt = new Date(String(appointment.starts_at));
  const endsAt = new Date(
    startsAt.getTime() + Number(appointment.duration_minutes) * 60_000,
  );
  const stamp = (value: Date) => value.toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set(
    "text",
    `${String(appointment.service)} for ${String(appointment.pet_name)} · Arboleda`,
  );
  url.searchParams.set("dates", `${stamp(startsAt)}/${stamp(endsAt)}`);
  url.searchParams.set("location", "Clínica Veterinaria Arboleda");
  return url.toString();
}

export default async function PublishedSitePage({ params, searchParams }: PageProps) {
  const { siteSlug } = await params;
  const customerContext = await searchParams;
  const published = await getPublishedSite(siteSlug);

  if (!published) {
    notFound();
  }

  const content = published.content as PublishedContent;
  const supabase = await createClient();
  const servicesResult = await supabase.rpc("get_clinic_services", {
    p_site_slug: siteSlug,
  });
  const appointmentResult = customerContext.appointment && customerContext.access
    ? await supabase.rpc("get_appointment_status", {
        p_request_id: customerContext.appointment,
        p_access_token: customerContext.access,
      })
    : { data: null, error: null };
  const appointment = appointmentResult.data && typeof appointmentResult.data === "object"
    && !Array.isArray(appointmentResult.data)
    ? appointmentResult.data as Record<string, unknown>
    : null;
  const slotsResult = appointment
    ? { data: [], error: null }
    : await supabase.rpc("find_appointment_slots", {
        p_site_slug: siteSlug,
        p_service_slug: "dermatology",
        p_date: nextSaturdayInLima(),
      });
  const slots = slotsResult.data ?? [];
  const appointmentDate = slots[0] ? slotDate(slots[0].starts_at) : "next Saturday";
  const agentPrompt = `Find a dermatology appointment for Luna on ${appointmentDate} morning and email me if the clinic changes the time.`;
  const schedule = Object.entries(content.opening_hours).sort(([first], [second]) => {
    const firstIndex = scheduleOrder.indexOf(first as (typeof scheduleOrder)[number]);
    const secondIndex = scheduleOrder.indexOf(second as (typeof scheduleOrder)[number]);

    return (firstIndex < 0 ? scheduleOrder.length : firstIndex)
      - (secondIndex < 0 ? scheduleOrder.length : secondIndex);
  });

  return (
    <main
      className="published-site"
      data-published-version={published.version_id}
    >
      <header className="published-nav">
        <a className="clinic-brand" href="#top" aria-label="Arboleda, home">
          <span className="clinic-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" role="presentation">
              <path d="M20 34V15" />
              <path d="M20 22c-7 0-11-4-11-11 7 0 11 4 11 11Z" />
              <path d="M20 17c6 0 10-3 10-9-6 0-10 3-10 9Z" />
            </svg>
          </span>
          <span>
            <strong>Arboleda</strong>
            <small>Veterinary care</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#opening-hours">Hours</a>
          <a className="clinic-nav-cta" href="#agent-booking">
            {content.cta_label}
          </a>
        </nav>
      </header>

      <section className="clinic-hero" id="top">
        <div className="clinic-hero-copy">
          <p className="clinic-kicker">
            <span aria-hidden="true" /> Thoughtful care, every day
          </p>
          <h1>{content.headline}</h1>
          <p className="published-summary">{content.summary}</p>
          <div className="clinic-hero-actions">
            <a className="clinic-primary-cta" href="#agent-booking">
              {content.cta_label}
              <span aria-hidden="true">↘</span>
            </a>
            <a className="clinic-text-link" href="#our-approach">
              Our approach <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>

        <div className="clinic-hero-art" aria-hidden="true">
          <span className="clinic-orbit clinic-orbit-one" />
          <span className="clinic-orbit clinic-orbit-two" />
          <div className="clinic-monogram">A</div>
          <div className="clinic-art-note">
            <span>Care notes</span>
            <strong>Clear, calm,<br />considered.</strong>
          </div>
        </div>
      </section>

      <section className="clinic-booking" id="agent-booking" aria-labelledby="booking-title">
        <div className="clinic-booking-intro">
          <p className="clinic-section-index">01 / Appointments</p>
          <h2 id="booking-title">
            {appointment ? "Your appointment, in one clear place." : "Ask your assistant to find the right time."}
          </h2>
          <p>
            {appointment
              ? "This private link always reflects the clinic's latest response."
              : "Your assistant can read Arboleda's current services and available times directly from this page."}
          </p>
          {!appointment ? (
            <div className="clinic-agent-prompt">
              <span>Use this page with your AI assistant</span>
              <p className="clinic-agent-explainer">It reads live times here, prepares the request, and asks for your approval before Arboleda receives it.</p>
              <ol aria-label="How to use Arboleda with an assistant">
                <li><i>01</i> Open assistant</li>
                <li><i>02</i> Share this page</li>
                <li><i>03</i> Review before sending</li>
              </ol>
              <div className="clinic-agent-request">
                <p>{agentPrompt}</p>
                <CopyAgentPrompt prompt={agentPrompt} />
              </div>
            </div>
          ) : null}
        </div>

        {appointment ? (
          <article className="customer-appointment-card">
            <div className="customer-appointment-status">
              <span>Current status</span>
              <strong>{String(appointment.status).replaceAll("_", " ")}</strong>
            </div>
            <ol className="customer-appointment-journey" aria-label="Appointment progress">
              {appointmentJourney(appointment.status).map((step, index) => (
                <li data-state={step.state} key={step.label}>
                  <i>{step.state === "complete" ? "✓" : String(index + 1).padStart(2, "0")}</i>
                  <span>{step.label}</span>
                </li>
              ))}
            </ol>
            <h3>{String(appointment.service)} for {String(appointment.pet_name)}</h3>
            <p>{customerTime(String(appointment.starts_at))}</p>
            <small>Updates are sent to {String(appointment.customer_email)}</small>

            {customerContext.delivery && customerContext.delivery !== "preview" ? (
              <p className={`customer-delivery-notice customer-delivery-${customerContext.delivery}`}>
                {customerContext.delivery === "sent"
                  ? "Customer update sent by email."
                  : "The appointment is current here, but the email could not be sent."}
              </p>
            ) : null}

            {customerContext.delivery === "preview" ? (
              <article className="customer-email-preview">
                <div>
                  <span>Email preview · demo delivery</span>
                  <small>To {String(appointment.customer_email)}</small>
                </div>
                <strong>
                  {appointment.status === "time_proposed"
                    ? `Arboleda proposed a new time for ${String(appointment.pet_name)}`
                    : `${String(appointment.pet_name)}’s appointment is confirmed`}
                </strong>
                <p>
                  {appointment.status === "time_proposed"
                    ? `A new ${String(appointment.service).toLowerCase()} time is waiting for your review: ${customerTime(String(appointment.starts_at))}.`
                    : `${String(appointment.service)} · ${customerTime(String(appointment.starts_at))}.`}
                </p>
              </article>
            ) : null}

            {customerContext.bookingError === "response" ? (
              <p className="customer-delivery-notice customer-delivery-failed">
                The demo clinic response could not be completed. Start a fresh request and try again.
              </p>
            ) : null}

            {appointment.status === "prepared" ? (
              <div className="customer-review-request">
                <p>Nothing has been sent yet. Review the service, time, pet, and email above.</p>
                {customerContext.confirm ? (
                  <form action={confirmAppointmentFromPage}>
                    <input name="siteSlug" type="hidden" value={siteSlug} />
                    <input name="requestId" type="hidden" value={customerContext.appointment} />
                    <input name="accessToken" type="hidden" value={customerContext.access} />
                    <input name="confirmationToken" type="hidden" value={customerContext.confirm} />
                    <button className="clinic-primary-cta" type="submit">Send request to Arboleda</button>
                  </form>
                ) : <small>Return to the original review link to send this request.</small>}
              </div>
            ) : appointment.status === "requested" ? (
              <div className="customer-demo-response">
                <p className="customer-next-step">Request sent. In the real product, Arboleda replies from its staff workspace.</p>
                <div className="customer-demo-response-heading">
                  <span>Demo-only handoff</span>
                  <p>Trigger a fictional clinic reply to see the customer update and calendar handoff.</p>
                </div>
                <div className="customer-demo-response-actions">
                  <form action={simulateClinicResponseFromPage}>
                    <input name="siteSlug" type="hidden" value={siteSlug} />
                    <input name="requestId" type="hidden" value={customerContext.appointment} />
                    <input name="accessToken" type="hidden" value={customerContext.access} />
                    <input name="decision" type="hidden" value="propose" />
                    <button className="clinic-primary-cta" type="submit">
                      Suggest {slotTime(oneHourLater(String(appointment.starts_at)))}
                    </button>
                  </form>
                  <form action={simulateClinicResponseFromPage}>
                    <input name="siteSlug" type="hidden" value={siteSlug} />
                    <input name="requestId" type="hidden" value={customerContext.appointment} />
                    <input name="accessToken" type="hidden" value={customerContext.access} />
                    <input name="decision" type="hidden" value="confirm" />
                    <button className="clinic-text-button" type="submit">Accept as requested</button>
                  </form>
                </div>
              </div>
            ) : appointment.status === "time_proposed" ? (
              <div className="customer-proposal">
                <p>Arboleda proposed this new time. You remain in control.</p>
                <div>
                  <form action={respondToAppointmentProposal}>
                    <input name="siteSlug" type="hidden" value={siteSlug} />
                    <input name="requestId" type="hidden" value={customerContext.appointment} />
                    <input name="accessToken" type="hidden" value={customerContext.access} />
                    <input name="response" type="hidden" value="accept" />
                    <button className="clinic-primary-cta" type="submit">Accept new time</button>
                  </form>
                  <form action={respondToAppointmentProposal}>
                    <input name="siteSlug" type="hidden" value={siteSlug} />
                    <input name="requestId" type="hidden" value={customerContext.appointment} />
                    <input name="accessToken" type="hidden" value={customerContext.access} />
                    <input name="response" type="hidden" value="decline" />
                    <button className="clinic-text-button" type="submit">Decline</button>
                  </form>
                </div>
              </div>
            ) : appointment.status === "confirmed" ? (
              <div className="customer-calendar-actions">
                <article className="customer-appointment-receipt">
                  <header><span>Appointment receipt</span><strong>Confirmed</strong></header>
                  <dl>
                    <div><dt>Reference</dt><dd>{appointmentReference(customerContext.appointment)}</dd></div>
                    <div><dt>Visit</dt><dd>{String(appointment.service)} · {String(appointment.pet_name)}</dd></div>
                    <div><dt>When</dt><dd>{customerTime(String(appointment.starts_at))}</dd></div>
                    <div><dt>Updates</dt><dd>{String(appointment.customer_email)}</dd></div>
                  </dl>
                  <small>Fictional Arboleda demo · this private page remains the source of truth.</small>
                </article>
                <div>
                  <a href={googleCalendarUrl(appointment)} target="_blank" rel="noreferrer">Google Calendar ↗</a>
                  <a href={`/api/appointments/calendar?appointment=${customerContext.appointment}&access=${customerContext.access}`}>Download .ics ↗</a>
                </div>
              </div>
            ) : null}
          </article>
        ) : (
          <div className="clinic-booking-options">
            <div className="clinic-service-list" aria-label="Available appointment services">
              {(servicesResult.data ?? []).map((service, index) => (
                <article key={service.service_slug}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><h3>{service.service_name}</h3><p>{service.description}</p></div>
                  <strong>{service.duration_minutes} min</strong>
                </article>
              ))}
            </div>

            <details className="clinic-human-booking">
              <summary>
                <div><span>Prefer not to use an assistant?</span><strong>Book traditionally on this page</strong></div>
                <em>{slots.length
                  ? `${slots.length} live ${slots.length === 1 ? "time" : "times"} · Open form`
                  : "No times available"}</em>
              </summary>
              <div className="clinic-human-booking-body">
                <p>The form and your assistant use the same published services and availability. Either way, you review before sending.</p>
                {customerContext.bookingError ? (
                  <p className="clinic-booking-error">
                    {customerContext.bookingError === "confirm"
                      ? "That time is no longer available. Start a new request."
                      : "The request could not be prepared. Check the details and try again."}
                  </p>
                ) : null}
                {slots.length ? (
                  <form action={prepareAppointmentFromPage}>
                    <input name="siteSlug" type="hidden" value={siteSlug} />
                    <input name="serviceSlug" type="hidden" value="dermatology" />
                    <fieldset>
                      <legend>Dermatology · {appointmentDate}</legend>
                      <div className="clinic-slot-options">
                        {slots.map((slot, index) => (
                          <label key={slot.slot_id}>
                            <input defaultChecked={index === 0} name="slotId" type="radio" value={slot.slot_id} />
                            <span>{slotTime(slot.starts_at)}</span>
                            <small>{slot.duration_minutes} min</small>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="clinic-booking-fields">
                      <label>Pet name<input maxLength={80} name="petName" placeholder="Luna" required /></label>
                      <label>Email for updates<input inputMode="email" maxLength={200} name="customerEmail" placeholder="you@example.com" required type="email" /></label>
                    </div>
                    <button className="clinic-primary-cta" type="submit">Review appointment request</button>
                  </form>
                ) : <p>No dermatology times are currently available.</p>}
              </div>
            </details>
          </div>
        )}
      </section>

      <section className="clinic-details" aria-label="Care approach and opening hours">
        <article className="clinic-approach" id="our-approach" aria-labelledby="approach-title">
          <p className="clinic-section-index">01 / Approach</p>
          <h2 id="approach-title">Good care starts before the appointment.</h2>
          <p>
            Clear information makes every visit feel simpler. Know when to
            come, what to expect, and where your attention belongs: with them.
          </p>
          <div className="clinic-values" aria-label="Care principles">
            <span>Clear guidance</span><span>Calm visits</span><span>Current information</span>
          </div>
        </article>

        <article className="clinic-hours" id="opening-hours" aria-labelledby="hours-title">
          <div className="clinic-hours-heading">
            <p className="clinic-section-index">02 / Visit</p>
            <div>
              <h2 id="hours-title">Find a time that fits.</h2>
              <p>Current published hours, kept in one reliable place.</p>
            </div>
          </div>
          <dl>
            {schedule.map(([label, value], index) => (
              <div key={label}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <dt>{label.replaceAll("_", " ")}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </article>
      </section>

      <section className="clinic-closing" aria-labelledby="closing-title">
        <div>
          <p className="clinic-kicker">A calmer kind of care</p>
          <h2 id="closing-title">Make room for the moments that matter.</h2>
        </div>
        <a className="clinic-primary-cta clinic-primary-cta-light" href="#opening-hours">
          {content.cta_label}
          <span aria-hidden="true">↑</span>
        </a>
      </section>

      <footer className="clinic-footer">
        <div className="clinic-footer-brand">
          <strong>Arboleda</strong>
          <span>Veterinary care with a gentler rhythm.</span>
        </div>
        <WebMcpRegistrar
          siteSlug={siteSlug}
          appointmentId={customerContext.appointment}
          accessToken={customerContext.access}
          confirmationToken={customerContext.confirm}
          contextKey={JSON.stringify([published.version_id, appointment?.status ?? null])}
          presentation="public-site"
        />
        <div className="clinic-footer-meta">
          <Link href="/app">Clinic staff workspace · demo access ↗</Link>
          <span>Published information</span>
          <span>Version {published.version_number}</span>
        </div>
      </footer>
    </main>
  );
}
