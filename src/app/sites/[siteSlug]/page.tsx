import { notFound } from "next/navigation";

import { WebMcpRegistrar } from "@/features/webmcp/client/webmcp-registrar";
import { createClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ siteSlug: string }> };

type PublishedContent = {
  headline: string;
  summary: string;
  opening_hours: Record<string, string>;
  cta_label: string;
};

export default async function PublishedSitePage({ params }: PageProps) {
  const { siteSlug } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_published_site", {
    p_slug: siteSlug,
  });
  const published = data?.[0];

  if (error || !published) {
    notFound();
  }

  const content = published.content as PublishedContent;

  return (
    <main className="published-site">
      <WebMcpRegistrar siteSlug={siteSlug} contextKey={published.version_id} />
      <p className="kicker">Published version {published.version_number}</p>
      <h1>{content.headline}</h1>
      <p className="published-summary">{content.summary}</p>
      <dl>
        {Object.entries(content.opening_hours).map(([label, value]) => (
          <div key={label}>
            <dt>{label.replaceAll("_", " ")}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <button type="button">{content.cta_label}</button>
      <small>Canonical version: {published.version_id}</small>
    </main>
  );
}
