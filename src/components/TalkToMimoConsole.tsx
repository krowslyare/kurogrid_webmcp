"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WebMcpDisclaimer } from "@/components/WebMcpDisclaimer";
import {
  safeJsonStringify,
  sanitizeToolForInference,
} from "@/features/webmcp/client/tool-sanitizer";

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
  siteSlug,
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
          getTools?: () => Promise<Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }>>;
          executeTool: (name: string, input: Record<string, unknown>) => Promise<unknown>;
        };
      };
      const modelContext = doc.modelContext;
      if (!modelContext || typeof modelContext.executeTool !== "function") {
        throw new Error("WebMCP modelContext is not available in this document.");
      }

      // Step 1: Read registered WebMCP tools from browser DOM & sanitize for circular-safety
      const rawTools = typeof modelContext.getTools === "function"
        ? await modelContext.getTools()
        : [];
      const registeredTools = rawTools
        .map(sanitizeToolForInference)
        .filter((t): t is NonNullable<typeof t> => t !== null);

      const inferStepId = addStep(
        "gemini-3.5-flash",
        `Analyzing intent via Gemini 3.5 Flash and ${registeredTools.length} registered WebMCP tools...`,
      );

      const inferResponse = await fetch("/api/agent/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: safeJsonStringify({
          text: textToRun,
          tools: registeredTools,
          context: {
            role: "customer",
            today: new Date().toISOString().slice(0, 10),
            siteSlug,
          },
        }),
      });

      const inferResult = (await inferResponse.json()) as {
        success: boolean;
        type: "tool_call" | "clarification" | "rate_limit";
        message?: string;
        call?: { name: string; args: Record<string, unknown> };
        extractedPet?: string;
        model?: string;
      };

      if (!inferResult.success) {
        const errorMsg = inferResult.message || "Please provide additional booking details.";
        updateStep(inferStepId, "error", errorMsg);
        setIsExecuting(false);
        return;
      }

      const call = inferResult.call;
      if (!call) {
        updateStep(inferStepId, "error", "No WebMCP tool selected.");
        setIsExecuting(false);
        return;
      }

      updateStep(
        inferStepId,
        "success",
        `Gemini 3.5 Flash selected WebMCP tool "${call.name}".`,
      );

      // Step 2: Execute selected tool
      if (call.name === "get_clinic_services") {
        const servicesStepId = addStep("get_clinic_services", "Reading published clinic services...");
        const servicesResult = (await modelContext.executeTool("get_clinic_services", {})) as {
          services?: Array<{ service_slug?: string; slug?: string; service_name?: string; name?: string }>;
        };
        const services = servicesResult?.services ?? [];
        updateStep(servicesStepId, "success", `Verified ${services.length} published clinic services.`);

        const lowerText = textToRun.toLowerCase();
        const matched = services.find((s) => {
          const slug = (s.service_slug || s.slug || "").toLowerCase();
          const name = (s.service_name || s.name || "").toLowerCase();
          return (slug && lowerText.includes(slug)) || (name && lowerText.includes(name));
        });
        const derivedSlug = matched?.service_slug || matched?.slug || "";
        if (!derivedSlug) {
          updateStep(servicesStepId, "error", "No matching service found. Please name a published clinic service.");
          setIsExecuting(false);
          return;
        }
        call.name = "find_appointment_slots";
        call.args = {
          service_slug: derivedSlug,
          date: defaultDate,
        };
      }

      if (call.name === "find_appointment_slots") {
        const serviceSlug = typeof call.args.service_slug === "string" && call.args.service_slug
          ? call.args.service_slug
          : "";
        if (!serviceSlug) {
          updateStep(inferStepId, "error", "No service specified. Please name a published clinic service.");
          setIsExecuting(false);
          return;
        }
        const slotDate = typeof call.args.date === "string" && call.args.date
          ? call.args.date
          : defaultDate;
        const slotsStepId = addStep(
          "find_appointment_slots",
          `Scanning availability for ${serviceSlug} on ${slotDate}...`,
        );

        const slotsResult = (await modelContext.executeTool("find_appointment_slots", {
          service_slug: serviceSlug,
          date: slotDate,
        })) as { slots?: Array<{ slot_id: string; starts_at: string; duration_minutes: number }> };

        const slots = slotsResult?.slots ?? [];
        if (!slots.length) {
          const noSlotMsg = "No available slots found for this service and date.";
          updateStep(slotsStepId, "error", noSlotMsg);
          setIsExecuting(false);
          return;
        }

        updateStep(
          slotsStepId,
          "success",
          `Found ${slots.length} available opening${slots.length === 1 ? "" : "s"}.`,
        );

        // Chain to prepare_appointment_request
        const chosenSlot = slots[0];
        const petName = inferResult.extractedPet || (textToRun.toLowerCase().includes("max") ? "Max" : "Luna");
        const customerEmail = `${petName.toLowerCase()}@example.test`;

        const prepStepId = addStep(
          "prepare_appointment_request",
          `Preparing draft booking request for ${petName} (${customerEmail}, demo address)...`,
        );

        const idempotencyKey =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
              });

        const prepareResult = (await modelContext.executeTool("prepare_appointment_request", {
          service_slug: serviceSlug,
          slot_id: chosenSlot.slot_id,
          pet_name: petName,
          customer_email: customerEmail,
          idempotency_key: idempotencyKey,
        })) as {
          appointment?: { request_id: string; access_token: string; confirmation_token: string };
          navigate_to?: string;
        };

        if (!prepareResult?.navigate_to) {
          updateStep(prepStepId, "error", "Unable to generate confirmation token.");
          setIsExecuting(false);
          return;
        }

        updateStep(
          prepStepId,
          "success",
          "Draft prepared with one-shot confirmation token. Loading confirmation view...",
        );

        router.push(`${prepareResult.navigate_to}#agent-booking`);
      } else {
        const genericStepId = addStep(
          call.name,
          `Executing WebMCP tool ${call.name}...`,
        );

        const execResult = (await modelContext.executeTool(call.name, call.args)) as {
          navigate_to?: string;
        };

        updateStep(genericStepId, "success", `Tool ${call.name} executed successfully.`);

        if (execResult?.navigate_to) {
          router.push(execResult.navigate_to);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Execution encountered an error.";
      setSteps((prev) => {
        const hasRunning = prev.some((s) => s.status === "running");
        if (hasRunning) {
          return prev.map((s) => (s.status === "running" ? { ...s, status: "error", detail: message } : s));
        }
        return [...prev, { id: "err-" + Math.random().toString(36).substring(2, 6), tool: "error", status: "error", detail: message }];
      });
      setIsExecuting(false);
    }
  };

  return (
    <div className="talk-to-mimo-container" id="talk-to-mimo">
      <div className="talk-to-mimo-header">
        <div className="talk-to-mimo-title-group">
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

        <div className="talk-to-mimo-submit-wrap">
          <span className="talk-key-hint" aria-hidden="true">↵</span>
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
      </div>

      {steps.length > 0 ? (
        <div className="talk-to-mimo-steps" aria-live="polite">
          <div className="steps-header-row">
            <span className="steps-heading">WebMCP Execution Pipeline</span>
            <button
              type="button"
              className="steps-dismiss-btn"
              onClick={() => setSteps([])}
              title="Dismiss execution pipeline view"
            >
              Dismiss
            </button>
          </div>
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

      <div className="talk-to-mimo-footnote">
        <span className="talk-to-mimo-badge">Demo booking assistant</span>
        <WebMcpDisclaimer variant="customer" siteSlug={siteSlug} />
      </div>
    </div>
  );
}
