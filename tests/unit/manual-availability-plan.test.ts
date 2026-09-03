import assert from "node:assert/strict";
import test from "node:test";

import {
  availabilityPromptFor,
  busyIntervalsFromForm,
  dayRowsFromForm,
  demoPlanDefaults,
  hasConfiguredRanges,
  manualConfigurationFromForm,
  planFormDefaults,
} from "../../src/features/availability/lib/manual-plan.ts";

function septemberForm() {
  const form = new FormData();
  form.set("periodStart", "2026-09-01");
  form.set("periodEnd", "2026-09-30");
  form.set("timezone", "America/Lima");
  form.set("slotDuration", "30");
  form.set("weekly_start_2", "09:00");
  form.set("weekly_end_2", "13:00");
  form.set("weekly_start_4", "09:00");
  form.set("weekly_end_4", "13:00");
  form.set("weekly_start_6", "09:00");
  form.set("weekly_end_6", "14:00");
  form.set("block_start_2", "12:00");
  form.set("block_end_2", "13:00");
  form.set("block_start_4", "12:00");
  form.set("block_end_4", "13:00");
  form.set("block_start_6", "12:00");
  form.set("block_end_6", "13:00");
  form.set(
    "busyIntervals",
    "2026-09-05T10:00:00-05:00, 2026-09-05T11:30:00-05:00",
  );
  return form;
}

test("Manual configuration keeps explicit dates intact", () => {
  assert.deepEqual(manualConfigurationFromForm(septemberForm()), {
    period_start: "2026-09-01",
    period_end: "2026-09-30",
    timezone: "America/Lima",
    slot_duration_minutes: 30,
    weekly_ranges: [
      { day_of_week: 2, starts_at: "09:00", ends_at: "13:00" },
      { day_of_week: 4, starts_at: "09:00", ends_at: "13:00" },
      { day_of_week: 6, starts_at: "09:00", ends_at: "14:00" },
    ],
    recurring_blocks: [
      { day_of_week: 2, starts_at: "12:00", ends_at: "13:00" },
      { day_of_week: 4, starts_at: "12:00", ends_at: "13:00" },
      { day_of_week: 6, starts_at: "12:00", ends_at: "13:00" },
    ],
    busy_intervals: [
      {
        starts_at: "2026-09-05T15:00:00.000Z",
        ends_at: "2026-09-05T16:30:00.000Z",
        source: "manual",
      },
    ],
    preserve_existing_bookings: true,
  });
});

test("Empty day rows are skipped, half-filled rows fail closed", () => {
  const form = septemberForm();
  form.delete("weekly_start_2");
  form.delete("weekly_end_2");

  const weekly = dayRowsFromForm(form, "weekly");
  assert.equal(weekly.some((row) => row.day_of_week === 2), false);
  assert.equal(weekly.length, 2);

  const broken = septemberForm();
  broken.delete("weekly_end_4");
  assert.throws(() => dayRowsFromForm(broken, "weekly"), /Invalid range/);

  const badTime = septemberForm();
  badTime.set("weekly_start_6", "25:00");
  assert.throws(() => manualConfigurationFromForm(badTime), /Invalid time/);
});

test("Configuration rejects bad periods, durations, and busy lines", () => {
  const flipped = septemberForm();
  flipped.set("periodStart", "2026-10-01");
  assert.throws(() => manualConfigurationFromForm(flipped), /Invalid period/);

  const duration = septemberForm();
  duration.set("slotDuration", "3");
  assert.throws(() => manualConfigurationFromForm(duration), /Invalid slot duration/);

  const busy = septemberForm();
  busy.set("busyIntervals", "not a range");
  assert.throws(() => manualConfigurationFromForm(busy), /Invalid busy interval/);

  const reversed = septemberForm();
  reversed.set(
    "busyIntervals",
    "2026-09-05T11:30:00-05:00, 2026-09-05T10:00:00-05:00",
  );
  assert.throws(() => manualConfigurationFromForm(reversed), /Invalid busy interval/);

  assert.deepEqual(busyIntervalsFromForm(null), []);
  assert.deepEqual(busyIntervalsFromForm("  \n "), []);
});

