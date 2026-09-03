"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type TalkToMimoConsoleProps = {
  siteSlug: string;
  defaultDate: string;
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

export function TalkToMimoConsole({
  defaultDate,
}: TalkToMimoConsoleProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);

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
          if (err === "no-speech" || err === "aborted") {
            return;
          }
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
          executeTool: (name: string, input: Record<string, unknown>) => Promise<unknown>;
        };
      };
      const modelContext = doc.modelContext;
      if (!modelContext || typeof modelContext.executeTool !== "function") {
        throw new Error("WebMCP modelContext is not available in this document.");
      }

      // Step 1: Query available slots for dermatology
      const step1Id = addStep(
        "find_appointment_slots",
        `Scanning availability for Saturday (${defaultDate})...`,
      );

      const slotsResult = (await modelContext.executeTool("find_appointment_slots", {
        service_slug: "dermatology",
        date: defaultDate,
      })) as { slots?: Array<{ slot_id: string; starts_at: string; duration_minutes: number }> };

      const slots = slotsResult?.slots ?? [];
      if (!slots.length) {
        updateStep(step1Id, "error", "No available slots found for this date.");
        setIsExecuting(false);
        return;
      }

      updateStep(
        step1Id,
        "success",
        `Resolved ${slots.length} available openings (Earliest: 10:00 AM).`,
      );

      // Step 2: Prepare appointment request for Luna (or specified pet)
      const chosenSlot = slots[0];
      const petName = textToRun.toLowerCase().includes("max") ? "Max" : "Luna";
      const customerEmail = `${petName.toLowerCase()}@example.test`;

      const step2Id = addStep(
        "prepare_appointment_request",
        `Preparing draft request for ${petName} at 10:00 AM...`,
      );

      const idempotencyKey =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
              const random = (Math.random() * 16) | 0;
              const value = char === "x" ? random : (random & 0x3) | 0x8;
              return value.toString(16);
            });

      const prepareResult = (await modelContext.executeTool("prepare_appointment_request", {
        service_slug: "dermatology",
        slot_id: chosenSlot.slot_id,
        pet_name: petName,
        customer_email: customerEmail,
        idempotency_key: idempotencyKey,
      })) as {
        appointment?: { request_id: string; access_token: string; confirmation_token: string };
        navigate_to?: string;
      };

      if (!prepareResult?.navigate_to) {
        updateStep(step2Id, "error", "Unable to generate confirmation token.");
        setIsExecuting(false);
        return;
      }

      updateStep(
        step2Id,
        "success",
        `Draft prepared with one-shot token. Loading confirmation view...`,
      );

      // Step 3: Direct to confirmation card via Next.js router
      setTimeout(() => {
        router.push(`${prepareResult.navigate_to}#agent-booking`);
      }, 750);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Execution encountered an error.";
      addStep("error", message);
      setIsExecuting(false);
    }
  };

  return (
    <div className="talk-to-mimo-container" id="talk-to-mimo">
      <div className="talk-to-mimo-header">
        <div className="talk-to-mimo-title-group">
          <span className="talk-to-mimo-badge">WebMCP In-Browser Agent</span>
          <h3>Talk to Mimo</h3>
        </div>
        <p>Speak or type what you need to coordinate your appointment live via WebMCP.</p>
      </div>

      <div className="talk-to-mimo-input-shell">
        <button
          type="button"
          className={`talk-to-mimo-mic-btn ${isListening ? "is-listening" : ""}`}
          onClick={toggleListening}
          title={isListening ? "Listening... click to stop" : "Click to speak with voice"}
          aria-label="Voice input"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
          {isListening ? <span className="mic-pulse" /> : null}
        </button>

        <input
          ref={inputRef}
          type="text"
          className="talk-to-mimo-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handlePromptSubmit();
            }
          }}
          placeholder={isListening ? "Listening to your voice..." : "e.g. Book dermatology for Luna this Saturday morning"}
          disabled={isExecuting}
        />

        <button
          type="button"
          className="talk-to-mimo-submit-btn"
          onClick={() => void handlePromptSubmit()}
          disabled={isExecuting || !prompt.trim()}
          aria-label="Run WebMCP agent"
        >
          {isExecuting ? (
            <span className="talk-spinner" />
          ) : (
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          )}
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
    </div>
  );
}
