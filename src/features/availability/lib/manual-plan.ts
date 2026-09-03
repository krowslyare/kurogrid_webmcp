// Pure helpers for the fully manual availability fallback. No server-only
// imports here so this module stays unit-testable under plain node:test.

export type ManualDayRange = {
  day_of_week: number;
  starts_at: string;
  ends_at: string;
};

export type ManualBusyInterval = {
  starts_at: string;
  ends_at: string;
  source: string;
};

export type ManualPlanConfiguration = {
  period_start: string;
  period_end: string;
  timezone: string;
  slot_duration_minutes: number;
  weekly_ranges: ManualDayRange[];
  recurring_blocks: ManualDayRange[];
  busy_intervals: ManualBusyInterval[];
  preserve_existing_bookings: true;
};

export type PlanFormDefaults = {
  periodStart: string;
  periodEnd: string;
  timezone: string;
  slotDuration: number;
  weekly: Partial<Record<number, [string, string]>>;
  blocks: Partial<Record<number, [string, string]>>;
  busyText: string;
};

const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function limaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Lima",
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function nextFutureSaturday(referenceDate = limaDate()) {
  const date = new Date(`${referenceDate}T12:00:00Z`);
  const daysAhead = ((6 - date.getUTCDay() + 7) % 7) || 7;
  return addDays(referenceDate, daysAhead);
}

function rollingFallbackDefaults(referenceDate?: string): PlanFormDefaults {
  const saturday = nextFutureSaturday(referenceDate);

  return {
    periodStart: saturday,
    periodEnd: addDays(saturday, 6),
    timezone: "America/Lima",
    slotDuration: 30,
    weekly: { 6: ["09:00", "14:00"] },
    blocks: {},
    busyText: "",
  };
}

