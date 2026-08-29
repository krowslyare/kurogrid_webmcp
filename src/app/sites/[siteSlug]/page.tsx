import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { respondToAppointmentProposal } from "@/features/appointments/server/actions";
import { WebMcpRegistrar } from "@/features/webmcp/client/webmcp-registrar";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ siteSlug: string }>;
  searchParams: Promise<{ appointment?: string; access?: string; confirm?: string }>;
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
              : "Arboleda exposes services and live demo availability directly to compatible agents through WebMCP."}
          </p>
          {!appointment ? (
            <div className="clinic-agent-prompt">
              <span>Try this with your agent</span>
              <p>Find a dermatology appointment for Luna this Saturday morning and email me if the clinic changes the time.</p>
            </div>
          ) : null}
        </div>

        {appointment ? (
          <article className="customer-appointment-card">
            <div className="customer-appointment-status">
              <span>Current status</span>
              <strong>{String(appointment.status).replaceAll("_", " ")}</strong>
            </div>
            <h3>{String(appointment.service)} for {String(appointment.pet_name)}</h3>
            <p>{customerTime(String(appointment.starts_at))}</p>
            <small>Updates are sent to {String(appointment.customer_email)}</small>

            {appointment.status === "prepared" ? (
              <p className="customer-next-step">Review complete. Ask your agent to submit this exact request.</p>
            ) : appointment.status === "requested" ? (
              <p className="customer-next-step">Request sent. Arboleda will accept it or propose another time.</p>
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
                <strong>Confirmed by Arboleda</strong>
                <div>
                  <a href={googleCalendarUrl(appointment)} target="_blank" rel="noreferrer">Google Calendar ↗</a>
                  <a href={`/api/appointments/calendar?appointment=${customerContext.appointment}&access=${customerContext.access}`}>Download .ics ↗</a>
                </div>
              </div>
            ) : null}
          </article>
        ) : (
          <div className="clinic-service-list" aria-label="Available appointment services">
            {(servicesResult.data ?? []).map((service, index) => (
              <article key={service.service_slug}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><h3>{service.service_name}</h3><p>{service.description}</p></div>
                <strong>{service.duration_minutes} min</strong>
              </article>
            ))}
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
          <Link href="/app">Clinic workspace ↗</Link>
          <span>Published information</span>
          <span>Version {published.version_number}</span>
        </div>
      </footer>
    </main>
  );
}
