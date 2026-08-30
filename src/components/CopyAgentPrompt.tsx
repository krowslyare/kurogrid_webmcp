"use client";

import { useState } from "react";

type CopyAgentPromptProps = {
  prompt: string;
};

export function CopyAgentPrompt({ prompt }: CopyAgentPromptProps) {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className="clinic-copy-prompt" onClick={copyPrompt} type="button">
      {copied ? "Copied" : "Copy request"}
    </button>
  );
}
