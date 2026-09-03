import assert from "node:assert/strict";
import test from "node:test";

test("UUID generation format strictly conforms to canonical RFC4122 v4 regex", () => {
  const uuidRegex = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  for (let i = 0; i < 100; i += 1) {
    const generated = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = (Math.random() * 16) | 0;
      const value = char === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
    assert.match(generated, uuidRegex, `Failed on iteration ${i}: ${generated}`);
    assert.equal(generated[14], "4", "Version nibble must be 4");
    assert.ok(["8", "9", "a", "b"].includes(generated[19]), "Variant must be RFC4122");
  }
});

test("State key generation captures status transitions without false positives", () => {
  const appts = [
    { id: "req-1", status: "time_proposed", proposed_starts_at: "2026-09-05T16:30:00Z" },
    { id: "req-2", status: "confirmed", proposed_starts_at: undefined },
  ];
  const key1 = appts.map((a) => `${a.id}:${a.status}:${a.proposed_starts_at ?? ""}`).join("|");

  // Same appointments produce identical key
  const key1Copy = appts.map((a) => `${a.id}:${a.status}:${a.proposed_starts_at ?? ""}`).join("|");
  assert.equal(key1, key1Copy);

  // Status transition changes the key
  appts[0].status = "confirmed";
  const key2 = appts.map((a) => `${a.id}:${a.status}:${a.proposed_starts_at ?? ""}`).join("|");
  assert.notEqual(key1, key2);
});
