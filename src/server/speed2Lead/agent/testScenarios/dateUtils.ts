/** Timezone-aware date helpers for mechanical scheduling checks. */

export function formatPartsInTimezone(
  date: Date,
  timezone: string,
): { year: number; month: number; day: number; weekday: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number.parseInt(get("year"), 10),
    month: Number.parseInt(get("month"), 10),
    day: Number.parseInt(get("day"), 10),
    weekday: get("weekday"),
    hour: Number.parseInt(get("hour"), 10),
    minute: Number.parseInt(get("minute"), 10),
  };
}

export function dateKeyInTimezone(date: Date, timezone: string): string {
  const { year, month, day } = formatPartsInTimezone(date, timezone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function slotDateKey(startIso: string, timezone: string): string {
  return dateKeyInTimezone(new Date(startIso), timezone);
}

export function slotHour(startIso: string, timezone: string): number {
  return formatPartsInTimezone(new Date(startIso), timezone).hour;
}

export function slotWeekday(startIso: string, timezone: string): string {
  return formatPartsInTimezone(new Date(startIso), timezone).weekday;
}

const WEEKDAY_ORDER = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function addCalendarDaysInTimezone(reference: Date, timezone: string, days: number): Date {
  const key = dateKeyInTimezone(reference, timezone);
  const [y, m, d] = key.split("-").map((v) => Number.parseInt(v, 10));
  const utcMidnight = Date.UTC(y, m - 1, d + days, 12, 0, 0);
  return new Date(utcMidnight);
}

export function tomorrowDateKey(reference: Date, timezone: string): string {
  const tomorrow = addCalendarDaysInTimezone(reference, timezone, 1);
  return dateKeyInTimezone(tomorrow, timezone);
}

export function nextWeekdayDateKey(
  weekdayName: string,
  reference: Date,
  timezone: string,
): string {
  const target = WEEKDAY_ORDER.indexOf(weekdayName as (typeof WEEKDAY_ORDER)[number]);
  if (target < 0) {
    throw new Error(`Unknown weekday: ${weekdayName}`);
  }

  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = addCalendarDaysInTimezone(reference, timezone, offset);
    const parts = formatPartsInTimezone(candidate, timezone);
    if (parts.weekday === weekdayName) {
      return dateKeyInTimezone(candidate, timezone);
    }
  }

  throw new Error(`Could not resolve next ${weekdayName}`);
}

export function formatExactDateLabel(reference: Date, timezone: string): string {
  const parts = formatPartsInTimezone(reference, timezone);
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = monthNames[parts.month - 1] ?? "January";
  const suffix =
    parts.day % 10 === 1 && parts.day !== 11
      ? "st"
      : parts.day % 10 === 2 && parts.day !== 12
        ? "nd"
        : parts.day % 10 === 3 && parts.day !== 13
          ? "rd"
          : "th";
  return `${month} ${parts.day}${suffix}`;
}

export function weekdayNameForDateKey(dateKey: string, timezone: string): string {
  const [y, m, d] = dateKey.split("-").map((v) => Number.parseInt(v, 10));
  const noonUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
  return formatPartsInTimezone(new Date(noonUtc), timezone).weekday;
}
