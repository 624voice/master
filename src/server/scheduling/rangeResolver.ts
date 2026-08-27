import { centralDateAt, parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import {
  isConfiguredBusinessDay,
  nextOpenBusinessDayAfter,
  tomorrowCentralDate,
} from "~/server/speed2Lead/schedulingRange";
import type { AvailabilityPreference, SchedulingRequest } from "~/server/scheduling/types";

export type ResolvedProviderRange = {
  rangeStart: Date;
  rangeEnd: Date;
  centralDate?: string;
};

const ANCHOR_QUERY_PADDING_MINUTES = 90;

function parseCentralDate(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function businessStartMinutes(request: SchedulingRequest): number {
  return request.businessHours.weekdayStartHour * 60 + request.businessHours.weekdayStartMinute;
}

function businessEndMinutes(request: SchedulingRequest): number {
  return request.businessHours.weekdayEndHour * 60 + request.businessHours.weekdayEndMinute;
}

function partOfDayHours(
  preference: AvailabilityPreference,
  request: SchedulingRequest,
): {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
} {
  switch (preference) {
    case "morning":
      return { startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 };
    case "afternoon":
      return { startHour: 12, startMinute: 0, endHour: 17, endMinute: 0 };
    case "evening": {
      const endMinutes = businessEndMinutes(request);
      return {
        startHour: 15,
        startMinute: 0,
        endHour: Math.floor(endMinutes / 60),
        endMinute: endMinutes % 60,
      };
    }
    case "exact_time":
    case "earliest":
    case "full_day":
    default:
      return {
        startHour: request.businessHours.weekdayStartHour,
        startMinute: request.businessHours.weekdayStartMinute,
        endHour: request.businessHours.weekdayEndHour,
        endMinute: request.businessHours.weekdayEndMinute,
      };
  }
}

function resolveAnchorQueryRange(
  request: SchedulingRequest,
  parts: { year: number; month: number; day: number },
): ResolvedProviderRange {
  const anchor = request.anchorTime!;
  const startMinutes = Math.max(
    businessStartMinutes(request),
    anchor - ANCHOR_QUERY_PADDING_MINUTES,
  );
  const endMinutes = Math.max(
    businessEndMinutes(request),
    anchor + ANCHOR_QUERY_PADDING_MINUTES,
  );
  return {
    rangeStart: centralDateAt(
      parts.year,
      parts.month,
      parts.day,
      Math.floor(startMinutes / 60),
      startMinutes % 60,
      request.timezone,
    ),
    rangeEnd: centralDateAt(
      parts.year,
      parts.month,
      parts.day,
      Math.floor(endMinutes / 60),
      endMinutes % 60,
      request.timezone,
    ),
    centralDate: request.requestedDate,
  };
}

export function resolveRangeForRequest(
  request: SchedulingRequest,
  now: Date,
): ResolvedProviderRange | { error: string } {
  if (!request.requestedDate && request.availabilityPreference !== "earliest") {
    return { error: "missing_date" };
  }

  let centralDate = request.requestedDate;
  if (centralDate && !isConfiguredBusinessDay(centralDate)) {
    centralDate = nextOpenBusinessDayAfter(centralDate);
  }

  const queryPreference =
    request.availabilityPreference === "exact_time" || request.availabilityPreference === "earliest"
      ? "full_day"
      : request.availabilityPreference;

  if (!centralDate) {
    centralDate = tomorrowCentralDate(now);
  }

  const parts = parseCentralDate(centralDate);
  if (!parts) {
    return { error: "invalid_date" };
  }

  if (request.anchorTime != null) {
    const anchorRange = resolveAnchorQueryRange(request, parts);
    if (anchorRange.rangeEnd.getTime() <= now.getTime()) {
      return { error: "past_range" };
    }
    return { ...anchorRange, centralDate };
  }

  const hours = partOfDayHours(queryPreference, request);
  const rangeStart = centralDateAt(
    parts.year,
    parts.month,
    parts.day,
    hours.startHour,
    hours.startMinute,
    request.timezone,
  );
  const rangeEnd = centralDateAt(
    parts.year,
    parts.month,
    parts.day,
    hours.endHour,
    hours.endMinute,
    request.timezone,
  );

  if (rangeEnd.getTime() <= now.getTime()) {
    return { error: "past_range" };
  }

  return { rangeStart, rangeEnd, centralDate };
}

export function nextBusinessCentralDate(centralDate: string, timezone: string): string {
  const parts = parseCentralDate(centralDate);
  if (!parts) {
    throw new Error(`Invalid centralDate: ${centralDate}`);
  }
  let candidate = centralDateAt(parts.year, parts.month, parts.day, 12, 0, timezone);
  for (let i = 0; i < 10; i++) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    const weekday = parseCentralParts(candidate, timezone).weekday;
    if (weekday !== "Sat" && weekday !== "Sun") {
      const p = parseCentralParts(candidate, timezone);
      return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    }
  }
  return nextOpenBusinessDayAfter(centralDate);
}

export function businessDatesForward(fromCentralDate: string, count: number, timezone: string): string[] {
  const dates: string[] = [];
  let current = fromCentralDate;
  for (let i = 0; i < count; i++) {
    if (isConfiguredBusinessDay(current)) {
      dates.push(current);
    }
    current = nextBusinessCentralDate(current, timezone);
  }
  return dates;
}

export function tomorrowOrTodayCentral(now: Date, timezone: string): string {
  return tomorrowCentralDate(now);
}
