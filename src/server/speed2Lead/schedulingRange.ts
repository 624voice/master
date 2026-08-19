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
