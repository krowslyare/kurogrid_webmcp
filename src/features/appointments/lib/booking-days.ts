export function todayInput(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Lima",
    year: "numeric",
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addDaysIso(iso: string, offset: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

export function limaWeekdayShort(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/Lima",
  }).format(new Date(`${iso}T12:00:00Z`));
}

export function nextSaturdayInLima(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Lima",
    year: "numeric",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)));
  const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  const rawOffset = 6 - isoWeekday;
  date.setUTCDate(date.getUTCDate() + (rawOffset <= 0 ? rawOffset + 7 : rawOffset));
  return date.toISOString().slice(0, 10);
}

export type BookingDayOption = {
  iso: string;
  weekday: string;
  dayNum: number;
};

export function nextSevenDays(defaultDate?: string, now = new Date()): BookingDayOption[] {
  const today = todayInput(now);
  const dates = Array.from({ length: 7 }, (_, offset) => addDaysIso(today, offset));

  if (defaultDate && !dates.includes(defaultDate)) {
    dates.push(defaultDate);
    dates.sort();
  }

  return dates.map((iso) => ({
    iso,
    weekday: iso === today ? "Today" : limaWeekdayShort(iso),
    dayNum: Number(iso.slice(8, 10)),
  }));
}
