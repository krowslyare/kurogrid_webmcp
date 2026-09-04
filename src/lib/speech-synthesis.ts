/**
 * Speech Synthesis Utility for WebMCP In-Browser Agents.
 * Uses native window.speechSynthesis to provide spoken feedback for
 * Talk to Mimo and Owner Copilot without external audio services.
 */

export type SpeechOptions = {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err?: unknown) => void;
};

export function cleanSpokenText(raw: string, maxLength = 220): string {
  if (!raw || typeof raw !== "string") return "";

  let cleaned = raw
    // Remove JSON code blocks or object notation
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\{[\s\S]*?\}/g, "")
    // Remove markdown links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove markdown styling: **bold**, *italic*, `code`
    .replace(/[*_`#~]/g, "")
    // Normalize WebMCP pronunciation
    .replace(/\bWebMCP\b/g, "Web MCP")
    .replace(/\bRPC\b/g, "R P C")
    .replace(/\bUTC\b/g, "U T C")
    // Remove extra whitespace
    .replace(/\s+/g, " ")
    .trim();

  // If text is still longer than maxLength, truncate at sentence or word boundary
  if (cleaned.length > maxLength) {
    const truncated = cleaned.slice(0, maxLength);
    const lastSentence = Math.max(truncated.lastIndexOf("."), truncated.lastIndexOf("?"), truncated.lastIndexOf("!"));
    if (lastSentence > 40) {
      cleaned = truncated.slice(0, lastSentence + 1);
    } else {
      const lastSpace = truncated.lastIndexOf(" ");
      cleaned = (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
    }
  }

  return cleaned;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function stopSpeaking(): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

export function speakMessage(text: string, options: SpeechOptions = {}): boolean {
  if (!isSpeechSynthesisSupported()) return false;

  const spokenText = cleanSpokenText(text);
  if (!spokenText) return false;

  try {
    // Cancel any previous in-flight utterance
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = options.lang || (typeof navigator !== "undefined" && navigator.language) || "en-US";
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    // Pick a natural voice if available
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const preferred = voices.find(
        (v) => (v.lang.startsWith(utterance.lang.slice(0, 2)) || v.lang === utterance.lang) &&
          (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Daniel")),
      ) || voices.find((v) => v.lang.startsWith(utterance.lang.slice(0, 2)));

      if (preferred) {
        utterance.voice = preferred;
      }
    }

    if (options.onStart) utterance.onstart = options.onStart;
    if (options.onEnd) utterance.onend = options.onEnd;
    if (options.onError) utterance.onerror = options.onError;

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