function requiredField(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing ${name}.`);
  }

  return value.trim();
}

export function optionalTime(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();

  if (!trimmed) return undefined;
  if (!LOCAL_TIME_PATTERN.test(trimmed)) throw new Error("Invalid time.");

  return trimmed;
}

export function dayRowsFromForm(formData: FormData, prefix: string): ManualDayRange[] {
  const rows: ManualDayRange[] = [];

  for (let day = 0; day <= 6; day += 1) {
    const startsAt = optionalTime(formData.get(`${prefix}_start_${day}`));
    const endsAt = optionalTime(formData.get(`${prefix}_end_${day}`));

    if (!startsAt && !endsAt) continue;
    if (!startsAt || !endsAt || startsAt >= endsAt) {
      throw new Error("Invalid range.");
    }

    rows.push({ day_of_week: day, starts_at: startsAt, ends_at: endsAt });
  }

  return rows;
}

export function busyIntervalsFromForm(value: FormDataEntryValue | null): ManualBusyInterval[] {
  if (typeof value !== "string") return [];

  const rows: ManualBusyInterval[] = [];

  for (const line of value.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed) continue;

    const match = trimmed.match(/^(.+?)\s*,\s*(.+)$/);

    if (!match) throw new Error("Invalid busy interval.");

    const startsAt = Date.parse(match[1]);
    const endsAt = Date.parse(match[2]);

    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt >= endsAt) {
      throw new Error("Invalid busy interval.");
    }

    rows.push({
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      source: "manual",
    });
  }

  if (rows.length > 100) throw new Error("Too many busy intervals.");

  return rows;
}

export function manualConfigurationFromForm(formData: FormData): ManualPlanConfiguration {
  const periodStart = requiredField(formData, "periodStart");
  const periodEnd = requiredField(formData, "periodEnd");
  const timezone = requiredField(formData, "timezone");
  const slotDuration = Number(requiredField(formData, "slotDuration"));

  if (
    !DATE_PATTERN.test(periodStart)
    || !DATE_PATTERN.test(periodEnd)
    || Number.isNaN(Date.parse(periodStart))
    || Number.isNaN(Date.parse(periodEnd))
    || periodStart > periodEnd
  ) {
    throw new Error("Invalid period.");
  }

  if (timezone.length > 64) throw new Error("Invalid timezone.");
  if (!Number.isSafeInteger(slotDuration) || slotDuration < 5 || slotDuration > 480) {
    throw new Error("Invalid slot duration.");
  }

  return {
    period_start: periodStart,
    period_end: periodEnd,
    timezone,
    slot_duration_minutes: slotDuration,
    weekly_ranges: dayRowsFromForm(formData, "weekly"),
    recurring_blocks: dayRowsFromForm(formData, "block"),
    busy_intervals: busyIntervalsFromForm(formData.get("busyIntervals")),
    preserve_existing_bookings: true,
  };
}

function timeInput(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const match = value.match(/^(\d{1,2}):(\d{2})/);

  if (!match) return null;

  const hour = match[1].padStart(2, "0");
  const minute = match[2];

  if (Number(hour) > 23 || Number(minute) > 59) return null;

  return `${hour}:${minute}`;
}

function rangesToDefaults(value: unknown): Partial<Record<number, [string, string]>> {
  const defaults: Partial<Record<number, [string, string]>> = {};

  if (!Array.isArray(value)) return defaults;

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const row = item as Record<string, unknown>;
    const day = typeof row.day_of_week === "number" ? row.day_of_week : NaN;
    const startsAt = timeInput(row.starts_at);
    const endsAt = timeInput(row.ends_at);

    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (!startsAt || !endsAt || startsAt >= endsAt) continue;
    if (defaults[day]) continue;

    defaults[day] = [startsAt, endsAt];
  }

  return defaults;
}

function busyToText(value: unknown): string {
  if (!Array.isArray(value)) return "";

  const lines: string[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const row = item as Record<string, unknown>;

    if (typeof row.starts_at !== "string" || typeof row.ends_at !== "string") continue;
    if (!Number.isFinite(Date.parse(row.starts_at)) || !Number.isFinite(Date.parse(row.ends_at))) continue;

    lines.push(`${row.starts_at}, ${row.ends_at}`);
  }

  return lines.join("\n");
}

// True when the persisted configuration carries usable ranges — the same
// state the agent reads. The Step 0 form and the rule chips fall back to a
// rolling demo window only when this is false.
export function hasConfiguredRanges(configuration: unknown): boolean {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    return false;
  }

  const current = configuration as Record<string, unknown>;

  if (current.configured === false) return false;

  return (
    Object.keys(rangesToDefaults(current.weekly_ranges)).length > 0
    || Object.keys(rangesToDefaults(current.recurring_blocks)).length > 0
  );
}

// Derive Step 0 form defaults from the persisted availability
// configuration — the same state the agent reads. Falls back to a rolling
// window only when nothing is configured yet.
export function planFormDefaults(configuration: unknown, referenceDate?: string): PlanFormDefaults {
  const fallback = rollingFallbackDefaults(referenceDate);

  if (!hasConfiguredRanges(configuration)) {
    return fallback;
  }

  const current = configuration as Record<string, unknown>;
  const weekly = rangesToDefaults(current.weekly_ranges);
  const blocks = rangesToDefaults(current.recurring_blocks);

  const periodStart = typeof current.period_start === "string" && DATE_PATTERN.test(current.period_start)
    ? current.period_start
    : fallback.periodStart;
  const periodEnd = typeof current.period_end === "string" && DATE_PATTERN.test(current.period_end)
    ? current.period_end
    : fallback.periodEnd;
  const timezone = typeof current.timezone === "string" && current.timezone.trim() && current.timezone.length <= 64
    ? current.timezone
    : fallback.timezone;
  const slotDuration = typeof current.slot_duration_minutes === "number"
    && Number.isInteger(current.slot_duration_minutes)
    && current.slot_duration_minutes >= 5
    && current.slot_duration_minutes <= 480
    ? current.slot_duration_minutes
    : fallback.slotDuration;

  return {
    periodStart,
    periodEnd,
    timezone,
    slotDuration,
    weekly,
    blocks,
    busyText: busyToText(current.busy_intervals),
  };
}

// The seeded database represents the current schedule. This separate rolling
// request is the change the Owner demonstrates: four weeks of operating rules,
// with one normalized busy interval on the seeded appointment day.
export function demoPlanDefaults(configuration: unknown, referenceDate?: string): PlanFormDefaults {
  const current = planFormDefaults(configuration, referenceDate);
  const anchor = current.periodStart;

  return {
    periodStart: anchor,
    periodEnd: addDays(anchor, 27),
    timezone: current.timezone,
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
    busyText: `${anchor}T10:00:00-05:00, ${anchor}T11:30:00-05:00`,
  };
}

const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DURATION_WORDS: Record<number, string> = {
  15: "fifteen",
  20: "twenty",
  30: "thirty",
  45: "forty-five",
  60: "sixty",
};

function shortClock(value: string) {
  const [hour, minute] = value.split(":");
  const twelve = Number(hour) % 12 || 12;

  return minute === "00" ? String(twelve) : `${twelve}:${minute}`;
}

function pluralDayList(days: number[]) {
  const names = days.map((day) => `${FULL_DAY_NAMES[day]}s`);

  if (names.length <= 2) return names.join(" and ");

  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function groupedDayRanges(ranges: Partial<Record<number, [string, string]>>) {
  const groups = new Map<string, { days: number[]; start: string; end: string }>();

  for (const [key, value] of Object.entries(ranges).sort(([first], [second]) => Number(first) - Number(second))) {
    const day = Number(key);

    if (!value) continue;

    const group = groups.get(`${value[0]}|${value[1]}`);

    if (group) {
      group.days.push(day);
    } else {
      groups.set(`${value[0]}|${value[1]}`, { days: [day], start: value[0], end: value[1] });
    }
  }

  return [...groups.values()];
}

function dateLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);

  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(parsed);
}

function busyDescription(value: string, timezone: string) {
  const first = value.split("\n").map((line) => line.trim()).find(Boolean);
  const match = first?.match(/^(.+?)\s*,\s*(.+)$/);

  if (!match) return null;

  const startsAt = new Date(match[1]);
  const endsAt = new Date(match[2]);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;

  const day = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    timeZone: timezone,
    weekday: "long",
  }).format(startsAt);
  const clock = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });

  return `${day} from ${clock.format(startsAt)} to ${clock.format(endsAt)}`;
}

// Build the exact Owner request from the current configuration instead of
// hardcoding a month. The agent receives concrete dates, days, and hours
// whatever the persisted state holds.
export function availabilityPromptFor(defaults: PlanFormDefaults, serviceSlug: string) {
  const service = serviceSlug.replaceAll("-", " ") || "dermatology";
  const periodStart = dateLabel(defaults.periodStart) ?? defaults.periodStart;
  const periodEnd = dateLabel(defaults.periodEnd) ?? defaults.periodEnd;
  const duration = DURATION_WORDS[defaults.slotDuration] ?? `${defaults.slotDuration}-minute`;
  const weeklyGroups = groupedDayRanges(defaults.weekly);
  const blockGroups = groupedDayRanges(defaults.blocks);
  const busy = busyDescription(defaults.busyText, defaults.timezone);

  const weeklyDesc = weeklyGroups.length
    ? weeklyGroups
        .map((group) => `${pluralDayList(group.days)} from ${shortClock(group.start)} to ${shortClock(group.end)}`)
        .join(", ")
    : "selected days";
  const blocksClause = blockGroups.length
    ? `, keep ${blockGroups
        .map((group) => `${pluralDayList(group.days)} from ${shortClock(group.start)} to ${shortClock(group.end)}`)
        .join("; ")} blocked`
    : "";

  return (
    `Update ${service} availability from ${periodStart} through ${periodEnd}. ${weeklyDesc}, `
    + `${duration}-minute appointments${blocksClause}. `
    + `${busy ? `My calendar is busy ${busy}. ` : ""}`
    + `Preserve existing bookings. Prepare the exact plan, and if it matches `
    + `these constraints, approve and apply it from my authenticated Owner session. Send the customer update.`
  );
}
