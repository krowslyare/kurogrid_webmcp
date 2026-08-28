import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { WebMcpRegistrar } from "@/features/webmcp/client/webmcp-registrar";
import { createClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ siteSlug: string }> };

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

export default async function PublishedSitePage({ params }: PageProps) {
  const { siteSlug } = await params;
  const published = await getPublishedSite(siteSlug);

  if (!published) {
    notFound();
  }

  const content = published.content as PublishedContent;
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
          <a className="clinic-nav-cta" href="#opening-hours">
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
            <a className="clinic-primary-cta" href="#opening-hours">
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

      <section className="clinic-approach" id="our-approach" aria-labelledby="approach-title">
        <p className="clinic-section-index">01 / Approach</p>
        <div>
          <h2 id="approach-title">Good care starts before the appointment.</h2>
          <p>
            Clear information makes every visit feel simpler. Know when to
            come, what to expect, and where your attention belongs: with them.
          </p>
        </div>
      </section>

      <section className="clinic-hours" id="opening-hours" aria-labelledby="hours-title">
        <div className="clinic-hours-heading">
          <p className="clinic-section-index">02 / Visit</p>
          <div>
            <h2 id="hours-title">Find a time that fits.</h2>
            <p>Our current published hours, kept in one reliable place.</p>
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
      </section>

      <section className="clinic-closing" aria-labelledby="closing-title">
        <p className="clinic-kicker">A calmer kind of care</p>
        <h2 id="closing-title">Make room for the moments that matter.</h2>
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
          contextKey={published.version_id}
          presentation="public-site"
        />
        <div className="clinic-footer-meta">
          <span>Published information</span>
          <span>Version {published.version_number}</span>
        </div>
      </footer>
    </main>
  );
}
