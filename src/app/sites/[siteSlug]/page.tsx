import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AmbientPaws } from "@/components/AmbientPaws";
import { CopyAgentPrompt } from "@/components/CopyAgentPrompt";
import { CopyAppointmentPrompt } from "@/components/CopyAppointmentPrompt";
import { TalkToMimoConsole } from "@/components/TalkToMimoConsole";
import { TraditionalBooking } from "@/components/TraditionalBooking";
import {
  confirmAppointmentFromPage,
  respondToAppointmentProposal,
  simulateClinicResponseFromPage,
} from "@/features/appointments/server/actions";
import { nextSaturdayInLima } from "@/features/appointments/lib/booking-days";
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
    edit?: string;
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

const UUID_REGEX = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const isUuid = (val?: string): val is string => Boolean(val && UUID_REGEX.test(val));

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
    title: `Mimo | ${content.headline}`,
    description: content.summary,
    icons: {
      icon: [
        { url: "/mimo-icon-32.png", type: "image/png", sizes: "32x32" },
        { url: "/mimo-icon.svg", type: "image/svg+xml" },
      ],
      apple: "/apple-touch-icon.png",
      shortcut: "/mimo-icon-32.png",
    },
  };
}

function customerTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function slotTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

function oneHourLater(value: string) {
  return new Date(new Date(value).getTime() + 60 * 60_000).toISOString();
}

function appointmentReference(value: string | undefined) {
  return value ? `MIM-${value.replaceAll("-", "").slice(-8).toUpperCase()}` : "MIM-DEMO";
}

