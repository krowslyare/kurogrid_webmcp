"use client";

import { useState } from "react";

type Props = {
  prompt: string;
};

export function CopyAppointmentPrompt({ prompt }: Props) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(
        `${prompt}\n\nPrivate appointment page: ${window.location.href}`,
      );
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <button className="customer-agent-copy" onClick={copyPrompt} type="button">
      <span aria-hidden="true">{status === "copied" ? "✓" : "AI"}</span>
      {status === "copied"
        ? "Prompt copied"
        : status === "error"
          ? "Copy unavailable"
          : "Continue with your agent"}
    </button>
  );
}
