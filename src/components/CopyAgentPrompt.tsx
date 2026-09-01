"use client";

import { useEffect, useRef, useState } from "react";

type CopyAgentPromptProps = {
  prompt: string;
};

export function CopyAgentPrompt({ prompt }: CopyAgentPromptProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
  }, []);

  async function copyPrompt() {
    try {
      const currentUrl = new URL(window.location.href);
      const pageUrl = `${currentUrl.origin}${currentUrl.pathname}`;
      await navigator.clipboard.writeText(`${prompt}\n\nPage: ${pageUrl}`);
      setStatus("copied");
    } catch {
      setStatus("error");
    }

    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus("idle"), 2600);
  }

  return (
    <div className="clinic-copy-action">
      <button className="clinic-copy-prompt" onClick={copyPrompt} type="button">
        <span aria-hidden="true">{status === "copied" ? "✓" : "↗"}</span>
        {status === "copied" ? "Copied" : "Copy request"}
      </button>
      <p aria-live="polite" className={`clinic-copy-feedback is-${status}`}>
        {status === "copied"
          ? "Copied with the page link. Paste it into your assistant."
          : status === "error"
            ? "Copy failed. Select the request and try again."
            : "Includes this page link."}
      </p>
    </div>
  );
}