function appointmentJourney(status: unknown) {
  const current = String(status);
  const labels = current === "declined"
    ? ["Reviewed", "Sent", "Clinic reply", "Declined"]
    : ["Reviewed", "Sent", "Clinic reply", "Calendar"];
  const index = current === "prepared" ? 0
    : current === "requested" ? 1
      : current === "time_proposed" ? 2
        : current === "confirmed" || current === "declined" ? 3
          : 1;

  return labels.map((label, step) => ({
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
    `${String(appointment.service)} for ${String(appointment.pet_name)} · Mimo`,
  );
  url.searchParams.set("dates", `${stamp(startsAt)}/${stamp(endsAt)}`);
  url.searchParams.set("location", "Clínica Veterinaria Mimo");
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
  const appointmentResult = isUuid(customerContext.appointment) && isUuid(customerContext.access)
    ? await supabase.rpc("get_appointment_status", {
        p_request_id: customerContext.appointment,
        p_access_token: customerContext.access,
      })
    : { data: null, error: null };
  const appointmentRecord = appointmentResult.data && typeof appointmentResult.data === "object"
    && !Array.isArray(appointmentResult.data)
    ? appointmentResult.data as Record<string, unknown>
    : null;
  const editingAppointment = customerContext.edit === "1"
    && appointmentRecord?.status === "prepared";
  const appointment = editingAppointment ? null : appointmentRecord;
  const slotsResult = appointment
    ? { data: [], error: null }
    : await supabase.rpc("find_appointment_slots", {
        p_site_slug: siteSlug,
        p_service_slug: "dermatology",
        p_date: nextSaturdayInLima(),
      });
  const slots = slotsResult.data ?? [];
  const bookingServices = (servicesResult.data ?? []).map((service) => ({
    slug: service.service_slug,
    name: service.service_name,
    duration_minutes: service.duration_minutes,
  }));
  const defaultBookingService = bookingServices.some((service) => service.slug === "dermatology")
    ? "dermatology"
    : bookingServices[0]?.slug ?? "dermatology";
  const agentPrompt = "Find the earliest available dermatology appointment this Saturday morning, make sure it doesn't clash with my calendar, show me the alternatives, and do not book anything yet.";
  const proposalPrompt = "11:30 works for me. Accept Mimo's proposal and give me the calendar link.";
  const editSearch = appointmentRecord && customerContext.appointment
    && customerContext.access && customerContext.confirm
    ? new URLSearchParams({
        access: customerContext.access,
        appointment: customerContext.appointment,
        confirm: customerContext.confirm,
        edit: "1",
      })
    : null;
  const editHref = editSearch
    ? `/sites/${siteSlug}?${editSearch}`
    : `/sites/${siteSlug}#agent-booking`;
  const schedule = Object.entries(content.opening_hours).sort(([first], [second]) => {
    const firstIndex = scheduleOrder.indexOf(first as (typeof scheduleOrder)[number]);
    const secondIndex = scheduleOrder.indexOf(second as (typeof scheduleOrder)[number]);

    return (firstIndex < 0 ? scheduleOrder.length : firstIndex)
      - (secondIndex < 0 ? scheduleOrder.length : secondIndex);
  });
  const hasHolidays = schedule.some(([label]) => label.toLowerCase().includes("holiday"));

  return (
    <main
      className="published-site"
      data-published-version={published.version_id}
    >
      <AmbientPaws />
      {appointment ? (
        <aside className="customer-appointment-banner" aria-live="polite">
          <div className="customer-appointment-banner-inner">
            <div className="customer-appointment-banner-text">
              <span className={`appointment-status is-${String(appointment.status)}`}>
                {String(appointment.status).replaceAll("_", " ")}
              </span>
              <span>
                Appointment for <strong>{String(appointment.pet_name)}</strong>
                {appointment.status === "time_proposed" ? " · Alternative time proposed" : ""}
              </span>
            </div>
            <a className="customer-appointment-banner-action" href="#agent-booking">
              View update & respond ↓
            </a>
          </div>
        </aside>
      ) : null}
      <header className="published-nav">
        <a className="clinic-brand" href="#top" aria-label="Mimo Veterinary Care, home">
          <span className="clinic-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" role="presentation">
              <circle cx="11" cy="13" r="4" />
              <circle cx="20" cy="9" r="4" />
              <circle cx="29" cy="13" r="4" />
              <circle cx="33" cy="22" r="4" />
              <path d="M20 17c-7 0-12 6-12 12 0 4 3 6 7 5 3-1 4-3 5-3s2 2 5 3c4 1 7-1 7-5 0-6-5-12-12-12Z" />
            </svg>
          </span>
          <span>
            <strong>Mimo</strong>
            <small>Veterinary care</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#services">Services</a>
          <a href="#opening-hours">Hours</a>
          <a className="clinic-nav-cta" href="#agent-booking">
            {appointment ? "View appointment" : content.cta_label}
          </a>
        </nav>
      </header>

      <section className="clinic-hero" id="top">
        <div className="clinic-hero-copy">
          <h1>{content.headline}</h1>
          <p className="published-summary">{content.summary}</p>
          <div className="clinic-hero-actions">
            <a className="clinic-primary-cta" href="#agent-booking">
              {appointment ? "Review appointment update" : content.cta_label}
              <span className="clinic-cta-arrow" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </span>
            </a>
            <a className="clinic-text-link" href="#our-approach">
              Our approach
              <span className="clinic-inline-arrow" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v10M4 9l4 4 4-4" />
                </svg>
              </span>
            </a>
          </div>
          <p className="clinic-assistant-ready"><span aria-hidden="true" /> Assistant-ready appointment planning</p>
        </div>

        <div className="clinic-hero-art" aria-hidden="true">
          <div className="clinic-dog-stage">
            <Image
              alt=""
              className="clinic-dog-photo"
              fill
              priority
              sizes="(max-width: 980px) 82vw, 38vw"
              src="/mimo-dog.webp"
            />
          </div>
          <div className="clinic-art-note">
            <span>Now welcoming</span>
            <strong>Saturday<br />appointments.</strong>
          </div>
        </div>
      </section>

      <section className="clinic-services" id="services" aria-labelledby="services-title">
        <div className="clinic-services-intro">
          <p className="clinic-section-index">Services</p>
          <h2 id="services-title">Care tailored to every visit.</h2>
          <p>
            Specialized consultations and routine treatments designed for calm, unhurried attention.
          </p>
        </div>

        <div className="clinic-service-list" aria-label="Available appointment services">
          {(servicesResult.data ?? []).map((service) => (
            <article key={service.service_slug}>
              <div><h3>{service.service_name}</h3><p>{service.description}</p></div>
              <strong>{service.duration_minutes} min</strong>
            </article>
          ))}
        </div>
      </section>

      <section
        className="clinic-booking"
        data-state={appointment ? "appointment" : "planning"}
        id="agent-booking"
        aria-labelledby="booking-title"
      >
        <div className="clinic-booking-intro">
          <p className="clinic-section-index">Appointments</p>
          <h2 id="booking-title">
            {appointment ? "Your appointment, in one clear place." : "Ask your AI agent to find the right time."}
          </h2>
          <p>
            {appointment
              ? "This private link always reflects the clinic's latest response."
              : "Want help choosing? Your AI agent can compare Mimo's available times with your calendar and preferences."}
          </p>

          {!appointment ? (
            <TraditionalBooking
              key={editingAppointment ? "editing" : "normal"}
              bookingError={customerContext.bookingError}
              defaultDate={nextSaturdayInLima()}
              defaultServiceSlug={defaultBookingService}
              initialCustomerEmail={editingAppointment ? String(appointmentRecord?.customer_email ?? "") : undefined}
              initialOpen={editingAppointment || Boolean(customerContext.bookingError)}
              initialPetName={editingAppointment ? String(appointmentRecord?.pet_name ?? "") : undefined}
              initialStartsAt={editingAppointment ? String(appointmentRecord?.original_starts_at ?? "") : undefined}
              services={bookingServices}
              siteSlug={siteSlug}
              slots={slots}
            />
          ) : null}
        </div>

        {!appointment ? (
          <div className="clinic-agent-prompt">
            <TalkToMimoConsole
              siteSlug={siteSlug}
              defaultDate={nextSaturdayInLima()}
            />
            <p className="clinic-agent-explainer" style={{ marginTop: "24px" }}>
              Or launch your own external AI assistant:
            </p>
            <CopyAgentPrompt prompt={agentPrompt} />
          </div>
        ) : null}

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
                    ? `Mimo proposed a new time for ${String(appointment.pet_name)}`
                    : appointment.status === "declined"
                      ? `You declined Mimo’s proposed time for ${String(appointment.pet_name)}`
                      : `${String(appointment.pet_name)}’s appointment is confirmed`}
                </strong>
                <p>
                  {appointment.status === "time_proposed"
                    ? `A new ${String(appointment.service).toLowerCase()} time is waiting for your review: ${customerTime(String(appointment.starts_at))}.`
                    : appointment.status === "declined"
                      ? "No replacement time was booked. You can return to Mimo’s current availability and choose another option."
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
                <div className="customer-review-actions">
                  {customerContext.confirm ? (
                    <form action={confirmAppointmentFromPage}>
                      <input name="siteSlug" type="hidden" value={siteSlug} />
                      <input name="requestId" type="hidden" value={customerContext.appointment} />
                      <input name="accessToken" type="hidden" value={customerContext.access} />
                      <input name="confirmationToken" type="hidden" value={customerContext.confirm} />
                      <button className="clinic-primary-cta" type="submit">Send request to Mimo</button>
                    </form>
                  ) : <small>Return to the original review link to send this request.</small>}
                  <Link className="clinic-text-button" href={editHref}>
                    <span className="clinic-inline-arrow" aria-hidden="true">
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 8H3M7 4L3 8l4 4" />
                      </svg>
                    </span>
                    Edit details
                  </Link>
                </div>
              </div>
            ) : appointment.status === "requested" ? (
              <div className="customer-demo-response">
                <p className="customer-next-step">Request sent. In the real product, Mimo replies from its staff workspace.</p>
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
                <Link
                  className="clinic-text-button"
                  href={`/sites/${siteSlug}#talk-to-mimo`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "12px",
                    color: "#ced7d1",
                    fontSize: "12px",
                  }}
                >
                  <span className="clinic-inline-arrow" aria-hidden="true">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 8H3M7 4L3 8l4 4" />
                    </svg>
                  </span>
                  Start a new request
                </Link>
              </div>
            ) : appointment.status === "time_proposed" ? (
              <div className="customer-proposal">
                <p>Mimo proposed this new time. You remain in control.</p>
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
                <aside className="customer-proposal-agent">
                  <div>
                    <strong>One prompt is enough.</strong>
                    <span>Your agent can compare this time with your calendar and answer Mimo here.</span>
                  </div>
                  <CopyAppointmentPrompt prompt={proposalPrompt} />
                </aside>
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
                  <small>Fictional Mimo demo · this private page remains the source of truth.</small>
                </article>
                <div className="customer-calendar-actions">
                  <div>
                    <a href={googleCalendarUrl(appointment)} target="_blank" rel="noreferrer">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                        <line x1="16" x2="16" y1="2" y2="6" />
                        <line x1="8" x2="8" y1="2" y2="6" />
                        <line x1="3" x2="21" y1="10" y2="10" />
                      </svg>
                      Add to Google Calendar
                    </a>
                    <a href={`/api/appointments/calendar?appointment=${customerContext.appointment}&access=${customerContext.access}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" x2="12" y1="15" y2="3" />
                      </svg>
                      Download .ics (Apple / Outlook)
                    </a>
                  </div>
                  <Link
                    className="clinic-text-button"
                    href={`/sites/${siteSlug}#talk-to-mimo`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: "16px",
                      padding: "8px 0",
                      color: "#ced7d1",
                      fontSize: "12px",
                    }}
                  >
                    <span className="clinic-inline-arrow" aria-hidden="true">
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 8H3M7 4L3 8l4 4" />
                      </svg>
                    </span>
                    Book another visit for another pet
                  </Link>
                </div>
              </div>
            ) : appointment.status === "declined" ? (
              <div className="customer-declined-state">
                <span>Proposal declined</span>
                <h4>No replacement time was booked.</h4>
                <p>Mimo still has your request. Return to the live schedule when you are ready to choose another time.</p>
                <Link className="clinic-secondary-cta" href={`/sites/${siteSlug}#agent-booking`}>
                  Check current availability
                </Link>
              </div>
            ) : null}
          </article>
        ) : null}
      </section>

      <section className="clinic-details" aria-label="Care approach and opening hours">
        <article className="clinic-approach" id="our-approach" aria-labelledby="approach-title">
          <p className="clinic-section-index">Our approach</p>
          <h2 id="approach-title">Good care starts before the appointment.</h2>
          <p>
            Clear information makes every visit feel simpler. Know when to
            come, what to expect, and where your attention belongs: with them.
          </p>
          <dl className="clinic-principles-list" aria-label="Care principles">
            <div>
              <dt>Clear guidance</dt>
              <dd>Know what to expect and how to prepare before you arrive.</dd>
            </div>
            <div>
              <dt>Calm visits</dt>
              <dd>Unhurried care tailored to your pet&apos;s comfort and pace.</dd>
            </div>
            <div>
              <dt>Current</dt>
              <dd>Reliable availability kept in sync for you and your assistant.</dd>
            </div>
          </dl>
        </article>

        <article className="clinic-hours" id="opening-hours" aria-labelledby="hours-title">
          <p className="clinic-section-index">Opening hours</p>
          <h2 id="hours-title">Find a time that fits.</h2>
          <p className="clinic-hours-desc">Current published hours, kept in one reliable place.</p>
          <dl>
            {schedule.map(([label, value]) => (
              <div key={label}>
                <dt>{label.replaceAll("_", " ")}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            {!hasHolidays ? (
              <div>
                <dt>Holidays</dt>
                <dd>To be confirmed</dd>
              </div>
            ) : null}
          </dl>
        </article>
      </section>

      <section className="clinic-visit-invite" aria-labelledby="invite-title">
        <div className="clinic-invite-photo-layer" aria-hidden="true">
          <Image
            alt="Dog relaxing peacefully in Mimo veterinary lounge"
            className="clinic-invite-photo"
            fill
            sizes="(max-width: 1360px) 100vw, 1360px"
            src="/mimo-lounge.webp"
          />
          <div className="clinic-invite-scrim" />
        </div>

        <div className="clinic-invite-body">
          <h2 id="invite-title">A calmer visit for your pet starts here.</h2>
          <p>
            Unhurried consultations, gentle handling, and time to listen. We take
            the pace they need to feel completely relaxed and safe.
          </p>

          <div className="clinic-invite-actions">
            <a className="clinic-primary-cta clinic-primary-cta-light" href="#agent-booking">
              {content.cta_label}
              <span className="clinic-cta-arrow" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </span>
            </a>
            <span className="clinic-invite-subnote">Book directly or ask your AI assistant to check openings</span>
          </div>
        </div>
      </section>

      <footer className="clinic-footer">
        <div className="clinic-footer-brand">
          <strong>Mimo</strong>
          <span>Veterinary care with a gentler rhythm.</span>
        </div>
        <WebMcpRegistrar
          siteSlug={siteSlug}
          appointmentId={editingAppointment ? undefined : customerContext.appointment}
          accessToken={editingAppointment ? undefined : customerContext.access}
          confirmationToken={editingAppointment ? undefined : customerContext.confirm}
          contextKey={JSON.stringify([published.version_id, appointment?.status ?? null])}
          presentation="public-site"
        />
        <div className="clinic-footer-meta">
          <Link href="/demo">
            Staff workspace
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
          <span>Live version {published.version_number}</span>
        </div>
      </footer>
      {!appointment ? (
        <a className="floating-talk-agent-btn" href="#talk-to-mimo" aria-label="Talk to Mimo AI">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
          Talk to Mimo
        </a>
      ) : null}
    </main>
  );
}
