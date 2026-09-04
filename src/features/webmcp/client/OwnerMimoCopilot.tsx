"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { speakMessage, stopSpeaking } from "@/lib/speech-synthesis";

type OwnerMimoCopilotProps = {
  organizationSlug: string;
  siteSlug?: string;
};

type ExecutionStep = {
  id: string;
  tool: string;
  status: "running" | "success" | "error";
  detail: string;
};

interface SpeechRecognitionItem {
  transcript: string;
}

interface SpeechRecognitionResultItem {
  [index: number]: SpeechRecognitionItem;
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultItem;
  };
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: unknown) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
}

export function OwnerMimoCopilot({ organizationSlug, siteSlug }: OwnerMimoCopilotProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldListenRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const win = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      };
      const RecognitionConstructor = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (RecognitionConstructor) {
        const recognition = new RecognitionConstructor();
        recognition.continuous = true;
        recognition.interimResults = true;
        const userLang = (typeof navigator !== "undefined" && navigator.language) || "en-US";
        recognition.lang = userLang;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onend = () => {
          if (shouldListenRef.current) {
            try {
              recognition.start();
            } catch {
              setIsListening(false);
              shouldListenRef.current = false;
            }
          } else {
            setIsListening(false);
          }
        };

        recognition.onerror = (event: unknown) => {
          const err = (event as { error?: string })?.error;
          if (err === "no-speech" || err === "aborted") return;
          setIsListening(false);
          shouldListenRef.current = false;
        };

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let transcript = "";
          for (let i = 0; i < event.results.length; i += 1) {
            const resultItem = event.results[i];
            if (resultItem && resultItem[0]) {
              transcript += resultItem[0].transcript;
            }
          }
          setPrompt(transcript);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      inputRef.current?.focus();
      return;
    }
    if (shouldListenRef.current || isListening) {
      shouldListenRef.current = false;
      setIsListening(false);
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    } else {
      shouldListenRef.current = true;
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch {
        // ignore
      }
    }
  };

  const toggleVoiceOutput = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    }
    setVoiceOutputEnabled((prev) => !prev);
  };

  const speakFeedback = (text: string) => {
    if (!voiceOutputEnabled) return;
    speakMessage(text, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const handlePromptSubmit = async (overridePrompt?: string) => {
    const textToRun = (overridePrompt ?? prompt).trim();
    if (!textToRun || isExecuting) return;

    if (shouldListenRef.current) {
      shouldListenRef.current = false;
      setIsListening(false);
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    }

    if (overridePrompt) {
      setPrompt(overridePrompt);
    }

    setIsExecuting(true);
    setSteps([]);

    const addStep = (tool: string, detail: string): string => {
      const id = Math.random().toString(36).substring(2, 9);
      setSteps((prev) => [...prev, { id, tool, status: "running", detail }]);
      return id;
    };

    const updateStep = (id: string, status: "success" | "error", detail: string) => {
      setSteps((prev) =>
        prev.map((step) => (step.id === id ? { ...step, status, detail } : step)),
      );
    };

    try {
      const doc = document as unknown as {
        modelContext?: {
          getTools?: () => Promise<Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }>>;
          executeTool: (name: string, input: Record<string, unknown>) => Promise<unknown>;
        };
      };
      const modelContext = doc.modelContext;
      if (!modelContext || typeof modelContext.executeTool !== "function") {
        throw new Error("WebMCP modelContext is not available in this workspace.");
      }

      // Step 1: Read real-time registered WebMCP tools for Owner
      const registeredTools = typeof modelContext.getTools === "function"
        ? await modelContext.getTools()
        : [];

      const inferStepId = addStep(
        "gemini-3.5-flash",
        `Evaluating owner intent against ${registeredTools.length} WebMCP tools...`,
      );

      const inferResponse = await fetch("/api/agent/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToRun,
          tools: registeredTools,
          context: {
            role: "owner",
            today: "2026-09-03",
            organizationSlug,
            siteSlug,
          },
        }),
      });

      const inferResult = (await inferResponse.json()) as {
        success: boolean;
        type: "tool_call" | "clarification" | "rate_limit";
        message?: string;
        call?: { name: string; args: Record<string, unknown> };
      };

      if (!inferResult.success) {
        const errorMsg = inferResult.message || "Clarification needed to execute owner action.";
        updateStep(inferStepId, "error", errorMsg);
        speakFeedback(errorMsg);
        setIsExecuting(false);
        return;
      }

      const call = inferResult.call;
      if (!call) {
        updateStep(inferStepId, "error", "No WebMCP tool selected.");
        speakFeedback("No WebMCP tool selected.");
        setIsExecuting(false);
        return;
      }

      updateStep(
        inferStepId,
        "success",
        `Gemini 3.5 Flash selected WebMCP tool "${call.name}".`,
      );

      // Step 2: Execute Owner WebMCP tool
      const execStepId = addStep(
        call.name,
        `Executing WebMCP tool ${call.name}...`,
      );

      // Supply default uuid/idempotency_key only if required by mutating tools
      const toolsNeedingIdempotency = [
        "prepare_availability_plan",
        "apply_availability_plan",
        "apply_approved_availability_plan",
        "publish_site_draft",
        "create_action_plan",
        "prepare_appointment_request",
      ];
      const preparedArgs = { ...call.args };
      if (toolsNeedingIdempotency.includes(call.name) && !preparedArgs.idempotency_key) {
        preparedArgs.idempotency_key =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
              });
      }

      const execResult = (await modelContext.executeTool(call.name, preparedArgs)) as Record<string, unknown>;

      let detail = `Tool ${call.name} executed successfully.`;
      if (call.name === "get_availability_configuration") {
        const ranges = Array.isArray(execResult?.weekly_ranges) ? execResult.weekly_ranges.length : 0;
        const busy = Array.isArray(execResult?.busy_intervals) ? execResult.busy_intervals.length : 0;
        detail = `Current availability loaded: ${ranges} weekly range(s), ${busy} busy interval(s).`;
      } else if (call.name === "get_attention") {
        const items = Array.isArray(execResult?.attention) ? execResult.attention.length : 0;
        detail = `Attention items loaded: ${items} active business signal(s).`;
      }

      updateStep(execStepId, "success", detail);
      speakFeedback(detail);
      router.refresh();
      setIsExecuting(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Owner copilot encountered an error.";
      addStep("error", message);
      speakFeedback(message);
      setIsExecuting(false);
    }
  };

  return (
    <section className="owner-copilot-container" aria-label="Owner Mimo Copilot">
      <div className="owner-copilot-header">
        <div className="owner-copilot-title-group">
          <span className="owner-copilot-badge">WebMCP Copilot</span>
          <h3>Mimo Owner Copilot</h3>
        </div>
        <p>Direct WebMCP operational assistant powered by Gemini 3.5 Flash.</p>
      </div>

      <div className="owner-copilot-input-shell">
        <button
          type="button"
          className={`talk-to-mimo-mic-btn ${isListening ? "is-listening" : ""}`}
          onClick={toggleListening}
          title={isListening ? "Listening... click to stop" : "Click to speak"}
          aria-label="Voice input"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
          {isListening ? <span className="mic-pulse" /> : null}
        </button>

        <button
          type="button"
          className={`talk-to-mimo-speaker-btn ${!voiceOutputEnabled ? "is-muted" : ""} ${isSpeaking ? "is-speaking" : ""}`}
          onClick={toggleVoiceOutput}
          title={voiceOutputEnabled ? (isSpeaking ? "Speaking... click to silence" : "Voice replies active (click to mute)") : "Voice replies muted (click to unmute)"}
          aria-label={voiceOutputEnabled ? "Mute voice feedback" : "Enable voice feedback"}
        >
          {voiceOutputEnabled ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
        </button>

        {isListening || isSpeaking ? (
          <div className="talk-to-mimo-waveform" aria-hidden="true" title={isListening ? "Listening..." : "Speaking response..."}>
            <span className="waveform-bar wave-1" />
            <span className="waveform-bar wave-2" />
            <span className="waveform-bar wave-3" />
            <span className="waveform-bar wave-4" />
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="text"
          className="owner-copilot-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handlePromptSubmit();
            }
          }}
          placeholder={isListening ? "Listening..." : "e.g. Check our availability configuration and busy intervals"}
          disabled={isExecuting}
        />

        <div className="talk-to-mimo-submit-wrap">
          <span className="talk-key-hint" aria-hidden="true">↵</span>
          <button
            type="button"
            className="owner-copilot-submit-btn"
            onClick={() => void handlePromptSubmit()}
            disabled={isExecuting || !prompt.trim()}
            aria-label="Run Owner Copilot"
          >
            {isExecuting ? (
              <span className="talk-spinner" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="talk-to-mimo-pills">
        <span className="pills-label">Owner actions:</span>
        <button
          type="button"
          className="talk-pill"
          onClick={() => void handlePromptSubmit("Check our availability configuration and busy intervals")}
          disabled={isExecuting}
        >
          Check availability configuration
        </button>
        <button
          type="button"
          className="talk-pill"
          onClick={() => void handlePromptSubmit("Review attention items and business evidence")}
          disabled={isExecuting}
        >
          Review attention items
        </button>
        <button
          type="button"
          className="talk-pill"
          onClick={() => void handlePromptSubmit("What operational tools are available?")}
          disabled={isExecuting}
        >
          Ask question (clarification)
        </button>
        <button
          type="button"
          className="talk-pill"
          onClick={() => void handlePromptSubmit("Check Saturday dermatology availability slots")}
          disabled={isExecuting}
        >
          Check slot capacity
        </button>
      </div>

      {steps.length > 0 ? (
        <div className="talk-to-mimo-steps" aria-live="polite">
          <span className="steps-heading">WebMCP Execution Pipeline</span>
          {steps.map((step) => (
            <div key={step.id} className={`talk-step is-${step.status}`}>
              <div className="step-badge-line">
                <span className="step-tool-name">{step.tool}</span>
                <span className={`step-status-tag is-${step.status}`}>
                  {step.status === "running" ? "Executing..." : step.status}
                </span>
              </div>
              <p className="step-detail">{step.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
