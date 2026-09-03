import type { CSSProperties } from "react";

import { approveAvailabilityPlan, applyApprovedAvailabilityPlan, prepareAvailabilityPlanManually } from "../server/actions";
import { availabilityPromptFor, demoPlanDefaults, groupedDayRanges, hasConfiguredRanges } from "../lib/manual-plan";
import { restartGuidedDemo } from "@/features/demo/server/actions";

import styles from "./availability-control-room.module.css";
import { CopyAvailabilityPrompt } from "./CopyAvailabilityPrompt";
import { ManualSubmitButton } from "./ManualSubmitButton";

type JsonRecord = Record<string, unknown>;

type Props = {
  organizationSlug: string;
  role: "owner" | "member";
  plan: JsonRecord | null;
  defaultConfiguration?: unknown;
  services: Array<{ slug: string; name: string }>;
  appointments?: unknown[];
  notice?: string;
};

type PlanPhase =
  | "empty"
  | "pending"
  | "approved"
  | "applied"
  | "customer"
  | "completed"
  | "manual"
  | "stale"
  | "failed"
  | "unknown";

type Activity = {
  detail: string;
  title: string;
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function recordsFrom(...values: unknown[]) {
  return values.map(asRecord).filter((value): value is JsonRecord => Boolean(value));
}

function valueAt(records: JsonRecord[], keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) return record[key];
    }
  }

  return undefined;
}

