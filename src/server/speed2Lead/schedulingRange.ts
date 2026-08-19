import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  centralDateAt,
  parseCentralParts,
} from "~/server/appointmentLifecycle/consultationSlots";

export type AvailabilityRangeInput = {
  rangeStart?: string;
  rangeEnd?: string;
  centralDate?: string;
  partOfDay?: "morning" | "afternoon" | "evening" | "full_day";
};

export type ResolvedAvailabilityRange = {
  rangeStart: Date;
  rangeEnd: Date;
};

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function parseCentralDate(date: string): { year: number; month: number; day: number } | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function partOfDayHours(partOfDay: AvailabilityRangeInput["partOfDay"]): {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
} {
  switch (partOfDay) {
    case "morning":
      return { startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 };
    case "afternoon":
      return { startHour: 12, startMinute: 0, endHour: 17, endMinute: 0 };
    case "evening":
      return { startHour: 16, startMinute: 0, endHour: 17, endMinute: 0 };
    case "full_day":
    default:
      return { startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 };
  }
}

function formatCentralDate(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function centralPartsFromDate(date: Date) {
  return parseCentralParts(date, CONSULTATION_TIMEZONE);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function nextWeekdayCentral(
  weekdayName: (typeof WEEKDAY_NAMES)[number],
  now = new Date(),
): string {
  const target = WEEKDAY_NAMES.indexOf(weekdayName);
  if (target < 0) {
    throw new Error(`Unknown weekday: ${weekdayName}`);
  }

  let candidate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  for (let i = 0; i < 14; i++) {
    const parts = centralPartsFromDate(candidate);
    if (WEEKDAY_TO_INDEX[parts.weekday] === target) {
      return formatCentralDate(parts);
    }
    candidate = addDays(candidate, 1);
  }

  throw new Error(`Could not find upcoming ${weekdayName}`);
}

export function tomorrowCentralDate(now = new Date()): string {
  return formatCentralDate(centralPartsFromDate(addDays(now, 1)));
}

export function resolveLaterThisWeekRange(now = new Date()): ResolvedAvailabilityRange {
  const today = centralPartsFromDate(now);
  let start = addDays(now, 1);
  let startParts = centralPartsFromDate(start);

  while (startParts.weekday === "Sat" || startParts.weekday === "Sun") {
    start = addDays(start, 1);
    startParts = centralPartsFromDate(start);
  }

  let endParts = { ...today };
  while (endParts.weekday !== "Fri") {
    const next = addDays(
      centralDateAt(endParts.year, endParts.month, endParts.day, 12, 0, CONSULTATION_TIMEZONE),
      1,
    );
    endParts = centralPartsFromDate(next);
  }

  const rangeStart = centralDateAt(
    startParts.year,
    startParts.month,
    startParts.day,
    9,
    0,
    CONSULTATION_TIMEZONE,
  );
  const rangeEnd = centralDateAt(
    endParts.year,
    endParts.month,
    endParts.day,
    17,
    0,
    CONSULTATION_TIMEZONE,
  );

  return { rangeStart, rangeEnd };
}

export function resolveAvailabilityRange(
  input: AvailabilityRangeInput,
  now = new Date(),
): ResolvedAvailabilityRange | { error: string } {
  if (input.rangeStart && input.rangeEnd) {
    const rangeStart = new Date(input.rangeStart);
    const rangeEnd = new Date(input.rangeEnd);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      return { error: "Invalid ISO range" };
    }
    if (rangeEnd.getTime() <= rangeStart.getTime()) {
      return { error: "rangeEnd must be after rangeStart" };
    }
    if (rangeEnd.getTime() <= now.getTime()) {
      return { error: "Requested range is entirely in the past" };
    }
    return { rangeStart, rangeEnd };
  }

  if (!input.centralDate) {
    return { error: "Provide rangeStart/rangeEnd or centralDate" };
  }

  const parts = parseCentralDate(input.centralDate);
  if (!parts) {
    return { error: "centralDate must be YYYY-MM-DD" };
  }

  const hours = partOfDayHours(input.partOfDay ?? "full_day");
  const rangeStart = centralDateAt(
    parts.year,
    parts.month,
    parts.day,
    hours.startHour,
    hours.startMinute,
    CONSULTATION_TIMEZONE,
  );
  const rangeEnd = centralDateAt(
    parts.year,
    parts.month,
    parts.day,
    hours.endHour,
    hours.endMinute,
    CONSULTATION_TIMEZONE,
  );

  if (rangeEnd.getTime() <= now.getTime()) {
    return { error: "Requested day is entirely in the past" };
  }

  const weekday = parseCentralParts(rangeStart, CONSULTATION_TIMEZONE).weekday;
  if (weekday === "Sat" || weekday === "Sun") {
    return { error: "Requested day is outside weekday business availability" };
  }

  return { rangeStart, rangeEnd };
}

export function inferPartOfDay(message: string): AvailabilityRangeInput["partOfDay"] {
  const lower = message.toLowerCase();
  if (/\b(after lunch)\b/.test(lower)) return "afternoon";
  if (/\b(morning|before noon)\b/.test(lower)) return "morning";
  if (/\b(afternoon|after lunch)\b/.test(lower)) return "afternoon";
  if (/\b(evening)\b/.test(lower)) return "evening";
  return "full_day";
}

export function inferAvailabilityInputFromMessage(
  message: string,
  now = new Date(),
): AvailabilityRangeInput | null {
  const lower = message.toLowerCase();

  if (/\blater this week\b/.test(lower)) {
    const range = resolveLaterThisWeekRange(now);
    return {
      rangeStart: range.rangeStart.toISOString(),
      rangeEnd: range.rangeEnd.toISOString(),
    };
  }

  if (/\btomorrow\b/.test(lower)) {
    return {
      centralDate: tomorrowCentralDate(now),
      partOfDay: inferPartOfDay(lower),
    };
  }

  for (const weekday of WEEKDAY_NAMES) {
    if (new RegExp(`\\b${weekday}\\b`).test(lower)) {
      return {
        centralDate: nextWeekdayCentral(weekday, now),
        partOfDay: inferPartOfDay(lower),
      };
    }
  }

  const bareHour = lower.match(/\b(?:around|at)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (bareHour) {
    let meridiem = (bareHour[3] ?? "").toLowerCase();
    const hour = Number.parseInt(bareHour[1] ?? "0", 10);
    if (!meridiem) {
      meridiem = hour >= 8 && hour <= 11 ? "am" : "pm";
    }
    const date = /\btomorrow\b/.test(lower)
      ? tomorrowCentralDate(now)
      : inferWeekdayDateFromMessage(lower, now) ?? formatCentralDate(centralPartsFromDate(now));
    return { centralDate: date, partOfDay: inferPartOfDay(lower) };
  }

  return null;
}

function inferWeekdayDateFromMessage(message: string, now: Date): string | null {
  for (const weekday of WEEKDAY_NAMES) {
    if (new RegExp(`\\b${weekday}\\b`).test(message)) {
      return nextWeekdayCentral(weekday, now);
    }
  }
  return null;
}
