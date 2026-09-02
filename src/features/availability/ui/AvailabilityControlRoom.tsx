import type { CSSProperties } from "react";

import { approveAvailabilityPlan } from "../server/actions";

import styles from "./availability-control-room.module.css";
import { CopyAvailabilityPrompt } from "./CopyAvailabilityPrompt";

export const AVAILABILITY_PROMPT =
  "Set dermatology availability for September. Tuesdays and Thursdays from 9 to 1, Saturdays from 9 to 2, thirty-minute appointments, keep lunch blocked from 12 to 1, incorporate the busy ranges from my calendar, and preserve existing bookings. Prepare the exact plan, and if it matches these constraints, approve and apply it from my authenticated Owner session. Send the customer update.";

type JsonRecord = Record<string, unknown>;

type Props = {
  organizationSlug: string;
  role: "owner" | "member";
  plan: JsonRecord | null;
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

const timelineTimes = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00"];
const halfHourTicks = Array.from({ length: 11 }, (_, index) => index);
const ruleChips = [
  "Tue · 09:00–13:00",
  "Thu · 09:00–13:00",
  "Sat · 09:00–14:00",
  "30 min",
  "Lunch · 12:00–13:00",
  "Preserve bookings",
];

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

function timelinePosition(value: string) {
  const start = 9 * 60;
  const end = 14 * 60;
  return Math.min(100, Math.max(0, ((minutes(value) - start) / (end - start)) * 100));
}

function timelineRange(start: string, end: string): CSSProperties {
  return {
    left: `${timelinePosition(start)}%`,
    width: `${Math.max(2, timelinePosition(end) - timelinePosition(start))}%`,
  };
}

function labelForDate(value: string | null) {
  if (!value) return "September · Saturday";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "America/Lima",
  }).format(date);
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
      title: "Waiting for the assistant",
      detail: "Paste the request above. The assistant can prepare the exact plan and apply it when the Owner instruction says to do so.",
    };
  }

  switch (phase) {
    case "pending":
      return {
        title: "Availability plan ready for review",
        detail: "The assistant prepared the exact impact. Nothing changes unless the Owner request also asks it to apply.",
      };
    case "approved":
      return {
        title: "Owner approval recorded",
        detail: "The exact interval and consequence are approved. The assistant may now apply the plan.",
      };
    case "applied":
      return {
        title: "Availability plan applied",
        detail: "The busy range is blocked and Luna has a held alternative. The appointment still needs the customer decision.",
      };
    case "customer":
      return {
        title: "Waiting for Luna's decision",
        detail: "The alternative is proposed and held. Max remains unchanged while the customer decides.",
      };
    case "completed":
      return {
        title: "Customer resolution recorded",
        detail: "The held alternative is confirmed and the public availability state can stay consistent.",
      };
    case "manual":
      return {
        title: "Manual resolution required",
        detail: "The plan could not complete automatically. Review the appointment and choose the next safe step.",
      };
    case "stale":
      return {
        title: "Plan needs to be refreshed",
        detail: "The schedule revision changed before this plan was applied. The assistant must prepare a new exact plan.",
      };
    case "failed":
      return {
        title: "Availability plan needs attention",
        detail: "The latest operation failed. Check the plan status before asking the assistant to retry.",
      };
    default:
      return {
        title: "Availability plan is present",
        detail: `${statusLabel} is the latest state returned by the availability plan record.`,
      };
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
    return "The control room is ready. The assistant will create the plan from the request above.";
  }

  switch (phase) {
    case "pending": return "Review the calculated impact below before approving this exact plan.";
    case "approved": return "The exact plan is approved. Your assistant can now apply it once.";
    case "applied":
    case "customer": return "Live availability is updated. Luna’s alternative remains held while she decides.";
    case "completed": return "Luna accepted the alternative. The appointment and public availability now agree.";
    case "manual": return "The customer declined the alternative. The clinic can arrange the next step manually.";
    case "stale": return "The schedule changed after preparation. Ask the assistant to calculate a fresh plan.";
    case "failed": return "The latest operation needs attention before this plan can continue.";
    default: return "This is the latest persisted availability plan state.";
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

export function AvailabilityControlRoom({ organizationSlug, role, plan, appointments = [], notice }: Props) {
  const planRecords = recordsFrom(plan);
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
  const hasPlan = Boolean(plan);
  const planId = stringAt(planRecords, ["id", "plan_id", "availability_plan_id"]);
  const planHash = stringAt(planRecords, ["plan_hash", "planHash"]);
  const revision = numberAt(planRecords, ["base_configuration_revision", "baseConfigurationRevision"]);
  const rawStatus = stringAt(planRecords, ["status", "plan_status", "state"]);
  const storedPhase = hasPlan ? normalizeStatus(rawStatus) : "empty";
  const createdAt = formatCreatedAt(stringAt(planRecords, ["created_at", "createdAt"]));
  const periodLabel = labelForDate(stringAt(allRecords, [
    "period_label",
    "period",
    "date_label",
    "target_date",
    "effective_date",
    "date",
  ]));
  const timezone = stringAt(allRecords, ["timezone", "time_zone"]) ?? "America/Lima";
  const serviceName = stringAt(allRecords, ["service_name", "service", "service_label"]) ?? "Dermatology";

  const affectedRows = objectArrayAt(allRecords, [
    "affected_appointments",
    "affectedAppointments",
    "overlapping_appointments",
    "affected_bookings",
  ]);
  const unaffectedRows = objectArrayAt(allRecords, [
    "unaffected_appointments",
    "unaffectedAppointments",
    "preserved_appointments",
    "unaffected_bookings",
  ]);
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

  const busyRows = objectArrayAt(allRecords, [
    "busy_intervals",
    "busyIntervals",
    "normalized_intervals",
    "external_busy_ranges",
    "intervals",
  ]);
  const busyStart = firstAppointmentTime(busyRows, ["starts_at", "start_at", "start", "from"], "10:00");
  const busyEnd = firstAppointmentTime(busyRows, ["ends_at", "end_at", "end", "to"], "11:30");
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
  const currentAffectedAppointment = appointments
    .map(asRecord)
    .filter((row): row is JsonRecord => Boolean(row))
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
  const workflowStep = !hasPlan
    ? 1
    : phase === "pending"
      ? 2
      : phase === "approved"
        ? 3
        : phase === "completed"
          ? 5
          : 4;
  const canApprove = Boolean(
    role === "owner"
      && planId
      && planHash
      && revision !== null
      && phase === "pending",
  );
  const approvalNotice = notice === "approved" && phase === "approved"
    ? "Approval recorded. The exact plan is approved; the assistant may now apply it."
    : notice === "approval_error"
      ? "Approval could not be recorded. The plan remains unchanged and should be refreshed before retrying."
      : null;
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
    ? "The assistant has not prepared an availability plan yet."
    : role !== "owner"
      ? "Member access can review this plan. An Owner must approve the exact revision."
      : phase === "approved"
        ? "Exact Owner approval is recorded. Apply is now available to the assistant."
        : isApplied
        ? "This exact plan has already been applied."
          : phase !== "pending"
            ? "This plan is not currently awaiting Owner approval."
            : null;

  return (
    <section className={styles.room} aria-labelledby="availability-room-title">
      <ol className={styles.workflowSteps} aria-label="Availability workflow">
        {[
          [1, "Brief", "Rules and calendar"],
          [2, "Verify", "Slots and conflicts"],
          [3, "Apply", "Only when requested"],
          [4, "Customer", "Accept the new time"],
        ].map(([step, label, detail]) => (
          <li
            className={Number(step) < workflowStep ? styles.workflowComplete : Number(step) === workflowStep ? styles.workflowCurrent : ""}
            key={String(step)}
          >
            <span>{Number(step) < workflowStep ? "✓" : step}</span>
            <div><strong>{label}</strong><small>{detail}</small></div>
          </li>
        ))}
      </ol>

      <div className={styles.roomTop}>
        <div className={styles.roomIntro}>
          <div className={styles.roomEyebrow}>
            <span className={styles.liveDot} aria-hidden="true" />
            Availability plan <span>·</span> Owner workspace
          </div>
          <h2 id="availability-room-title"><span>Plan</span><span>September availability.</span></h2>
          <p className={styles.roomLead}>
            Your assistant brings in calendar busy time. Mimo checks the schedule and existing
            bookings. If your request explicitly says to apply the matching plan, the assistant
            can finish from this Owner session; otherwise it stops here for manual review.
          </p>
          <div className={styles.ruleStrip} aria-label="Requested availability rules">
            <span>Requested rules</span>
            <div>
              {ruleChips.map((rule) => <b key={rule}>{rule}</b>)}
            </div>
          </div>

          <div className={styles.promptCard}>
            <div className={styles.promptCardHead}>
              <div>
                <span className={styles.panelLabel}>Continue with your assistant</span>
                <strong>Paste this request into the agent that can read your calendar.</strong>
              </div>
              <span className={styles.promptBadge}>One prompt</span>
            </div>
            <blockquote>{AVAILABILITY_PROMPT}</blockquote>
            <div className={styles.promptCardFooter}>
              <span>Only normalized busy ranges enter Mimo. Event titles and notes stay outside.</span>
              <CopyAvailabilityPrompt prompt={AVAILABILITY_PROMPT} />
            </div>
          </div>
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

      <div className={styles.roomMain}>
        <section className={styles.timelinePanel} aria-labelledby="availability-timeline-title">
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.panelLabel}>Saturday operating window</span>
              <h2 id="availability-timeline-title">09:00–14:00</h2>
            </div>
            <div className={styles.panelHeaderMeta}>
              <strong>{serviceName} · 30-minute appointments</strong>
              <span>{hasPlan ? `${periodLabel} · ${timezone}` : "Example Saturday · nothing calculated yet"}</span>
            </div>
          </header>

          <div className={styles.timeline}>
            <div className={styles.timelineAxis} aria-hidden="true">
              <span />
              <div>
                {timelineTimes.map((time) => <span key={time}>{time}</span>)}
              </div>
            </div>

            <div className={styles.timelineRow}>
              <div className={styles.rowLabel}>External context</div>
              <div className={styles.rowTrack}>
                {halfHourTicks.map((tick) => (
                  <i key={tick} className={styles.trackTick} style={{ left: `${tick * 10}%` }} aria-hidden="true" />
                ))}
                <div className={styles.busyInterval} style={timelineRange(busyStart, busyEnd)}>
                  <strong>{isApplied ? "Blocked" : hasPlan ? "Busy interval" : "Example busy time"}</strong>
                  <span>{busyStart}–{busyEnd}</span>
                </div>
              </div>
            </div>

            <div className={styles.timelineRow}>
              <div className={styles.rowLabel}>Existing bookings</div>
              <div className={`${styles.rowTrack} ${styles.bookingTrack}`}>
                {halfHourTicks.map((tick) => (
                  <i key={tick} className={styles.trackTick} style={{ left: `${tick * 10}%` }} aria-hidden="true" />
                ))}
                <div className={`${styles.booking} ${isApplied ? styles.bookingAffectedApplied : styles.bookingAffected} ${phase === "completed" ? styles.bookingCompleted : ""}`} style={{ left: `${timelinePosition(affectedDisplayTime)}%` }}>
                  <span className={styles.bookingPin} aria-hidden="true" />
                  <div>
                    <strong>{affectedName} · {affectedDisplayTime}</strong>
                    <small>{lunaDisplayState}</small>
                  </div>
                </div>
                <div className={`${styles.booking} ${styles.bookingUnchanged}`} style={{ left: `${timelinePosition(unaffectedTime)}%` }}>
                  <span className={styles.bookingPin} aria-hidden="true" />
                  <div>
                    <strong>{unaffectedName} · {unaffectedTime}</strong>
                    <small>{maxDisplayState}</small>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.timelineRow}>
              <div className={styles.rowLabel}>Availability result</div>
              <div className={`${styles.rowTrack} ${styles.resultTrack}`}>
                {halfHourTicks.map((tick) => (
                  <i key={tick} className={styles.trackTick} style={{ left: `${tick * 10}%` }} aria-hidden="true" />
                ))}
                <div className={styles.openWindow} />
                {proposedTime ? (
                  <div className={styles.recommendation} style={{ left: `${timelinePosition(proposedTime)}%` }}>
                    <span aria-hidden="true" />
                    <strong>{phase === "completed" ? "Confirmed" : isApplied ? "Held" : "Recommended"} · {proposedTime}</strong>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.timelineFooter}>
            <div className={styles.legend}>
              <span><i className={styles.legendBusy} /> {isApplied ? "Operational block" : hasPlan ? "Normalized calendar context" : "Example calendar input"}</span>
              <span><i className={styles.legendAffected} /> {hasPlan ? "Luna in impact set" : "Luna · example booking"}</span>
              <span><i className={styles.legendPreserved} /> {hasPlan ? "Max preserved" : "Max · control booking"}</span>
            </div>
            <small>{hasPlan ? "Plan-derived state · fixture names remain readable" : "Example data shown before the plan is prepared"}</small>
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
              <small>{countDetail(generatedSlots, "slot", hasPlan ? "Count not included in this plan" : "Waiting for plan")}</small>
            </div>
            <div>
              <dt>Removed slots</dt>
              <dd>{metricValue(removedSlots)}</dd>
              <small>{countDetail(removedSlots, "slot", hasPlan ? "Count not included in this plan" : "Waiting for plan")}</small>
            </div>
            <div className={styles.impactWide}>
              <dt>Affected appointment</dt>
              <dd>{affectedName} <span>· {affectedTime}</span></dd>
              <small>{affectedCount === null ? "Fixture name · awaiting plan impact" : `${affectedCount} affected appointment${affectedCount === 1 ? "" : "s"} · conflict-derived`}</small>
            </div>
            <div className={styles.impactWide}>
              <dt>Unaffected control</dt>
              <dd>{unaffectedName} <span>· {unaffectedTime}</span></dd>
              <small>{unaffectedCount === null ? "Fixture name · awaiting plan impact" : `${unaffectedCount} unaffected · existing booking preserved`}</small>
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

      <section className={styles.approvalPanel} aria-labelledby="availability-approval-title">
        <div className={styles.approvalIntro}>
          <span className={styles.panelLabel}>Review and control</span>
          <h2 id="availability-approval-title">
            {phase === "approved"
              ? "Approved for the assistant to apply."
              : isApplied
                ? "Applied from the Owner request."
                : "Your assistant can finish this exact plan, or you can approve it here."}
          </h2>
          <p>
            {hasPlan
              ? "An explicit apply instruction in your prompt lets the assistant approve and apply this exact result. The button remains as the manual fallback."
              : "The exact plan and its consequence will appear here after the assistant prepares a database-backed availability plan."}
          </p>
        </div>
        <div className={styles.approvalReceipt}>
          <dl>
            <div><dt>Appointment</dt><dd>{hasPlan ? `${affectedName} · ${serviceName}` : "Waiting for plan"}</dd></div>
            <div><dt>Change</dt><dd>{hasPlan && holdTime ? `${periodLabel} ${affectedTime} → proposed ${holdTime}` : hasPlan ? "Exact alternative not recorded" : "No exact change yet"}</dd></div>
            <div><dt>Control</dt><dd>{hasPlan ? `${unaffectedName} remains at ${unaffectedTime}` : "Fixture context · not evaluated"}</dd></div>
            <div><dt>Side effect</dt><dd>{approvalSideEffect}</dd></div>
          </dl>
          {approvalNotice ? <p className={`${styles.notice} ${notice === "approved" ? styles.noticeSuccess : styles.noticeError}`}>{approvalNotice}</p> : null}
          {canApprove ? (
            <form className={styles.approvalForm} action={approveAvailabilityPlan}>
              <input name="organizationSlug" type="hidden" value={organizationSlug} />
              <input name="planId" type="hidden" value={planId ?? ""} />
              <input name="expectedRevision" type="hidden" value={revision ?? ""} />
              <input name="planHash" type="hidden" value={planHash ?? ""} />
              <button className={styles.approveButton} type="submit">Approve manually</button>
              <small>RPC approval · base revision {revision} · plan hash verified</small>
            </form>
          ) : (
            <p className={styles.approvalMessage}>{approvalMessage}</p>
          )}
        </div>
      </section>

      {phase === "approved" ? (
        <div className={styles.agentReady} role="status">
          <span className={styles.agentReadyIcon} aria-hidden="true">✓</span>
          <div>
            <strong>Approval receipt: the assistant may now apply.</strong>
            <p>The manual approval is bound to this plan revision. The assistant can now apply it without another review step.</p>
          </div>
          <span className={styles.agentReadyState}>Ready to apply</span>
        </div>
      ) : null}

      {isApplied ? (
        <section className={styles.postApplyPanel} aria-labelledby="availability-post-apply-title">
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
        <span className={styles.activityIcon} aria-hidden="true">AI</span>
        <div>
          <span className={styles.panelLabel}>Assistant activity</span>
          <strong>{activity.title}</strong>
          <p>{activity.detail}</p>
        </div>
        <span className={styles.activityStatus}>{statusLabel}</span>
      </aside>
    </section>
  );
}