function stringAt(records: JsonRecord[], keys: string[]) {
  const value = valueAt(records, keys);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberAt(records: JsonRecord[], keys: string[]) {
  const value = valueAt(records, keys);
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function booleanAt(records: JsonRecord[], keys: string[]) {
  const value = valueAt(records, keys);

  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;

  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return null;
}

function objectArrayAt(records: JsonRecord[], keys: string[]) {
  const value = valueAt(records, keys);
  if (Array.isArray(value)) {
    return value.map(asRecord).filter((item): item is JsonRecord => Boolean(item));
  }

  const object = asRecord(value);
  return object ? [object] : [];
}

function arrayLengthAt(records: JsonRecord[], keys: string[]) {
  const value = valueAt(records, keys);
  return Array.isArray(value) ? value.length : null;
}

function normalizeStatus(value: string | null): PlanPhase {
  const normalized = value?.toLowerCase().replaceAll("-", "_") ?? "";

  if (!normalized) return "unknown";
  if (normalized.includes("fail") || normalized.includes("error")) return "failed";
  if (normalized.includes("stale") || normalized.includes("expir")) return "stale";
  if (normalized.includes("manual") || normalized.includes("declin")) return "manual";
  if (normalized.includes("complete") || normalized.includes("accept")) return "completed";
  if (normalized.includes("customer") || normalized.includes("time_proposed") || normalized.includes("proposal")) {
    return "customer";
  }
  if (normalized.includes("appl") || normalized.includes("execut")) return "applied";
  if (normalized.includes("approv")) return "approved";
  if (
    normalized.includes("draft")
    || normalized.includes("prepar")
    || normalized.includes("pending")
    || normalized.includes("review")
    || normalized.includes("awaiting")
    || normalized.includes("ready")
  ) {
    return "pending";
  }

  return "unknown";
}

function humanizeStatus(value: string | null) {
  if (!value) return "No plan yet";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timeLabel(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  const direct = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (direct) return `${direct[1].padStart(2, "0")}:${direct[2]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Lima",
  }).format(date);
}

function timeAt(records: JsonRecord[], keys: string[]) {
  return timeLabel(valueAt(records, keys));
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function timelinePosition(value: string, startMinutes: number, endMinutes: number) {
  return Math.min(100, Math.max(0, ((minutes(value) - startMinutes) / (endMinutes - startMinutes)) * 100));
}

function timelineRange(start: string, end: string, startMinutes: number, endMinutes: number): CSSProperties {
  return {
    left: `${timelinePosition(start, startMinutes, endMinutes)}%`,
    width: `${Math.max(2, timelinePosition(end, startMinutes, endMinutes) - timelinePosition(start, startMinutes, endMinutes))}%`,
  };
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function validDayRange(row: JsonRecord): { day: number; start: string; end: string } | null {
  const day = row.day_of_week ?? row.day ?? row.weekday;
  const start = timeLabel(row.starts_at ?? row.start_at ?? row.start ?? row.from);
  const end = timeLabel(row.ends_at ?? row.end_at ?? row.end ?? row.to);

  if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) return null;
  if (!start || !end || minutes(start) >= minutes(end)) return null;

  return { day, start, end };
}

// Operating window comes from the plan's own ranges — Saturday first
// because the scenario fixtures live there, otherwise the widest day.
function operatingWindow(rows: JsonRecord[]): [string, string] | null {
  const valid = rows.map(validDayRange).filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (!valid.length) return null;

  const saturday = valid.filter((row) => row.day === 6);
  const source = saturday.length ? saturday : valid;
  const starts = source.map((row) => row.start).sort();
  const ends = source.map((row) => row.end).sort();

  return [starts[0], ends[ends.length - 1]];
}

function hourlyTicks(start: string, end: string) {
  const ticks: string[] = [];

  for (let cursor = minutes(start); cursor <= minutes(end); cursor += 60) {
    ticks.push(`${String(Math.floor(cursor / 60)).padStart(2, "0")}:00`);
  }

  return ticks;
}

function halfHourPositions(start: string, end: string) {
  const segments = Math.max(1, Math.round((minutes(end) - minutes(start)) / 30));
  return Array.from({ length: segments + 1 }, (_, index) => (index / segments) * 100);
}

function planPeriodLabel(periodStart: string | null, rows: JsonRecord[]) {
  const days = Array.from(
    new Set(
      rows.map(validDayRange).filter((row): row is NonNullable<typeof row> => Boolean(row)).map((row) => row.day),
    ),
  ).sort((first, second) => first - second).map((day) => WEEKDAY_SHORT[day]);

  const month = periodStart
    ? new Intl.DateTimeFormat("en", { month: "long", timeZone: "America/Lima" }).format(new Date(`${periodStart}T12:00:00`))
    : null;

  if (month && days.length) return `${month} · ${days.join(", ")}`;
  if (month) return month;
  if (days.length) return days.join(", ");

  return "Custom period";
}

function formatCreatedAt(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(date);
}

function weekdayFor(value: unknown) {
  if (typeof value !== "string") return "Appointment day";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Appointment day";

  return new Intl.DateTimeFormat("en", {
    timeZone: "America/Lima",
    weekday: "long",
  }).format(date);
}

function firstName(rows: JsonRecord[], fallback: string) {
  return rows
    .map((row) => stringAt([row], ["display_name", "name", "pet_name", "subject"]))
    .find(Boolean) ?? fallback;
}

function firstAppointmentTime(rows: JsonRecord[], keys: string[], fallback: string) {
  return rows.map((row) => timeAt([row], keys)).find(Boolean) ?? fallback;
}

function phaseActivity(phase: PlanPhase, statusLabel: string, hasPlan: boolean): Activity {
  if (!hasPlan) {
    return {
      title: "Waiting for your AI agent",
      detail: "Copy the request below into your AI agent. It prepares the exact plan; nothing changes until you ask it to apply.",
    };
  }

  switch (phase) {
    case "pending":
      return {
        title: "Plan ready for your review",
        detail: "Your AI agent calculated the exact impact. Nothing changes until your request asks it to apply.",
      };
    case "approved":
      return {
        title: "Approved — ready to apply",
        detail: "The exact dates and consequences are approved. Your AI agent may now apply the plan once.",
      };
    case "applied":
      return {
        title: "Schedule updated",
        detail: "The busy range is blocked and Luna has a held alternative. The decision is now with the customer.",
      };
    case "customer":
      return {
        title: "Waiting for Luna's decision",
        detail: "The alternative is proposed and held. Max stays unchanged while the customer decides.",
      };
    case "completed":
      return {
        title: "Resolved with the customer",
        detail: "The held alternative is confirmed. The schedule and public availability now agree.",
      };
    case "manual":
      return {
        title: "Needs a personal follow-up",
        detail: "The plan could not complete automatically. Contact the customer to agree on the next safe step.",
      };
    case "stale":
      return {
        title: "Plan is out of date",
        detail: "The schedule changed after preparation. Ask your AI agent to prepare a fresh exact plan.",
      };
    case "failed":
      return {
        title: "Plan needs attention",
        detail: "The latest operation failed. Review the plan status before asking your AI agent to retry.",
      };
    default:
      return {
        title: "Availability plan is present",
        detail: `${statusLabel} is the latest state of the availability plan.`,
      };
  }
}

type StepState = "done" | "current" | "error" | "todo";

function stepStatesFor(phase: PlanPhase, hasPlan: boolean, notice?: string): StepState[] {
  if (!hasPlan) return ["current", "todo", "todo", "todo"];

  // A failed or stale run marks the step that was in flight instead of
  // silently highlighting the next one.
  if (phase === "failed" || phase === "stale") {
    const attentionStep = notice === "apply_error" ? 3 : 2;
    return [1, 2, 3, 4].map((step) =>
      step < attentionStep ? "done" : step === attentionStep ? "error" : "todo");
  }

  switch (phase) {
    case "pending": return ["done", "current", "todo", "todo"];
    case "approved": return ["done", "done", "current", "todo"];
    case "applied":
    case "customer": return ["done", "done", "done", "current"];
    case "completed": return ["done", "done", "done", "done"];
    case "manual": return ["done", "done", "done", "current"];
    default: return ["done", "current", "todo", "todo"];
  }
}

function metricValue(value: number | string | null) {
  return value === null ? "Pending" : typeof value === "number" ? String(value) : value;
}

function countDetail(value: number | null, noun: string, waiting: string) {
  if (value === null) return waiting;
  return `${value} ${noun}${value === 1 ? "" : "s"} in the latest plan`;
}

function deliveryCopy(value: string | null) {
  const normalized = value?.toLowerCase().replaceAll("-", "_") ?? "";

  if (normalized.includes("sent") || normalized.includes("accepted") || normalized.includes("delivered")) {
    return "Email accepted by Resend";
  }
  if (normalized.includes("preview")) return "Preview available";
  if (normalized.includes("fail") || normalized.includes("error")) {
    return "Delivery failed · schedule state remains";
  }
  if (normalized.includes("pending")) return "Delivery pending";
  return "Delivery state not recorded";
}

function planStateCopy(phase: PlanPhase, hasPlan: boolean) {
  if (!hasPlan) {
    return "The schedule is unchanged. Your AI agent will create the exact plan from the request below.";
  }

  switch (phase) {
    case "pending": return "Review the calculated impact below before approving this exact plan.";
    case "approved": return "The exact plan is approved. Your AI agent can now apply it once.";
    case "applied":
    case "customer": return "Live availability is updated. Luna's alternative stays held while she decides.";
    case "completed": return "Luna accepted the alternative. The appointment and public availability now agree.";
    case "manual": return "The customer declined the alternative. Follow up with them directly.";
    case "stale": return "The schedule changed after preparation. Ask your AI agent for a fresh plan.";
    case "failed": return "The latest operation needs attention before this plan can continue.";
    default: return "This is the latest saved availability plan.";
  }
}

function nextMoveCopy(phase: PlanPhase, hasPlan: boolean) {
  if (!hasPlan) {
    return "Copy the request below into your AI agent. It prepares the exact availability plan.";
  }

  switch (phase) {
    case "pending": return "Your agent did its part. Review the impact below, then approve.";
    case "approved": return "Approval is recorded. Your agent — or the button below — applies this exact plan once.";
    case "applied":
    case "customer": return "The schedule is applied. Luna decides: she accepts or declines the new time.";
    case "completed": return "Done. The public site and AI agent tools now show the same availability.";
    case "manual": return "Follow up with the customer directly to agree on the next step.";
    case "stale": return "Ask your AI agent to prepare a fresh exact plan for the new schedule.";
    case "failed": return "Review the plan state before asking your agent to retry.";
    default: return "Waiting on the latest availability plan state.";
  }
}

function stateClass(phase: PlanPhase) {
  switch (phase) {
    case "pending": return styles.statusPending;
    case "approved": return styles.statusApproved;
    case "applied":
    case "customer":
    case "completed": return styles.statusApplied;
    case "failed":
    case "stale":
    case "manual": return styles.statusAttention;
    default: return styles.statusNeutral;
  }
}

export function AvailabilityControlRoom({ organizationSlug, role, plan, defaultConfiguration = null, services, appointments = [], notice }: Props) {
  const hasPlan = Boolean(plan);
  const formDefaults = demoPlanDefaults(defaultConfiguration);
  const usingExampleRules = !hasPlan && !hasConfiguredRanges(defaultConfiguration);
  const ruleStripLabel = hasPlan ? "Plan rules" : usingExampleRules ? "Example request" : "Current rules";
  const weeklyGroups = groupedDayRanges(formDefaults.weekly);
  const blockGroups = groupedDayRanges(formDefaults.blocks);
  const ruleChips = [
    ...weeklyGroups.flatMap((group) => group.days.map((day) => `${WEEKDAY_SHORT[day]} · ${group.start}–${group.end}`)),
    `${formDefaults.slotDuration} min`,
    ...(blockGroups.length === 1
      ? [`Blocked · ${blockGroups[0].start}–${blockGroups[0].end}`]
      : blockGroups.flatMap((group) => group.days.map((day) => `Blocked ${WEEKDAY_SHORT[day]} · ${group.start}–${group.end}`))),
    "Preserve bookings",
  ];
  const defaultServiceSlug = services.some((service) => service.slug === "dermatology")
    ? "dermatology"
    : services[0]?.slug ?? "dermatology";
  const availabilityPrompt = availabilityPromptFor(formDefaults, defaultServiceSlug);
  const planRecords = recordsFrom(plan);
  const appointmentRows = appointments
    .map(asRecord)
    .filter((row): row is JsonRecord => Boolean(row))
    .sort((first, second) => {
      const firstDate = String(first.starts_at ?? first.proposed_starts_at ?? "");
      const secondDate = String(second.starts_at ?? second.proposed_starts_at ?? "");
      return firstDate.localeCompare(secondDate);
    });
  const configurationRecords = recordsFrom(
    valueAt(planRecords, ["configuration", "config"]),
  );
  const previewRecords = recordsFrom(
    valueAt(planRecords, ["preview"]),
  );
  const appliedResultRecords = recordsFrom(
    valueAt(planRecords, ["applied_result", "appliedResult"]),
  );
  const payloadRecords = recordsFrom(
    valueAt(planRecords, ["payload", "data", "result", "details"]),
  );
  const impactRecords = recordsFrom(
    valueAt([
      ...planRecords,
      ...configurationRecords,
      ...previewRecords,
      ...appliedResultRecords,
      ...payloadRecords,
    ], [
      "impact",
      "impact_summary",
      "impactSummary",
      "consequence",
      "preview",
    ]),
  );
  const allRecords = [
    ...planRecords,
    ...configurationRecords,
    ...previewRecords,
    ...appliedResultRecords,
    ...payloadRecords,
    ...impactRecords,
  ];
  const recommendationRecords = recordsFrom(
    valueAt(allRecords, ["recommendation", "recommended_alternative", "recommended_slot", "alternative"]),
  );
  const planId = stringAt(planRecords, ["id", "plan_id", "availability_plan_id"]);
  const planHash = stringAt(planRecords, ["plan_hash", "planHash"]);
  const revision = numberAt(planRecords, ["base_configuration_revision", "baseConfigurationRevision"]);
  const rawStatus = stringAt(planRecords, ["status", "plan_status", "state"]);
  const storedPhase = hasPlan ? normalizeStatus(rawStatus) : "empty";
  const createdAt = formatCreatedAt(stringAt(planRecords, ["created_at", "createdAt"]));
  const persistedWeeklyRangeRows = objectArrayAt(allRecords, [
    "weekly_ranges",
    "weeklyRanges",
    "weekly_rules",
  ]);
  const requestedWeeklyRangeRows = Object.entries(formDefaults.weekly).flatMap(([day, range]) => range
    ? [{ day_of_week: Number(day), starts_at: range[0], ends_at: range[1] }]
    : []);
  const weeklyRangeRows = persistedWeeklyRangeRows.length
    ? persistedWeeklyRangeRows
    : requestedWeeklyRangeRows;
  const [windowStart, windowEnd] = operatingWindow(weeklyRangeRows) ?? ["09:00", "14:00"];
  const windowStartMinutes = minutes(windowStart);
  const windowEndMinutes = minutes(windowEnd);
  const tickLabels = hourlyTicks(windowStart, windowEnd);
  const tickPositions = halfHourPositions(windowStart, windowEnd);
  const periodStart = stringAt(allRecords, [
    "period_start",
    "periodStart",
    "target_date",
    "effective_date",
    "date",
  ]);
  const periodLabel = planPeriodLabel(periodStart ?? formDefaults.periodStart, weeklyRangeRows);
  const timezone = stringAt(allRecords, ["timezone", "time_zone"]) ?? "America/Lima";
  const serviceName = stringAt(allRecords, ["service_name", "service", "service_label"]) ?? "Dermatology";
  const slotDuration = numberAt(allRecords, [
    "slot_duration_minutes",
    "slotDuration",
    "duration_minutes",
    "duration",
  ]) ?? 30;

  const persistedAffectedRows = objectArrayAt(allRecords, [
    "affected_appointments",
    "affectedAppointments",
    "overlapping_appointments",
    "affected_bookings",
  ]);
  const persistedUnaffectedRows = objectArrayAt(allRecords, [
    "unaffected_appointments",
    "unaffectedAppointments",
    "preserved_appointments",
    "unaffected_bookings",
  ]);
  const affectedRows = hasPlan ? persistedAffectedRows : [];
  const unaffectedRows = hasPlan ? persistedUnaffectedRows : [];
  const affectedName = firstName(affectedRows, "Luna");
  const unaffectedName = firstName(unaffectedRows, "Max");
  const affectedTime = firstAppointmentTime(affectedRows, [
    "starts_at",
    "start_at",
    "original_starts_at",
    "proposed_starts_at",
  ], "10:00");
  const unaffectedTime = firstAppointmentTime(unaffectedRows, [
    "starts_at",
    "start_at",
  ], "12:00");

  const persistedBusyRows = objectArrayAt(allRecords, [
    "busy_intervals",
    "busyIntervals",
    "normalized_intervals",
    "external_busy_ranges",
    "intervals",
  ]);
  const requestedBusyRows = formDefaults.busyText.split("\n").flatMap((line) => {
    const match = line.trim().match(/^(.+?)\s*,\s*(.+)$/);
    return match ? [{ starts_at: match[1], ends_at: match[2] }] : [];
  });
  const busyRows = persistedBusyRows.length ? persistedBusyRows : (hasPlan ? requestedBusyRows : []);
  const focusDay = weekdayFor(
    appointmentRows[0]?.starts_at
      ?? appointmentRows[0]?.proposed_starts_at
      ?? (hasPlan ? busyRows[0]?.starts_at : null),
  );
  const busyStart = firstAppointmentTime(busyRows, ["starts_at", "start_at", "start", "from"], "10:00");
  const busyEnd = firstAppointmentTime(busyRows, ["ends_at", "end_at", "end", "to"], "11:30");
  const showAffectedPin = hasPlan && affectedRows.length > 0;
  const showUnaffectedPin = hasPlan && unaffectedRows.length > 0;
  const showBusyPill = hasPlan && busyRows.length > 0;
  const alternativeRows = objectArrayAt(allRecords, [
    "alternatives",
    "valid_alternatives",
    "alternative_slots",
  ]);
  const proposedTime = timeAt([...affectedRows, ...allRecords, ...recommendationRecords], [
    "recommended_time",
    "recommended_at",
    "recommended_starts_at",
    "proposed_starts_at",
    "alternative_time",
    "alternative_starts_at",
    "recommendation",
    "recommended_slot",
  ]) ?? timeAt(recommendationRecords, ["starts_at", "start_at", "time", "at"])
    ?? alternativeRows
      .map((row) => timeAt([row], ["starts_at", "start_at", "time", "at"]))
      .find(Boolean)
    ?? null;
  const affectedAppointmentId = stringAt(affectedRows, ["appointment_id", "request_id", "id"]);
  const currentAffectedAppointment = appointmentRows
    .find((row) => stringAt([row], ["id", "appointment_id", "request_id"]) === affectedAppointmentId);
  const currentAffectedStatus = currentAffectedAppointment
    ? stringAt([currentAffectedAppointment], ["status"])
    : null;
  const currentAffectedTime = currentAffectedAppointment
    ? timeAt([currentAffectedAppointment], ["proposed_starts_at", "starts_at"])
    : null;
  const phase: PlanPhase = storedPhase === "applied"
    && currentAffectedStatus === "confirmed"
    && Boolean(proposedTime)
    && currentAffectedTime === proposedTime
    ? "completed"
    : storedPhase;
  const statusLabel = phase === "completed" ? "Customer accepted" : humanizeStatus(rawStatus);

  const generatedSlots = numberAt(allRecords, [
    "generated_slots",
    "slots_generated",
    "generated_slot_count",
    "slots_created",
    "created_slot_count",
    "generated_slot_starts_count",
    "slots_to_create_count",
  ]) ?? arrayLengthAt(allRecords, [
    "generated_slot_starts",
    "slots_to_create",
    "generated_slots",
    "generated_slot_ids",
    "created_slots",
  ]);
  const removedSlots = numberAt(allRecords, [
    "removed_slots",
    "slots_removed",
    "removed_slot_count",
    "blocked_slots",
    "slots_blocked",
    "slots_to_disable_count",
  ]) ?? arrayLengthAt(allRecords, [
    "slots_to_disable",
    "removed_slots",
    "removed_slot_ids",
    "removed_slots_detail",
  ]);
  const affectedCount = numberAt(allRecords, [
    "affected_count",
    "affected_appointments_count",
    "appointments_affected",
  ]) ?? (affectedRows.length || null);
  const unaffectedCount = numberAt(allRecords, [
    "unaffected_count",
    "unaffected_appointments_count",
    "appointments_unaffected",
  ]) ?? (unaffectedRows.length || null);
  const changesApplied = booleanAt(allRecords, ["changes_applied", "changesApplied", "applied"])
    ?? (hasPlan ? ["applied", "customer", "completed"].includes(phase) : null);
  const notificationsSent = booleanAt(allRecords, ["notifications_sent", "notificationsSent"])
    ?? (hasPlan && ["pending", "approved"].includes(phase) ? false : null);
  const notificationCount = numberAt(allRecords, [
    "notification_count",
    "notifications_count",
    "affected_notification_count",
  ]) ?? affectedCount;
  const deliveryStatus = stringAt(allRecords, [
    "delivery_status",
    "notification_status",
    "email_status",
    "delivery",
  ]);
  const isApplied = Boolean(
    hasPlan
      && (changesApplied === true || ["applied", "customer", "completed", "manual"].includes(phase)),
  );
  const activity = phaseActivity(phase, statusLabel, hasPlan);
  const stepStates = stepStatesFor(phase, hasPlan, notice);
  const canApprove = Boolean(
    role === "owner"
      && planId
      && planHash
      && revision !== null
      && phase === "pending",
  );
  const canApplyNow = Boolean(
    role === "owner"
      && hasPlan
      && phase === "approved",
  );
  const approvalNotice = notice === "approved" && phase === "approved"
    ? "Approval recorded. The exact plan is approved; your AI agent may now apply it — or apply it yourself below."
    : notice === "applied"
      ? "Plan applied by hand. The busy range is blocked and the customer update was prepared."
      : notice === "approval_error"
          ? "Approval could not be recorded. The plan remains unchanged and should be refreshed before retrying."
          : notice === "apply_error"
            ? "Manual apply could not be completed. The plan is unchanged; refresh it before retrying."
            : notice === "prepared"
              ? "Plan prepared by hand. Review the impact above, then approve it below."
              : notice === "prepare_error"
                ? "Manual plan could not be prepared. Check dates, times, and busy ranges, then retry."
                : null;
  const approvalNoticeState = notice === "approved" || notice === "applied" || notice === "prepared" ? "success" : "error";
  const holdTime = proposedTime;
  const lunaDisplayState = !hasPlan
    ? "Synthetic fixture · confirmed"
    : isApplied
      ? phase === "completed" ? "Confirmed alternative" : "Awaiting customer response"
      : "Confirmed · impact preview";
  const maxDisplayState = !hasPlan ? "Synthetic fixture · preserved" : "Existing booking preserved";
  const affectedDisplayTime = phase === "completed" && proposedTime ? proposedTime : affectedTime;
  const notificationMetric = deliveryStatus?.toLowerCase().includes("preview")
    ? "Preview"
    : notificationsSent === null
      ? "Pending"
      : notificationsSent
        ? "Yes"
        : "0";
  const notificationLabel = notificationCount === null
    ? "Notification consequence not available"
    : notificationCount === 1
      ? isApplied ? "One customer update prepared" : "One customer will be notified"
      : isApplied ? `${notificationCount} customer updates prepared` : `${notificationCount} customers will be notified`;
  const approvalSideEffect = !hasPlan
    ? "No consequence yet"
    : notificationCount === null
      ? "Notification count not available"
      : notificationLabel;
  const approvalMessage = !hasPlan
    ? role === "owner"
      ? "No plan yet. Prepare it by hand below — no agent needed."
      : "No availability plan yet. An Owner can prepare one by hand or with an AI agent."
    : role !== "owner"
      ? "Member access can review this plan. An Owner must approve the exact revision."
      : phase === "approved"
        ? "Exact Owner approval is recorded. Your AI agent can apply it — or apply it yourself in the manual section below."
        : isApplied
          ? "This exact plan has already been applied."
          : phase !== "pending"
            ? "This plan is not currently awaiting Owner approval."
            : "Review the impact above. Approve it yourself in the manual section below — or ask your AI agent to finish it.";

  return (
    <section className={styles.room} aria-labelledby="availability-room-title">
      <ol className={styles.workflowSteps} aria-label="Availability workflow">
        {[
          [1, "Brief", "Set the rules once"],
          [2, "Review", "Your agent shows slots and conflicts"],
          [3, "Apply", "Agent when asked — or manual below"],
          [4, "Customer", "Luna accepts or declines"],
        ].map(([step, label, detail]) => {
          const state = stepStates[Number(step) - 1] ?? "todo";
          return (
            <li
              className={
                state === "done"
                  ? styles.workflowComplete
                  : state === "current"
                    ? styles.workflowCurrent
                    : state === "error"
                      ? styles.workflowError
                      : ""
              }
              key={String(step)}
            >
              <span>{state === "done" ? "✓" : state === "error" ? "!" : step}</span>
              <div><strong>{label}</strong><small>{detail}</small></div>
            </li>
          );
        })}
      </ol>

      <div className={styles.roomTop}>
        <div className={styles.roomIntro}>
          <div className={styles.roomIntroHeader}>
            <h2 id="availability-room-title">Availability, resolved.</h2>
            <p className={styles.roomLead}>
              Set the working-hour rules once. Your AI agent brings the calendar
              busy time, Mimo calculates the exact impact — and nothing applies
              until your request says so.
            </p>
          </div>
          <div className={styles.ruleStrip} aria-label="Requested availability rules">
            <span>{ruleStripLabel}</span>
            <div>
              {ruleChips.map((rule) => <b key={rule}>{rule}</b>)}
            </div>
          </div>
        </div>
        <div className={styles.roomGrid}>
          <div className={styles.promptCard} id="availability-prompt">
            <div className={styles.promptCardHead}>
              <div>
                <span className={styles.panelLabel}>Ask your AI agent</span>
                <strong>{nextMoveCopy(phase, hasPlan)}</strong>
              </div>
            </div>
            <div className={styles.promptCardFooter}>
              <CopyAvailabilityPrompt prompt={availabilityPrompt} />
            </div>
            <a className={styles.manualLink} href="#availability-manual">
              Prefer to handle it yourself? See the manual options ↓
            </a>
          </div>

          <aside className={styles.planCard} aria-label="Latest availability plan">
          <div className={styles.planCardHead}>
            <span className={styles.panelLabel}>Latest availability plan</span>
            <span className={`${styles.statusPill} ${stateClass(phase)}`}>{statusLabel}</span>
          </div>
          <div className={styles.planCardBody}>
            <strong>
              {hasPlan ? `${serviceName} · ${periodLabel}` : "No plan has been prepared"}
            </strong>
            <p>
              {planStateCopy(phase, hasPlan)}
            </p>
          </div>
          <dl className={styles.planMeta}>
            <div><dt>Base revision</dt><dd>{revision === null ? "Not set" : revision}</dd></div>
            <div><dt>Timezone</dt><dd>{timezone}</dd></div>
            <div><dt>Prepared</dt><dd>{createdAt ?? "Waiting"}</dd></div>
          </dl>
          <p className={styles.planSource}>
            {hasPlan ? "Status and impact are database-backed." : "No plan row returned; no impact is asserted."}
          </p>
          </aside>
        </div>
      </div>

      {hasPlan ? (
        <>
          <div className={styles.roomMain}>
            <section className={styles.timelinePanel} aria-labelledby="availability-timeline-title">
              <header className={styles.panelHeader}>
                <div>
                  <span className={styles.panelLabel}>{focusDay} operating window</span>
                  <h2 id="availability-timeline-title">{windowStart}–{windowEnd}</h2>
                </div>
                <div className={styles.panelHeaderMeta}>
                  <strong>{serviceName} · {slotDuration}-minute appointments</strong>
                  <span>{`${periodLabel} · ${timezone}`}</span>
                </div>
              </header>

              <div className={styles.timeline}>
                <div className={styles.timelineAxis} aria-hidden="true">
                  <span />
                  <div style={{ gridTemplateColumns: `repeat(${tickLabels.length}, minmax(0, 1fr))` }}>
                    {tickLabels.map((time) => <span key={time}>{time}</span>)}
                  </div>
                </div>

                <div className={styles.timelineRow}>
                  <div className={styles.rowLabel}>External context</div>
                  <div className={styles.rowTrack}>
                    {tickPositions.map((position) => (
                      <i key={position} className={styles.trackTick} style={{ left: `${position}%` }} aria-hidden="true" />
                    ))}
                    {showBusyPill ? (
                      <div className={styles.busyInterval} style={timelineRange(busyStart, busyEnd, windowStartMinutes, windowEndMinutes)}>
                        <strong>{isApplied ? "Blocked" : hasPlan ? "Busy interval" : "Requested busy time"}</strong>
                        <span>{busyStart}–{busyEnd}</span>
                      </div>
                    ) : null}
                  </div>
                  {!showBusyPill ? (
                    <div className={styles.rowNote}>No busy intervals in this plan</div>
                  ) : null}
                </div>

                <div className={styles.timelineRow}>
                  <div className={styles.rowLabel}>Existing bookings</div>
                  <div className={`${styles.rowTrack} ${styles.bookingTrack}`}>
                    {tickPositions.map((position) => (
                      <i key={position} className={styles.trackTick} style={{ left: `${position}%` }} aria-hidden="true" />
                    ))}
                    {showAffectedPin ? (
                      <div className={`${styles.booking} ${isApplied ? styles.bookingAffectedApplied : styles.bookingAffected} ${phase === "completed" ? styles.bookingCompleted : ""}`} style={{ left: `${timelinePosition(affectedDisplayTime, windowStartMinutes, windowEndMinutes)}%` }}>
                        <span className={styles.bookingPin} aria-hidden="true" />
                        <div>
                          <strong>{affectedName} · {affectedDisplayTime}</strong>
                          <small>{lunaDisplayState}</small>
                        </div>
                      </div>
                    ) : null}
                    {showUnaffectedPin ? (
                      <div className={`${styles.booking} ${styles.bookingUnchanged}`} style={{ left: `${timelinePosition(unaffectedTime, windowStartMinutes, windowEndMinutes)}%` }}>
                        <span className={styles.bookingPin} aria-hidden="true" />
                        <div>
                          <strong>{unaffectedName} · {unaffectedTime}</strong>
                          <small>{maxDisplayState}</small>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {!showAffectedPin || !showUnaffectedPin ? (
                    <div className={styles.rowNote}>
                      {!showAffectedPin ? "No bookings affected by this plan. " : ""}
                      {!showUnaffectedPin ? "No preserved bookings listed." : ""}
                    </div>
                  ) : null}
                </div>

                <div className={styles.timelineRow}>
                  <div className={styles.rowLabel}>Availability result</div>
                  <div className={`${styles.rowTrack} ${styles.resultTrack}`}>
                    {tickPositions.map((position) => (
                      <i key={position} className={styles.trackTick} style={{ left: `${position}%` }} aria-hidden="true" />
                    ))}
                    <div className={styles.openWindow} />
                    {proposedTime ? (
                      <div className={styles.recommendation} style={{ left: `${timelinePosition(proposedTime, windowStartMinutes, windowEndMinutes)}%` }}>
                        <span aria-hidden="true" />
                        <strong>{phase === "completed" ? "Confirmed" : isApplied ? "Held" : "Recommended"} · {proposedTime}</strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className={styles.timelineFooter}>
                <div className={styles.legend}>
                  <span><i className={styles.legendBusy} /> {showBusyPill ? (isApplied ? "Operational block" : hasPlan ? "Normalized calendar context" : "Requested calendar input") : "No busy intervals"}</span>
                  <span><i className={styles.legendAffected} /> {showAffectedPin ? (hasPlan ? "Luna in impact set" : "Luna · example booking") : "No conflicts"}</span>
                  <span><i className={styles.legendPreserved} /> {showUnaffectedPin ? (hasPlan ? "Max preserved" : "Max · control booking") : "No preserved bookings"}</span>
                </div>
                <small>{hasPlan ? "Plan-derived state · fixture names remain readable" : "Baseline clinic schedule · no pending changes"}</small>
              </div>
            </section>

            <section className={styles.impactPanel} aria-labelledby="availability-impact-title">
              <header className={styles.panelHeaderCompact}>
                <span className={styles.panelLabel}>Impact summary</span>
                <h2 id="availability-impact-title">
                  {phase === "completed"
                    ? "The schedule and appointment agree."
                    : phase === "manual"
                      ? "The customer needs another option."
                      : phase === "customer" || phase === "applied"
                        ? "The customer has one clear decision."
                        : phase === "approved"
                          ? "The next safe step is explicit."
                          : "No changes until the Owner asks to apply."}
                </h2>
              </header>
              <dl className={styles.impactGrid}>
                <div>
                  <dt>Generated slots</dt>
                  <dd>{metricValue(generatedSlots)}</dd>
                  <small>{countDetail(generatedSlots, "slot", "Count not included in this plan")}</small>
                </div>
                <div>
                  <dt>Removed slots</dt>
                  <dd>{metricValue(removedSlots)}</dd>
                  <small>{countDetail(removedSlots, "slot", "Count not included in this plan")}</small>
                </div>
                <div className={`${styles.impactWide} ${affectedRows.length > 0 ? styles.conflictAlertBox : ""}`}>
                  <div className={styles.impactHeaderLine}>
                    <dt>Affected appointment</dt>
                    {affectedRows.length > 0 ? (
                      <span className={styles.conflictBadge}>Direct conflict</span>
                    ) : null}
                  </div>
                  {affectedRows.length > 0 ? (
                    <>
                      <dd className={styles.conflictVisualRow}>
                        <span className={styles.petHighlight}>{affectedName}</span>
                        <del className={styles.conflictOldTime}>{affectedTime}</del>
                        <span className={styles.conflictArrow} aria-hidden="true">→</span>
                        <ins className={styles.conflictNewTime}>Proposed {holdTime ?? proposedTime ?? "11:30"}</ins>
                      </dd>
                      <small className={styles.conflictDetailCopy}>
                        Overlaps requested surgery block ({busyStart}–{busyEnd}) · {affectedCount ? `${affectedCount} conflict resolved to nearest opening` : "Automatically resolved to nearest opening"}
                      </small>
                    </>
                  ) : (
                    <>
                      <dd>No conflicts</dd>
                      <small>Every existing booking stays as scheduled</small>
                    </>
                  )}
                </div>
                <div className={`${styles.impactWide} ${unaffectedRows.length > 0 ? styles.preservedAlertBox : ""}`}>
                  <div className={styles.impactHeaderLine}>
                    <dt>Unaffected control</dt>
                    {unaffectedRows.length > 0 ? (
                      <span className={styles.preservedBadge}>Preserved</span>
                    ) : null}
                  </div>
                  {unaffectedRows.length > 0 ? (
                    <>
                      <dd className={styles.preservedVisualRow}>
                        <span className={styles.petHighlight}>{unaffectedName}</span>
                        <span className={styles.preservedTime}>· {unaffectedTime}</span>
                      </dd>
                      <small className={styles.preservedDetailCopy}>
                        Outside surgery block · {unaffectedCount ? `${unaffectedCount} booking preserved with zero disruption` : "Retained with zero disruption"}
                      </small>
                    </>
                  ) : (
                    <>
                      <dd>None listed</dd>
                      <small>No preserved bookings in this plan</small>
                    </>
                  )}
                </div>
                <div>
                  <dt>Recommended alternative</dt>
                  <dd>{metricValue(proposedTime)}</dd>
                  <small>{proposedTime ? "Nearest later valid time · same day" : "Waiting for plan policy"}</small>
                </div>
                <div>
                  <dt>Changes applied</dt>
                  <dd>{changesApplied === null ? "Pending" : changesApplied ? "Yes" : "0"}</dd>
                  <small>{changesApplied ? "Operational state is live" : "Waiting for an Owner apply instruction"}</small>
                </div>
                <div>
                  <dt>Notifications sent</dt>
                  <dd>{notificationMetric}</dd>
                  <small>{isApplied ? deliveryCopy(deliveryStatus) : notificationsSent ? deliveryCopy(deliveryStatus) : "Waiting for an Owner apply instruction"}</small>
                </div>
                <div>
                  <dt>Notification consequence</dt>
                  <dd>{notificationCount === null ? "Pending" : notificationCount}</dd>
                  <small>{notificationLabel}</small>
                </div>
              </dl>
              <p className={styles.policyNote}>
                <strong>Alternative policy:</strong> same service and duration, inside published hours,
                avoiding busy ranges, bookings, and holds; prefer the nearest later time on the same day.
              </p>
            </section>
          </div>

          <section className={styles.approvalPanel} id="availability-review" aria-labelledby="availability-approval-title">
            <div className={styles.approvalIntro}>
              <span className={styles.panelLabel}>Review and control</span>
              <h2 id="availability-approval-title">
                {phase === "approved"
                  ? "Approved — ready for either route."
                  : isApplied
                    ? "Applied from the Owner request."
                    : "Two routes to the same exact result."}
              </h2>
              <p>
                An explicit apply instruction in your prompt lets your AI agent approve and apply this exact result. Doing it by hand works too — same revision, same checks.
              </p>
            </div>
            <div className={styles.approvalReceipt}>
              <dl>
                <div><dt>Appointment</dt><dd>{affectedRows.length > 0 ? `${affectedName} · ${serviceName}` : "No conflicts in this plan"}</dd></div>
                <div><dt>Change</dt><dd>{holdTime ? `${periodLabel} ${affectedTime} → proposed ${holdTime}` : affectedRows.length > 0 ? "Exact alternative not recorded" : "Nothing to change"}</dd></div>
                <div><dt>Control</dt><dd>{unaffectedRows.length > 0 ? `${unaffectedName} remains at ${unaffectedTime}` : "No preserved bookings"}</dd></div>
                <div><dt>Side effect</dt><dd>{approvalSideEffect}</dd></div>
              </dl>
              {approvalNotice ? <p className={`${styles.notice} ${styles[approvalNoticeState === "success" ? "noticeSuccess" : "noticeError"]}`}>{approvalNotice}</p> : null}
              <p className={styles.approvalMessage}>{approvalMessage}</p>
              {canApprove ? (
                <form className={styles.approvalForm} action={approveAvailabilityPlan}>
                  <input name="organizationSlug" type="hidden" value={organizationSlug} />
                  <input name="planId" type="hidden" value={planId ?? ""} />
                  <input name="expectedRevision" type="hidden" value={revision ?? ""} />
                  <input name="planHash" type="hidden" value={planHash ?? ""} />
                  <ManualSubmitButton idleLabel="Approve this exact plan" pendingLabel="Approving…" />
                </form>
              ) : null}
              {canApplyNow ? (
                <form className={styles.approvalForm} action={applyApprovedAvailabilityPlan}>
                  <input name="organizationSlug" type="hidden" value={organizationSlug} />
                  <ManualSubmitButton idleLabel="Apply now" pendingLabel="Applying…" />
                </form>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {phase === "approved" ? (
        <div className={styles.agentReady} role="status">
          <span className={styles.agentReadyIcon} aria-hidden="true">✓</span>
          <div>
            <strong>Approval receipt: ready to apply, either way.</strong>
            <p>The manual approval is bound to this plan revision. Your AI agent can apply it — or apply it yourself in the manual section below.</p>
          </div>
          <span className={styles.agentReadyState}>Ready to apply</span>
        </div>
      ) : null}

      {isApplied ? (
        <section className={styles.postApplyPanel} id="availability-receipt" aria-labelledby="availability-post-apply-title">
          <header className={styles.panelHeaderCompact}>
            <span className={styles.panelLabel}>After apply</span>
            <h2 id="availability-post-apply-title">The operational receipt is readable at a glance.</h2>
          </header>
          <div className={styles.receiptGrid}>
            <div><span>Block</span><strong>{busyStart}–{busyEnd} blocked</strong><small>External busy interval is now active.</small></div>
            <div>
              <span>{phase === "completed" ? "Resolution" : "Hold"}</span>
              <strong>{phase === "completed"
                ? `${holdTime ?? "Alternative"} accepted by ${affectedName}`
                : holdTime ? `${holdTime} held for ${affectedName}` : `Alternative hold for ${affectedName}`}</strong>
              <small>{phase === "completed" ? "The held alternative became the confirmed appointment." : "Same service · awaiting customer response."}</small>
            </div>
            <div><span>Proposal</span><strong>{affectedName} · {phase === "completed" ? "confirmed" : "awaiting response"}</strong><small>{phase === "completed" ? "The customer accepted the held alternative." : "The original appointment remains separate until acceptance."}</small></div>
            <div><span>Control</span><strong>{unaffectedName} unchanged</strong><small>Existing booking preserved at {unaffectedTime}, including the lunch block rule.</small></div>
            <div><span>Delivery</span><strong>{deliveryCopy(deliveryStatus)}</strong><small>Provider delivery does not undo the operational state.</small></div>
          </div>
        </section>
      ) : null}

      <aside className={`${styles.activity} ${phase === "approved" ? styles.activityApproved : ""} ${isApplied ? styles.activityApplied : ""}`} aria-live="polite">
        <span className={styles.activityIcon} aria-hidden="true">M</span>
        <div>
          <span className={styles.panelLabel}>What is happening</span>
          <strong>{activity.title}</strong>
          <p>{activity.detail}</p>
        </div>
        <span className={styles.activityStatus}>{statusLabel}</span>
      </aside>

      {phase === "completed" ? (
        <section className={styles.demoComplete} aria-labelledby="demo-complete-title">
          <div>
            <span className={styles.panelLabel}>Schedule resolved</span>
            <h2 id="demo-complete-title">The clinic is ready for the next request.</h2>
            <p>Luna is confirmed at the accepted time, Max remains unchanged, and the public availability reflects the same result.</p>
          </div>
          <div className={styles.demoCompleteActions}>
            <a href="#availability-prompt">Prepare another update</a>
            <form action={restartGuidedDemo}>
              <button type="submit">Restart guided demo</button>
            </form>
          </div>
        </section>
      ) : null}

      <details className={styles.manualFallback} id="availability-manual">
        <summary>
          <span>Want to do it manually?</span>
          <small>No agent needed, approve and apply it yourself.</small>
        </summary>
        <div className={styles.manualBody}>
          {approvalNotice ? <p className={`${styles.notice} ${styles[approvalNoticeState === "success" ? "noticeSuccess" : "noticeError"]}`}>{approvalNotice}</p> : null}
          {role === "owner" ? (
            <div className={styles.manualStep}>
              <span className={styles.panelLabel}>{hasPlan ? "Update schedule · Prepare new plan revision" : "Step 0 · Prepare it by hand"}</span>
              <form className="publication-form" action={prepareAvailabilityPlanManually}>
                <input name="organizationSlug" type="hidden" value={organizationSlug} />
                <div className={styles.manualFieldGrid}>
                  <label>Service
                    <select name="serviceSlug" defaultValue="dermatology" required>
                      {services.map((service) => (
                        <option key={service.slug} value={service.slug}>{service.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>Period start<input name="periodStart" type="date" defaultValue={formDefaults.periodStart} required /></label>
                  <label>Period end<input name="periodEnd" type="date" defaultValue={formDefaults.periodEnd} required /></label>
                  <label>Timezone<input name="timezone" defaultValue={formDefaults.timezone} required /></label>
                  <label>Slot minutes<input name="slotDuration" type="number" min={5} max={480} defaultValue={formDefaults.slotDuration} required /></label>
                </div>
                <p className={styles.manualStatic}>Existing bookings are always preserved.</p>
                <div className={styles.manualRows} aria-label="Weekly working hours">
                  <span className={styles.panelLabel}>Which days are open?</span>
                  <small className={styles.manualHint}>Leave a day blank to keep it closed.</small>
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <div className={styles.manualRow} key={`weekly-${day}`}>
                      <span>{dayNames[day]}</span>
                      <label>Opens<input name={`weekly_start_${day}`} type="time" defaultValue={formDefaults.weekly[day]?.[0] ?? ""} /></label>
                      <label>Closes<input name={`weekly_end_${day}`} type="time" defaultValue={formDefaults.weekly[day]?.[1] ?? ""} /></label>
                    </div>
                  ))}
                </div>
                <div className={styles.manualRows} aria-label="Recurring blocked hours">
                  <span className={styles.panelLabel}>Blocked hours each day</span>
                  <small className={styles.manualHint}>For lunch or recurring breaks — blank means no block.</small>
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <div className={styles.manualRow} key={`block-${day}`}>
                      <span>{dayNames[day]}</span>
                      <label>From<input name={`block_start_${day}`} type="time" defaultValue={formDefaults.blocks[day]?.[0] ?? ""} /></label>
                      <label>Until<input name={`block_end_${day}`} type="time" defaultValue={formDefaults.blocks[day]?.[1] ?? ""} /></label>
                    </div>
                  ))}
                </div>
                <label>Busy intervals · one per line · start, end with timezone offset
                  <textarea name="busyIntervals" rows={3} defaultValue={formDefaults.busyText} placeholder="Start ISO datetime, end ISO datetime" />
                </label>
                <ManualSubmitButton
                  idleLabel={hasPlan ? "Prepare new plan revision" : "Prepare manually"}
                  pendingLabel="Preparing…"
                />
              </form>
            </div>
          ) : null}
          {canApprove ? (
            <div className={styles.manualStep}>
              <span className={styles.panelLabel}>Step 1 · Approve this exact plan</span>
              <form className={styles.approvalForm} action={approveAvailabilityPlan}>
                <input name="organizationSlug" type="hidden" value={organizationSlug} />
                <input name="planId" type="hidden" value={planId ?? ""} />
                <input name="expectedRevision" type="hidden" value={revision ?? ""} />
                <input name="planHash" type="hidden" value={planHash ?? ""} />
                <ManualSubmitButton idleLabel="Approve manually" pendingLabel="Approving…" />
                <small>RPC approval · base revision {revision} · plan hash verified</small>
              </form>
            </div>
          ) : null}
          {canApplyNow ? (
            <div className={styles.manualStep}>
              <span className={styles.panelLabel}>Step 2 · Apply it yourself</span>
              <form className={styles.approvalForm} action={applyApprovedAvailabilityPlan}>
                <input name="organizationSlug" type="hidden" value={organizationSlug} />
                <ManualSubmitButton idleLabel="Apply now" pendingLabel="Applying…" />
                <small>Same exact revision · same checks · customer update included</small>
              </form>
            </div>
          ) : null}
          {!canApprove && !canApplyNow && approvalMessage && hasPlan ? (
            <p className={styles.approvalMessage}>{approvalMessage}</p>
          ) : null}
        </div>
      </details>
    </section>
  );
}
