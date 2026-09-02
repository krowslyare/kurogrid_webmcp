"use client";

import { useState } from "react";

import styles from "./availability-control-room.module.css";

type Props = {
  prompt: string;
};

export function CopyAvailabilityPrompt({ prompt }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "unavailable">("idle");

  async function copyPrompt() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(prompt);
      setState("copied");
    } catch {
      setState("unavailable");
    }
  }

  return (
    <div className={styles.copyAction}>
      <button className={styles.copyButton} type="button" onClick={copyPrompt}>
        <span className={styles.copyArrow} aria-hidden="true">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
          </svg>
        </span>
        {state === "copied" ? "Copied" : "Copy prompt"}
      </button>
      <span className={styles.copyFeedback} aria-live="polite">
        {state === "copied"
          ? "Ready to paste into your assistant."
          : state === "unavailable"
            ? "Clipboard access is unavailable in this browser."
            : "Use this exact request to prepare the plan."}
      </span>
    </div>
  );
}
