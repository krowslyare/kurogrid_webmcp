import assert from "node:assert/strict";
import test from "node:test";
import { cleanSpokenText, isSpeechSynthesisSupported, speakMessage, stopSpeaking } from "../../src/lib/speech-synthesis.ts";

test("cleanSpokenText removes markdown formatting, code blocks, and JSON", () => {
  const raw = "Found **6 slots** for `dermatology`. See [schedule](https://example.com). ```json {\"slot\": 1} ``` WebMCP tool executed.";
  const cleaned = cleanSpokenText(raw);

  assert.ok(!cleaned.includes("**"));
  assert.ok(!cleaned.includes("`"));
  assert.ok(!cleaned.includes("[schedule]"));
  assert.ok(!cleaned.includes("https://"));
  assert.ok(!cleaned.includes("json"));
  assert.ok(cleaned.includes("Found 6 slots for dermatology."));
  assert.ok(cleaned.includes("Web MCP tool executed."));
});

test("cleanSpokenText handles empty or non-string input safely", () => {
  assert.equal(cleanSpokenText(""), "");
  assert.equal(cleanSpokenText(null as unknown as string), "");
  assert.equal(cleanSpokenText(undefined as unknown as string), "");
});

test("cleanSpokenText truncates gracefully at sentence or word boundary when exceeding maxLength", () => {
  const longText = "First sentence is clear. Second sentence has extra details. Third sentence explains everything that happened during the consultation. Fourth sentence concludes.";
  const cleaned = cleanSpokenText(longText, 60);

  assert.ok(cleaned.length <= 60);
  assert.equal(cleaned, "First sentence is clear. Second sentence has extra details.");
});

test("isSpeechSynthesisSupported returns false in Node environment", () => {
  assert.equal(isSpeechSynthesisSupported(), false);
});

test("speakMessage and stopSpeaking fail closed without error in Node environment", () => {
  const result = speakMessage("Test message");
  assert.equal(result, false);

  // Should not throw
  assert.doesNotThrow(() => stopSpeaking());
});
