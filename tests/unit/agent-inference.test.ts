import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../../src/app/api/agent/infer/route.ts";

test("POST /api/agent/infer returns 400 when text prompt is empty", async () => {
  const req = new Request("http://localhost/api/agent/infer", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.1" },
    body: JSON.stringify({ text: "   " }),
  });

  const res = await POST(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.type, "clarification");
});

test("POST /api/agent/infer returns 400 when text exceeds 300 characters", async () => {
  const req = new Request("http://localhost/api/agent/infer", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.2" },
    body: JSON.stringify({ text: "a".repeat(301) }),
  });

  const res = await POST(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.type, "clarification");
});

test("POST /api/agent/infer enforces sliding window rate limit of 10 requests per minute", async () => {
  const ip = "10.0.0.99";

  // Make 10 valid requests
  for (let i = 0; i < 10; i++) {
    const req = new Request("http://localhost/api/agent/infer", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": ip },
      body: JSON.stringify({ text: "Book dermatology for Luna" }),
    });
    const res = await POST(req);
    assert.notEqual(res.status, 429, `Request ${i + 1} should not be rate limited`);
  }

  // 11th request should be rate limited
  const blockedReq = new Request("http://localhost/api/agent/infer", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": ip },
    body: JSON.stringify({ text: "Book dermatology for Luna" }),
  });
  const blockedRes = await POST(blockedReq);
  assert.equal(blockedRes.status, 429);
  const data = await blockedRes.json();
  assert.equal(data.success, false);
  assert.equal(data.type, "rate_limit");
});

test("POST /api/agent/infer handles owner and customer fallback contexts cleanly", async () => {
  const reqOwner = new Request("http://localhost/api/agent/infer", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.3" },
    body: JSON.stringify({
      text: "Review our availability",
      tools: [],
      context: { role: "owner" },
    }),
  });

  const resOwner = await POST(reqOwner);
  const dataOwner = await resOwner.json();
  assert.equal(dataOwner.success, true);
  assert.equal(dataOwner.type, "tool_call");
  assert.equal(dataOwner.call.name, "get_availability_configuration");

  const reqCustomer = new Request("http://localhost/api/agent/infer", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.4" },
    body: JSON.stringify({
      text: "Book dermatology for Max",
      tools: [],
      context: { role: "customer" },
    }),
  });

  const resCustomer = await POST(reqCustomer);
  const dataCustomer = await resCustomer.json();
  assert.equal(dataCustomer.success, true);
  assert.equal(dataCustomer.type, "tool_call");
  assert.equal(dataCustomer.call.name, "find_appointment_slots");
  assert.equal(dataCustomer.extractedPet, "Max");
});
