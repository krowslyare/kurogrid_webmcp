import assert from "node:assert/strict";
import test from "node:test";

import {
  nextSaturdayInLima,
  nextSevenDays,
} from "../../src/features/appointments/lib/booking-days.ts";

test("nextSevenDays includes the next Saturday when the site is opened on a Saturday", () => {
  // 2026-09-05 is a Saturday in Lima (UTC-5)
  const saturday = new Date("2026-09-05T12:00:00-05:00");
  const defaultDate = nextSaturdayInLima(saturday);

  assert.equal(defaultDate, "2026-09-12");

  const days = nextSevenDays(defaultDate, saturday);

  assert.ok(
    days.some((day) => day.iso === defaultDate),
    `days should include next Saturday (${defaultDate})`,
  );
  assert.equal(days[0].iso, "2026-09-05");
  assert.equal(days[0].weekday, "Today");

  const lastDay = days[days.length - 1];
  assert.equal(lastDay.iso, "2026-09-12");
  assert.equal(lastDay.weekday, "Sat");
  assert.equal(lastDay.dayNum, 12);

  // Verify chronological ordering
  const isos = days.map((d) => d.iso);
  const sorted = [...isos].sort();
  assert.deepEqual(isos, sorted);
});

test("nextSevenDays does not duplicate dates when defaultDate is within the next 7 days", () => {
  // 2026-09-01 is a Tuesday in Lima (UTC-5)
  const tuesday = new Date("2026-09-01T12:00:00-05:00");
  const defaultDate = nextSaturdayInLima(tuesday);

  assert.equal(defaultDate, "2026-09-05");

  const days = nextSevenDays(defaultDate, tuesday);

  assert.equal(days.length, 7);
  assert.ok(days.some((day) => day.iso === "2026-09-05"));

  const isos = days.map((d) => d.iso);
  const sorted = [...isos].sort();
  assert.deepEqual(isos, sorted);
});
