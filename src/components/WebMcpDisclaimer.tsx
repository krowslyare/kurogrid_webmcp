"use client";

import { useId, useState } from "react";

type WebMcpDisclaimerProps = {
  variant: "customer" | "workspace";
  siteSlug?: string;
  organizationSlug?: string;
};

const CUSTOMER_QUESTIONS = [
  "Show Mimo's published services and Saturday availability for dermatology, then prepare a request for Luna — do not confirm anything yet.",
  "What are Mimo's opening hours and current site content?",
];

const WORKSPACE_QUESTIONS = [
  "Read the availability configuration and prepare a plan from the weekly rules plus busy intervals, then report conflicts without applying anything.",
  "List the publication versions and preview the consequences of publishing the current draft.",
];

export function WebMcpDisclaimer({ variant, siteSlug, organizationSlug }: WebMcpDisclaimerProps) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [isNative] = useState<boolean | null>(() => {
    if (typeof document === "undefined") return null;
    const context = (document as Document).modelContext;
    if (!context) return false;
    return context.__kurogridWebMcpShim !== true;
  });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const popId = useId();

  const open = hoverOpen || pinnedOpen;
  const questions = variant === "customer" ? CUSTOMER_QUESTIONS : WORKSPACE_QUESTIONS;
  const capabilitiesHref = variant === "customer"
    ? `/api/webmcp/capabilities?siteSlug=${encodeURIComponent(siteSlug ?? "mimo-01")}`
    : `/api/webmcp/capabilities?organizationSlug=${encodeURIComponent(organizationSlug ?? "")}`;

  const copyQuestion = async (question: string, index: number) => {
    try {
      const pageUrl = `${window.location.origin}${window.location.pathname}`;
      await navigator.clipboard.writeText(`${question}\n\nPage: ${pageUrl}`);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 2000);
    } catch {
      // Clipboard unavailable; user can select the text manually.
    }
  };

  return (
    <span
      className="webmcp-disclaimer"
      onMouseEnter={() => setHoverOpen(true)}
      onMouseLeave={() => setHoverOpen(false)}
    >
      <button
        type="button"
        className="webmcp-disclaimer-btn"
        aria-expanded={open}
        aria-describedby={popId}
        title="How WebMCP works here"
        onClick={() => setPinnedOpen((prev) => !prev)}
      >
        ?
      </button>
      {open ? (
        <span className="webmcp-disclaimer-pop" role="tooltip" id={popId}>
          <strong>Work with an agent</strong>
          <p>
            In a browser that supports WebMCP, an assistant such as ChatGPT or
            Claude discovers this page&apos;s tools and acts here directly.
          </p>
          <p className="webmcp-disclaimer-status">
            {isNative === null
              ? "Checking this browser's model context…"
              : isNative
                ? "Native WebMCP model context detected in this browser."
                : "This browser doesn't expose a native model context (demo shim active). Open this page in one that does, or paste a question below into any assistant with a page link."}
          </p>
          <span className="webmcp-disclaimer-questions-label">Questions to try</span>
          <span className="webmcp-disclaimer-questions">
            {questions.map((question, index) => (
              <span key={question} className="webmcp-disclaimer-question">
                <span>{question}</span>
                <button
                  type="button"
                  onClick={() => void copyQuestion(question, index)}
                >
                  {copiedIndex === index ? "Copied" : "Copy"}
                </button>
              </span>
            ))}
          </span>
          <span className="webmcp-disclaimer-links">
            <a href={capabilitiesHref} target="_blank" rel="noreferrer">Inspect capabilities JSON</a>
            <a href="https://developer.chrome.com/docs/ai/webmcp/" target="_blank" rel="noreferrer">Enable WebMCP in Chrome</a>
          </span>
        </span>
      ) : null}
    </span>
  );
}
