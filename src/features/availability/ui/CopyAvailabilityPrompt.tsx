"use client";

import { useEffect, useRef, useState } from "react";

import { AgentMark, agentOptions } from "@/components/CopyAgentPrompt";

import styles from "./availability-control-room.module.css";

type Props = {
  prompt: string;
};

export function CopyAvailabilityPrompt({ prompt }: Props) {
  const [editablePrompt, setEditablePrompt] = useState(prompt);
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
  }, []);

  async function copyPrompt() {
    const request = editablePrompt.trim();

    if (!request) {
      setStatus("error");
      return;
    }

    try {
      const currentUrl = new URL(window.location.href);
      const pageUrl = `${currentUrl.origin}${currentUrl.pathname}`;
      await navigator.clipboard.writeText(`${request}\n\nWorkspace: ${pageUrl}`);
      setStatus("copied");
    } catch {
      setStatus("error");
    }

    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus("idle"), 2600);
  }

  return (
    <div className="clinic-copy-action">
      <div className="clinic-agent-request">
        <label htmlFor="availability-prompt-editor">Your request</label>
        <textarea
          id="availability-prompt-editor"
          onChange={(event) => {
            setEditablePrompt(event.target.value);
            setStatus("idle");
          }}
          rows={5}
          spellCheck="true"
          value={editablePrompt}
        />
        <small>Edit anything before you continue.</small>
        <button
          aria-label={status === "copied" ? "Prompt copied" : "Copy prompt"}
          className={`${styles.promptCopyCorner} ${status === "copied" ? styles.isCopied : ""}`}
          onClick={() => void copyPrompt()}
          title="Copy prompt"
          type="button"
        >
          <span aria-hidden="true">{status === "copied" ? "✓" : "⧉"}</span>
        </button>
      </div>

      <div className="clinic-agent-launchers" aria-label="Open an AI agent">
        {agentOptions.map((agent) => (
          <a
            href={agent.href}
            key={agent.label}
            onClick={() => void copyPrompt()}
            rel="noreferrer"
            target="_blank"
          >
            <AgentMark icon={agent.icon} />
            <span>
              <small>{agent.brand}</small>
              <strong>{agent.label}</strong>
            </span>
          </a>
        ))}
        <button onClick={() => void copyPrompt()} type="button">
          <AgentMark icon="other" />
          <span>
            <small>Any app</small>
            <strong>Other AI agent</strong>
          </span>
        </button>
      </div>
    </div>
  );
}
