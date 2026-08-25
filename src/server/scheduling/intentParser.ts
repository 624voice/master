import { parseFlexibleTimeToken } from "~/server/speed2Lead/schedulingContext";
import {
  nextWeekdayCentral,
  tomorrowCentralDate,
} from "~/server/speed2Lead/schedulingRange";
import type { AvailabilityPreference, CanonicalSchedulingState } from "~/server/scheduling/types";
import type { LegacyConstraintFields } from "~/server/scheduling/state";

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
  /\b(morning|before\s+noon|afternoon|after\s+lunch|evenings?)\b/i;

const DATE_ONLY_RE =
  /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i;

const TIME_TOKEN_RE =
  /\b(?:around|at|about|how\s+about|let'?s\s+do|lets?\s+do|take|book|do)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b|\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i;

const EVENING_PREFERENCE_RE =
  /\bevenings?\b(?:\s+(?:work|works|better|best|prefer|preferred|only|is\s+best))|\b(?:prefer|better|best|only)\s+(?:in\s+)?(?:the\s+)?evenings?\b/i;

export type IntentPatch = {
  requestedDate?: string;
  availabilityPreference?: AvailabilityPreference;
  exactTimeMinutes?: number;
  lowerTimeBound?: number;
  upperTimeBound?: number;
  anchorTime?: number;
};

const LATE_MORNING_RE = /\b(late morning|late-morning)\b/i;
const LATE_AFTERNOON_RE = /\b(late afternoon|late-afternoon|end of day)\b/i;
const NOONISH_RE = /\b(noon(?:-ish)?|around noon|about noon)\b/i;
const BETWEEN_TIMES_RE =
  /\bbetween\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\s+and\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b/i;
const AFTER_TIME_RE = /\bafter\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b/i;
const BEFORE_TIME_RE = /\bbefore\s+(?:noon|(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4}))\b/i;
const AROUND_TIME_RE = /\b(?:around|about)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4}|noon)\b/i;

function resolveDateFromMessage(message: string, now: Date): string | undefined {
  const lower = message.toLowerCase();
  if (/\btomorrow\b/.test(lower)) {
    return tomorrowCentralDate(now);
  }
  for (const weekday of WEEKDAY_NAMES) {
    if (new RegExp(`\\b(?:what about|how about|instead|switch to|actually)?\\s*(?:next\\s+)?${weekday}\\b`).test(lower)) {
      return nextWeekdayCentral(weekday, now);
    }
  }
  return undefined;
}

function hasExplicitDaypart(message: string): boolean {
  return EXPLICIT_DAYPART_RE.test(message.toLowerCase());
}

function inferDaypartFromAnchorMinutes(minutes: number): AvailabilityPreference {
  if (minutes < 12 * 60) return "morning";
  if (minutes < 17 * 60) return "afternoon";
  return "evening";
}