test("Form defaults come from the persisted configuration", () => {
  assert.deepEqual(
    planFormDefaults({
      configured: true,
      period_start: "2026-09-01",
      period_end: "2026-09-30",
      timezone: "America/Lima",
      slot_duration_minutes: 30,
      weekly_ranges: [
        { day_of_week: 2, starts_at: "09:00:00", ends_at: "13:00:00" },
        { day_of_week: 9, starts_at: "09:00", ends_at: "10:00" },
        { day_of_week: 4, starts_at: "bad", ends_at: "13:00" },
      ],
      recurring_blocks: [
        { day_of_week: 6, starts_at: "12:00", ends_at: "13:00" },
      ],
      busy_intervals: [
        {
          starts_at: "2026-09-05T10:00:00-05:00",
          ends_at: "2026-09-05T11:30:00-05:00",
          source: "calendar",
        },
        { starts_at: "nope", ends_at: "nope", source: "calendar" },
      ],
    }),
    {
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      timezone: "America/Lima",
      slotDuration: 30,
      weekly: { 2: ["09:00", "13:00"] },
      blocks: { 6: ["12:00", "13:00"] },
      busyText: "2026-09-05T10:00:00-05:00, 2026-09-05T11:30:00-05:00",
    },
  );
});

test("Form defaults fall back to a rolling future window", () => {
  for (const empty of [null, undefined, {}, { configured: false }, { configured: true }]) {
    const defaults = planFormDefaults(empty, "2026-09-01");
    assert.equal(defaults.periodStart, "2026-09-05");
    assert.equal(defaults.periodEnd, "2026-09-11");
    assert.equal(defaults.timezone, "America/Lima");
    assert.equal(defaults.slotDuration, 30);
    assert.deepEqual(defaults.weekly, { 6: ["09:00", "14:00"] });
    assert.deepEqual(defaults.blocks, {});
    assert.equal(defaults.busyText, "");
  }
});

test("Demo request rolls four weeks from the seeded appointment day", () => {
  assert.deepEqual(demoPlanDefaults(null, "2026-09-01"), {
    periodStart: "2026-09-05",
    periodEnd: "2026-10-02",
    timezone: "America/Lima",
    slotDuration: 30,
    weekly: {
      2: ["09:00", "13:00"],
      4: ["09:00", "13:00"],
      6: ["09:00", "14:00"],
    },
    blocks: {
      2: ["12:00", "13:00"],
      4: ["12:00", "13:00"],
      6: ["12:00", "13:00"],
    },
    busyText: "2026-09-05T10:00:00-05:00, 2026-09-05T11:30:00-05:00",
  });
});

test("Configured ranges are detected for rule labels", () => {
  assert.equal(hasConfiguredRanges(null), false);
  assert.equal(hasConfiguredRanges({ configured: false }), false);
  assert.equal(
    hasConfiguredRanges({ configured: true, weekly_ranges: [], recurring_blocks: [] }),
    false,
  );
  assert.equal(
    hasConfiguredRanges({
      configured: true,
      weekly_ranges: [{ day_of_week: 6, starts_at: "09:00", ends_at: "14:00" }],
      recurring_blocks: [],
    }),
    true,
  );
});

test("Owner prompt is generated from the current configuration", () => {
  assert.equal(
    availabilityPromptFor(demoPlanDefaults(null, "2026-09-01"), "dermatology"),
    "Update dermatology availability from September 5, 2026 through October 2, 2026. Tuesdays and Thursdays from 9 to 1, "
    + "Saturdays from 9 to 2, thirty-minute appointments, keep Tuesdays, Thursdays and "
    + "Saturdays from 12 to 1 blocked. My calendar is busy Saturday, September 5 from 10:00 AM to 11:30 AM. "
    + "Preserve existing bookings. Prepare the exact plan, and if it matches these constraints, "
    + "approve and apply it from my authenticated Owner session. Send the customer update.",
  );

  assert.equal(
    availabilityPromptFor(
      {
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        timezone: "America/Lima",
        slotDuration: 20,
        weekly: { 3: ["14:00", "18:00"] },
        blocks: {},
        busyText: "",
      },
      "wellness-exam",
    ),
    "Update wellness exam availability from October 1, 2026 through October 31, 2026. Wednesdays from 2 to 6, twenty-minute "
    + "appointments. Preserve existing bookings. "
    + "Prepare the exact plan, and if it matches these constraints, approve and apply it from my "
    + "authenticated Owner session. Send the customer update.",
  );
});
