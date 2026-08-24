import { parseFlexibleTimeToken } from "~/server/speed2Lead/schedulingContext";
import {
  nextWeekdayCentral,
  tomorrowCentralDate,
} from "~/server/speed2Lead/schedulingRange";
import type { AvailabilityPreference, CanonicalSchedulingState } from "~/server/scheduling/types";

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const EARLIEST_RE =
  /\b(first\s+available|your\s+first\s+availability|when(?:'s|\s+is)\s+your\s+first\s+availability|earliest\s+you\s+have|earliest\s+(?:slot|time|opening)|soonest\s+you\s+have|whatever\s+is\s+first|whichever\s+is\s+first|first\s+opening)\b/i;

const FLEXIBLE_RE =
  /\b(any\s*time|anytime|whenever|i'?m\s+flexible|im\s+flexible|flexible|any\s+time\s+works|whatever\s+you\s+have)\b/i;

const EXPLICIT_DAYPART_RE =
  /\b(morning|before\s+noon|afternoon|after\s+lunch|evening)\b/i;

const DATE_ONLY_RE =
  /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i;

const TIME_TOKEN_RE =
  /\b(?:around|at|about|how\s+about|let'?s\s+do|lets?\s+do|take|book|do)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b|\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i;

export type IntentPatch = {
  requestedDate?: string;
  availabilityPreference?: AvailabilityPreference;
  exactTimeMinutes?: number;
};

function resolveDateFromMessage(message: string, now: Date): string | undefined {
  const lower = message.toLowerCase();
  if (/\btomorrow\b/.test(lower)) {
    return tomorrowCentralDate(now);
  }
  for (const weekday of WEEKDAY_NAMES) {
    if (new RegExp(`\\b(?:next\\s+)?${weekday}\\b`).test(lower)) {
      return nextWeekdayCentral(weekday, now);
    }
  }
  return undefined;
}

function hasExplicitDaypart(message: string): boolean {
  return EXPLICIT_DAYPART_RE.test(message.toLowerCase());
}

function isDateBroadeningMessage(message: string): boolean {
  const lower = message.toLowerCase().trim();
  if (FLEXIBLE_RE.test(lower) || EARLIEST_RE.test(lower)) return false;
  if (!DATE_ONLY_RE.test(lower)) return false;
  if (hasExplicitDaypart(message)) return false;
  if (TIME_TOKEN_RE.test(lower)) return false;
  return true;
}

function extractExactTimeMinutes(message: string): number | null {
  const match = message.match(TIME_TOKEN_RE);
  if (!match) return null;
  const raw = (match[1] ?? match[2] ?? "").trim();
  if (!raw) return null;
  const parsed = parseFlexibleTimeToken(raw.replace(/\s+/g, ""));
  return parsed == null || Number.isNaN(parsed) ? null : parsed;
}

/** Merge inbound language into canonical scheduling intent. */
export function parseSchedulingIntentUpdate(
  message: string,
  prior: CanonicalSchedulingState | undefined,
  now: Date,
): IntentPatch {
  const lower = message.toLowerCase().trim();
  const patch: IntentPatch = {};

  if (EARLIEST_RE.test(lower)) {
    patch.availabilityPreference = "earliest";
  }

  if (FLEXIBLE_RE.test(lower) && patch.availabilityPreference !== "earliest") {
    patch.availabilityPreference = "full_day";
  }

  const resolvedDate = resolveDateFromMessage(message, now);
  if (resolvedDate) {
    patch.requestedDate = resolvedDate;
  }

  if (/\b(morning|before\s+noon)\b/.test(lower)) {
    patch.availabilityPreference = "morning";
  } else if (/\b(after\s+lunch|afternoon)\b/.test(lower)) {
    patch.availabilityPreference = "afternoon";
  } else if (/\b(evening)\b/.test(lower)) {
    patch.availabilityPreference = "afternoon";
  }

  const exactMinutes = extractExactTimeMinutes(message);
  const dateForExact = patch.requestedDate ?? prior?.requestedDate;
  if (exactMinutes != null && dateForExact) {
    patch.availabilityPreference = "exact_time";
    patch.exactTimeMinutes = exactMinutes;
    patch.requestedDate = dateForExact;
  }

  if (isDateBroadeningMessage(message)) {
    const priorPref = prior?.availabilityPreference ?? legacyPartToPreference(prior?.partOfDay as never);
    if (
      priorPref &&
      priorPref !== "full_day" &&
      priorPref !== "earliest"
    ) {
      patch.availabilityPreference = "full_day";
    }
  }

  if (
    patch.requestedDate &&
    !patch.availabilityPreference &&
    prior?.availabilityPreference &&
    prior.availabilityPreference !== "full_day" &&
    prior.availabilityPreference !== "earliest" &&
    isDateBroadeningMessage(message)
  ) {
    patch.availabilityPreference = "full_day";
  }

  return patch;
}

function legacyPartToPreference(part?: string): AvailabilityPreference | undefined {
  switch (part) {
    case "morning":
      return "morning";
    case "afternoon":
    case "evening":
      return "afternoon";
    case "full_day":
      return "full_day";
    default:
      return undefined;
  }
}

export function mergeIntentIntoState(
  prior: CanonicalSchedulingState,
  patch: IntentPatch,
): CanonicalSchedulingState {
  return {
    ...prior,
    requestedDate: patch.requestedDate ?? prior.requestedDate,
    availabilityPreference: patch.availabilityPreference ?? prior.availabilityPreference,
    exactTimeMinutes:
      patch.availabilityPreference === "exact_time"
        ? patch.exactTimeMinutes ?? prior.exactTimeMinutes
        : patch.exactTimeMinutes ?? prior.exactTimeMinutes,
  };
}

export function buildSchedulingRequestFromState(
  state: CanonicalSchedulingState,
  timezone: string,
  businessHours: import("~/server/appointmentLifecycle/consultationConfig").ConsultationBusinessHours,
  meetingDurationMinutes: number,
): import("~/server/scheduling/types").SchedulingRequest | null {
  if (!state.availabilityPreference) {
    if (state.requestedDate) {
      return {
        timezone,
        requestedDate: state.requestedDate,
        availabilityPreference: "full_day",
        businessHours,
        meetingDurationMinutes,
      };
    }
    return null;
  }

  if (
    state.availabilityPreference !== "earliest" &&
    !state.requestedDate
  ) {
    return null;
  }

  return {
    timezone,
    requestedDate: state.requestedDate,
    availabilityPreference: state.availabilityPreference,
    exactTimeMinutes: state.exactTimeMinutes,
    businessHours,
    meetingDurationMinutes,
  };
}