function extractExactTimeMinutes(message: string): number | null {
  if (/\blet'?s\s+do\b/i.test(message) && !/\b(at|around|about)\b/i.test(message)) {
    return null;
  }
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
    if (
      prior?.requestedDate === resolvedDate &&
      !hasExplicitDaypart(message) &&
      !FLEXIBLE_RE.test(lower) &&
      !TIME_TOKEN_RE.test(lower)
    ) {
      const priorPref =
        prior?.availabilityPreference ??
        (prior?.partOfDay === "morning"
          ? "morning"
          : prior?.partOfDay === "afternoon"
            ? "afternoon"
            : prior?.partOfDay === "evening"
              ? "evening"
              : undefined);
      if (priorPref && priorPref !== "full_day" && priorPref !== "earliest") {
        patch.availabilityPreference = "full_day";
      }
    }
  }

  const rejectsAfternoon =
    /\b(?:no|not)\s+afternoons?\b/i.test(lower) ||
    /\bafternoons?\s+(?:don|doesn)'?t\b/i.test(lower);
  const rejectsMorning =
    /\b(?:no|not)\s+mornings?\b/i.test(lower) ||
    /\bmornings?\s+(?:don|doesn)'?t\b/i.test(lower);

  if (!rejectsMorning && /\b(morning|before\s+noon)\b/.test(lower)) {
    patch.availabilityPreference = "morning";
  } else if (!rejectsAfternoon && /\b(after\s+lunch|afternoon)\b/.test(lower) && !EVENING_PREFERENCE_RE.test(lower)) {
    patch.availabilityPreference = "afternoon";
  } else if (EVENING_PREFERENCE_RE.test(lower) || /\bevenings?\b/.test(lower)) {
    patch.availabilityPreference = "evening";
  }

  if (LATE_MORNING_RE.test(lower)) {
    patch.availabilityPreference = "morning";
    patch.lowerTimeBound = 10 * 60;
    patch.upperTimeBound = 12 * 60;
  } else if (LATE_AFTERNOON_RE.test(lower)) {
    patch.availabilityPreference = "afternoon";
    patch.lowerTimeBound = 14 * 60;
    patch.upperTimeBound = 17 * 60;
  }

  const betweenMatch = lower.match(BETWEEN_TIMES_RE);
  if (betweenMatch) {
    const lowerBound = parseFlexibleTimeToken((betweenMatch[1] ?? "").replace(/\s+/g, ""));
    const upperBound = parseFlexibleTimeToken((betweenMatch[2] ?? "").replace(/\s+/g, ""));
    if (lowerBound != null && upperBound != null) {
      patch.lowerTimeBound = lowerBound;
      patch.upperTimeBound = upperBound;
    }
  }

  const afterMatch = lower.match(AFTER_TIME_RE);
  if (afterMatch && !betweenMatch) {
    const minutes = parseFlexibleTimeToken((afterMatch[1] ?? "").replace(/\s+/g, ""));
    if (minutes != null) patch.lowerTimeBound = minutes;
  }

  const beforeMatch = lower.match(BEFORE_TIME_RE);
  if (beforeMatch && !betweenMatch) {
    if ((beforeMatch[1] ?? "").toLowerCase() === "noon" || /\bbefore\s+noon\b/i.test(lower)) {
      patch.upperTimeBound = 12 * 60;
      patch.availabilityPreference = patch.availabilityPreference ?? "morning";
    } else {
      const minutes = parseFlexibleTimeToken((beforeMatch[1] ?? "").replace(/\s+/g, ""));
      if (minutes != null) patch.upperTimeBound = minutes;
    }
  }

  const aroundMatch = lower.match(AROUND_TIME_RE);
  if (aroundMatch) {
    const raw = (aroundMatch[1] ?? "").replace(/\s+/g, "");
    const minutes = raw === "noon" ? 12 * 60 : parseFlexibleTimeToken(raw);
    if (minutes != null) {
      patch.anchorTime = minutes;
      if (!patch.availabilityPreference || patch.availabilityPreference === "full_day") {
        patch.availabilityPreference = inferDaypartFromAnchorMinutes(minutes);
      }
      if (NOONISH_RE.test(lower)) {
        patch.availabilityPreference = patch.availabilityPreference ?? "full_day";
      }
    }
  } else if (NOONISH_RE.test(lower)) {
    patch.anchorTime = 12 * 60;
  }

  const exactMinutes = extractExactTimeMinutes(message);
  const dateForExact = patch.requestedDate ?? prior?.requestedDate;
  const isAroundIntent = Boolean(aroundMatch) || /\b(around|about)\b/i.test(lower);
  if (exactMinutes != null && dateForExact && !patch.anchorTime && !isAroundIntent) {
    patch.availabilityPreference = "exact_time";
    patch.exactTimeMinutes = exactMinutes;
    patch.requestedDate = dateForExact;
  }

  return patch;
}

function preferenceToLegacyPart(part?: AvailabilityPreference): LegacyConstraintFields["partOfDay"] {
  switch (part) {
    case "morning":
      return "morning";
    case "afternoon":
      return "afternoon";
    case "evening":
      return "evening";
    case "full_day":
    case "earliest":
      return "full_day";
    default:
      return undefined;
  }
}

export function mergeIntentIntoState(
  prior: CanonicalSchedulingState & LegacyConstraintFields,
  patch: IntentPatch,
): CanonicalSchedulingState & LegacyConstraintFields {
  const availabilityPreference = patch.availabilityPreference ?? prior.availabilityPreference;
  const partOfDay =
    patch.availabilityPreference != null
      ? preferenceToLegacyPart(patch.availabilityPreference)
      : prior.partOfDay;

  return {
    ...prior,
    requestedDate: patch.requestedDate ?? prior.requestedDate,
    availabilityPreference,
    exactTimeMinutes:
      patch.availabilityPreference === "exact_time"
        ? patch.exactTimeMinutes ?? prior.exactTimeMinutes
        : patch.exactTimeMinutes ?? prior.exactTimeMinutes,
    partOfDay,
    searchAfterMinutes: patch.lowerTimeBound ?? prior.searchAfterMinutes,
    searchBeforeMinutes: patch.upperTimeBound ?? prior.searchBeforeMinutes,
    earliestAllowedMinutes: patch.lowerTimeBound ?? prior.earliestAllowedMinutes,
    latestAllowedMinutes: patch.upperTimeBound ?? prior.latestAllowedMinutes,
    anchorTimeMinutes: patch.anchorTime ?? prior.anchorTimeMinutes,
  };
}

export function buildSchedulingRequestFromState(
  state: CanonicalSchedulingState & LegacyConstraintFields,
  timezone: string,
  businessHours: import("~/server/appointmentLifecycle/consultationConfig").ConsultationBusinessHours,
  meetingDurationMinutes: number,
): import("~/server/scheduling/types").SchedulingRequest | null {
  if (!state.availabilityPreference) {
    return null;
  }

  if (state.availabilityPreference !== "earliest" && !state.requestedDate) {
    return null;
  }

  return {
    timezone,
    requestedDate: state.requestedDate,
    availabilityPreference: state.availabilityPreference,
    exactTimeMinutes: state.exactTimeMinutes,
    lowerTimeBound: state.searchAfterMinutes ?? state.earliestAllowedMinutes,
    upperTimeBound: state.searchBeforeMinutes ?? state.latestAllowedMinutes,
    anchorTime: state.anchorTimeMinutes,
    businessHours,
    meetingDurationMinutes,
  };
}
