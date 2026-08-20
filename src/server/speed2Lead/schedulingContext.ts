import { parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  earliestOfferedMinutes,
  latestOfferedMinutes,
  parseClockToMinutes,
  slotStartMinutes,
} from "~/server/speed2Lead/slotRanking";
import {
  inferAvailabilityInputFromMessage,
  inferPartOfDay,
  nextWeekdayCentral,
  type AvailabilityRangeInput,
} from "~/server/speed2Lead/schedulingRange";
import type {
  SchedulingPartOfDay,
  SchedulingState,
} from "~/server/speed2Lead/sessionMemoryTypes";

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const REJECT_MORNING_RE =
  /\b(morning(?:s)?\s+(?:doesn'?t|dont|won'?t|wont|do not|does not)\s+work|no mornings?|not mornings?|can'?t do mornings?|cant do mornings?|mornings?\s+(?:are\s+)?(?:out|off the table))\b/i;

const REJECT_AFTERNOON_RE =
  /\b(afternoon(?:s)?\s+(?:doesn'?t|dont|won'?t|wont|do not|does not)\s+work|no afternoons?|not afternoons?|can'?t do afternoons?)\b/i;

const REJECT_EVENING_RE =
  /\b(evening(?:s)?\s+(?:doesn'?t|dont|won'?t|wont|do not|does not)\s+work|no evenings?|not evenings?)\b/i;

const REJECT_OFFERED_RE =
  /\b(none of those|not those|any(?:thing)? else|something else|different times?|other options?|doesn'?t work|dont work|won'?t work|wont work|too early|too late)\b/i;

const PREFER_AFTERNOON_RE =
  /\b(need afternoon|want afternoon|what about afternoon|afternoons?|after lunch|after noon)\b/i;

const PREFER_MORNING_RE = /\b(what about morning|mornings?|before noon)\b/i;

const PREFER_EVENING_RE =
  /\b(evenings?|after work|after 5|after five|late afternoon|end of day)\b/i;

const BARE_TIME_PREFERENCE_RE =
  /\b(?:like|around|about|at|maybe|probably|roughly|say)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b/i;

const REPETITION_CORRECTION_RE =
  /\b(you already asked|already told you|i already said|like i just said|you keep asking|same question again|asked me that)\b/i;

const REFINEMENT_LATER_RE =
  /\b(later|too early|after those|anything later|something later|need something later|anything after|move later|push it later)\b/i;

const REFINEMENT_EARLIER_RE =
  /\b(earlier|too late|before those|anything earlier|something earlier|move earlier)\b/i;

const PART_OF_DAY_SWITCH_RE =
  /\b(morning instead|afternoon instead|evening instead|what about morning|what about afternoon)\b/i;

const ANCHOR_TIME_RE =
  /\b(?:around|about|closer to|near|after|before)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b/i;

const AFTER_BEFORE_TIME_RE =
  /\b(after|before)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b/i;

export type SchedulingConstraintPatch = Partial<
  Pick<
    import("~/server/speed2Lead/sessionMemoryTypes").SchedulingState,
    | "rejectedPartOfDay"
    | "partOfDay"
    | "anchorTimeMinutes"
    | "searchAfterMinutes"
    | "searchBeforeMinutes"
    | "earliestAllowedMinutes"
    | "latestAllowedMinutes"
    | "rejectedSlotStarts"
    | "centralDate"
  >
>;

export function detectSchedulingConstraints(
  message: string,
  scheduling: SchedulingState | undefined,
  offeredSlots: string[] = [],
): SchedulingConstraintPatch {
  const patch: SchedulingConstraintPatch = {};
  const lower = message.toLowerCase();
  const rejected = new Set(scheduling?.rejectedPartOfDay ?? []);

  if (REJECT_MORNING_RE.test(lower)) {
    rejected.add("morning");
    patch.partOfDay = "afternoon";
    patch.earliestAllowedMinutes = Math.max(scheduling?.earliestAllowedMinutes ?? 0, 12 * 60);
    patch.searchAfterMinutes = Math.max(scheduling?.searchAfterMinutes ?? 0, 12 * 60 - 1);
  }

  if (REJECT_AFTERNOON_RE.test(lower)) {
    rejected.add("afternoon");
    patch.partOfDay = "evening";
    patch.latestAllowedMinutes = Math.min(scheduling?.latestAllowedMinutes ?? 24 * 60, 12 * 60);
  }

  if (REJECT_EVENING_RE.test(lower)) {
    rejected.add("evening");
    patch.partOfDay = "afternoon";
  }

  if (PREFER_AFTERNOON_RE.test(lower) && !rejected.has("afternoon")) {
    patch.partOfDay = "afternoon";
    patch.earliestAllowedMinutes = Math.max(scheduling?.earliestAllowedMinutes ?? 0, 12 * 60);
  }

  if (PREFER_MORNING_RE.test(lower) && !rejected.has("morning")) {
    patch.partOfDay = "morning";
    patch.latestAllowedMinutes = Math.min(scheduling?.latestAllowedMinutes ?? 24 * 60, 12 * 60);
  }

  if (PREFER_EVENING_RE.test(lower) && !rejected.has("evening")) {
    patch.partOfDay = "evening";
    patch.earliestAllowedMinutes = Math.max(scheduling?.earliestAllowedMinutes ?? 0, 16 * 60);
  }

  if (REFINEMENT_LATER_RE.test(lower)) {
    const latest = latestOfferedMinutes(offeredSlots) ?? scheduling?.lastOfferedLatestMinutes;
    if (latest != null) {
      patch.searchAfterMinutes = latest;
      patch.earliestAllowedMinutes = Math.max(scheduling?.earliestAllowedMinutes ?? 0, latest + 1);
    }
  }

  if (REFINEMENT_EARLIER_RE.test(lower)) {
    const earliest = earliestOfferedMinutes(offeredSlots) ?? scheduling?.lastOfferedEarliestMinutes;
    if (earliest != null) {
      patch.searchBeforeMinutes = earliest;
      patch.latestAllowedMinutes = Math.min(scheduling?.latestAllowedMinutes ?? 24 * 60, earliest - 1);
    }
  }

  const anchor = extractAnchorMinutes(message) ?? extractRequestedTimeMinutes(message);
  if (anchor != null) {
    patch.anchorTimeMinutes = anchor;
    if (/\bafter\b/i.test(lower)) {
      patch.searchAfterMinutes = Math.max(scheduling?.searchAfterMinutes ?? 0, anchor);
      patch.earliestAllowedMinutes = Math.max(scheduling?.earliestAllowedMinutes ?? 0, anchor);
    } else if (/\bbefore\b/i.test(lower)) {
      patch.searchBeforeMinutes = anchor;
      patch.latestAllowedMinutes = Math.min(scheduling?.latestAllowedMinutes ?? 24 * 60, anchor);
    } else if (/\b(around|about|like|at|closer|near|roughly|probably)\b/i.test(lower) || BARE_TIME_PREFERENCE_RE.test(lower)) {
      const part =
        anchor < 12 * 60 ? "morning" : anchor < 17 * 60 ? "afternoon" : "evening";
      if (!rejected.has(part)) {
        patch.partOfDay = part;
      }
    }
  }

  if (REJECT_OFFERED_RE.test(lower) && offeredSlots.length > 0) {
    patch.rejectedSlotStarts = [
      ...(scheduling?.rejectedSlotStarts ?? []),
      ...offeredSlots,
    ];
  }

  if (rejected.size > 0) {
    patch.rejectedPartOfDay = [...rejected];
  }

  return patch;
}

export type SchedulingRefinement = {
  input: AvailabilityRangeInput;
  rankPreferences: {
    searchAfterMinutes?: number;
    searchBeforeMinutes?: number;
    anchorMinutes?: number;
    narrowAroundAnchor?: boolean;
  };
  reason: string;
};

export function detectRepetitionCorrection(message: string): boolean {
  return REPETITION_CORRECTION_RE.test(message);
}

export function hasKnownSchedulingDay(scheduling?: SchedulingState): boolean {
  return Boolean(scheduling?.centralDate);
}

export function hasKnownSchedulingPartOfDay(scheduling?: SchedulingState): boolean {
  return Boolean(scheduling?.partOfDay && scheduling.partOfDay !== "full_day");
}

export function mergeSchedulingIntentFromMessage(
  scheduling: SchedulingState | undefined,
  message: string,
  now = new Date(),
): Partial<SchedulingState> {
  const patch: Partial<SchedulingState> = {};
  const lower = message.toLowerCase();

  for (const weekday of WEEKDAY_NAMES) {
    if (new RegExp(`\\b(?:next\\s+)?${weekday}\\b`).test(lower)) {
      patch.centralDate = nextWeekdayCentral(weekday, now);
      break;
    }
  }

  if (/\btomorrow\b/.test(lower)) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const parts = parseCentralParts(tomorrow, CONSULTATION_TIMEZONE);
    patch.centralDate = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  }

  const part = inferPartOfDay(lower);
  if (part !== "full_day") {
    patch.partOfDay = part;
  } else if (/\b(morning|afternoon|evening)\b/.test(lower)) {
    patch.partOfDay = inferPartOfDay(lower);
  }

  const anchor = extractAnchorMinutes(message);
  if (anchor != null) {
    patch.anchorTimeMinutes = anchor;
  }

  return patch;
}

function messageChangesDay(message: string): boolean {
  const lower = message.toLowerCase();
  if (/\btomorrow\b/.test(lower)) return true;
  if (/\bactually\b/.test(lower)) return true;
  for (const weekday of WEEKDAY_NAMES) {
    if (new RegExp(`\\b${weekday}\\b`).test(lower)) return true;
  }
  return false;
}

function messageChangesPartOfDay(message: string): boolean {
  const lower = message.toLowerCase();
  if (REJECT_MORNING_RE.test(lower) || REJECT_AFTERNOON_RE.test(lower) || REJECT_EVENING_RE.test(lower)) {
    return true;
  }
  if (PREFER_AFTERNOON_RE.test(lower) || PREFER_MORNING_RE.test(lower) || PREFER_EVENING_RE.test(lower)) {
    return true;
  }
  if (PART_OF_DAY_SWITCH_RE.test(lower)) return true;
  if (/\b(morning instead|afternoon instead|evening instead)\b/.test(lower)) return true;
  return false;
}

function explicitPartOfDayFromMessage(message: string): SchedulingPartOfDay | null {
  const lower = message.toLowerCase();
  if (/\b(morning|before noon)\b/.test(lower) && !REJECT_MORNING_RE.test(lower)) return "morning";
  if (/\b(after lunch|afternoon)\b/.test(lower) && !REJECT_AFTERNOON_RE.test(lower)) return "afternoon";
  if (/\b(evening|after work)\b/.test(lower) && !REJECT_EVENING_RE.test(lower)) return "evening";
  return null;
}

export function buildAvailabilityInputFromSchedulingState(
  scheduling: SchedulingState | undefined,
  message: string,
  now = new Date(),
): AvailabilityRangeInput | null {
  const inferred = inferAvailabilityInputFromMessage(message, now);
  const mergedDate = messageChangesDay(message)
    ? (inferred?.centralDate ?? scheduling?.centralDate)
    : (scheduling?.centralDate ?? inferred?.centralDate);

  const explicitPart = explicitPartOfDayFromMessage(message);
  const mergedPart = messageChangesPartOfDay(message)
    ? (explicitPart ?? inferred?.partOfDay ?? scheduling?.partOfDay ?? "full_day")
    : (scheduling?.partOfDay ?? explicitPart ?? inferred?.partOfDay);

  if (mergedDate) {
    return {
      centralDate: mergedDate,
      partOfDay: mergedPart ?? "full_day",
      rangeStart: inferred?.rangeStart,
      rangeEnd: inferred?.rangeEnd,
    };
  }

  if (inferred?.rangeStart && inferred.rangeEnd) {
    return inferred;
  }

  return null;
}

function extractAnchorMinutes(message: string): number | null {
  const anchorMatch = message.match(ANCHOR_TIME_RE) ?? message.match(AFTER_BEFORE_TIME_RE);
  if (!anchorMatch) return null;
  return parseFlexibleTimeToken(anchorMatch[1] ?? anchorMatch[2] ?? "");
}

export function parseFlexibleTimeToken(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, "");
  const compact = trimmed.match(/^(\d{3,4})$/);
  if (compact) {
    const digits = compact[1]!.padStart(4, "0");
    const hour = Number.parseInt(digits.slice(0, 2), 10);
    const minute = Number.parseInt(digits.slice(2), 10);
    if (hour < 24 && minute < 60) {
      return hour * 60 + minute;
    }
  }

  const spaced = trimmed.match(/^(\d{1,2})\s*(\d{2})$/);
  if (spaced) {
    const hour = Number.parseInt(spaced[1] ?? "0", 10);
    const minute = Number.parseInt(spaced[2] ?? "0", 10);
    if (hour < 24 && minute < 60) {
      return hour * 60 + minute;
    }
  }

  return parseClockToMinutes(trimmed);
}

export function extractRequestedTimeMinutes(message: string): number | null {
  const compact = message.match(/\b(\d{3,4})\b/);
  if (compact) {
    const parsed = parseFlexibleTimeToken(compact[1] ?? "");
    if (parsed != null) return parsed;
  }

  const spaced = message.match(/\b(\d{1,2})\s+(\d{2})\b/);
  if (spaced) {
    const parsed = parseFlexibleTimeToken(`${spaced[1]}${spaced[2]}`);
    if (parsed != null) return parsed;
  }

  const clock = message.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
  if (clock) {
    return parseFlexibleTimeToken(clock[1] ?? "");
  }

  return null;
}

export function detectSchedulingRefinement(
  message: string,
  scheduling: SchedulingState | undefined,
  offeredSlots: string[],
  now = new Date(),
): SchedulingRefinement | null {
  const lower = message.toLowerCase();
  const baseInput = buildAvailabilityInputFromSchedulingState(scheduling, message, now);
  if (!baseInput?.centralDate && !baseInput?.rangeStart) {
    return null;
  }

  if (REFINEMENT_LATER_RE.test(lower)) {
    const latest = latestOfferedMinutes(offeredSlots) ?? scheduling?.searchAfterMinutes;
    return {
      input: baseInput,
      rankPreferences: {
        searchAfterMinutes: latest ?? undefined,
      },
      reason: "refine_later",
    };
  }

  if (REFINEMENT_EARLIER_RE.test(lower)) {
    const earliest = earliestOfferedMinutes(offeredSlots) ?? scheduling?.searchBeforeMinutes;
    return {
      input: baseInput,
      rankPreferences: {
        searchBeforeMinutes: earliest ?? undefined,
      },
      reason: "refine_earlier",
    };
  }

  if (PART_OF_DAY_SWITCH_RE.test(lower)) {
    const partOfDay: SchedulingPartOfDay = /\bmorning\b/.test(lower)
      ? "morning"
      : /\bevening\b/.test(lower)
        ? "evening"
        : "afternoon";
    return {
      input: { ...baseInput, partOfDay },
      rankPreferences: {},
      reason: "refine_part_of_day",
    };
  }

  for (const weekday of WEEKDAY_NAMES) {
    if (new RegExp(`\\b(?:what about|how about|instead|switch to)?\\s*(?:next\\s+)?${weekday}\\b`).test(lower)) {
      return {
        input: {
          centralDate: nextWeekdayCentral(weekday, now),
          partOfDay: scheduling?.partOfDay ?? inferPartOfDay(lower),
        },
        rankPreferences: {
          anchorMinutes: scheduling?.anchorTimeMinutes,
          narrowAroundAnchor: scheduling?.anchorTimeMinutes != null,
        },
        reason: "refine_change_day",
      };
    }
  }

  const bareTime = extractRequestedTimeMinutes(message);
  if (
    bareTime != null &&
    offeredSlots.length > 0 &&
    !/\b(works|good|perfect|book|take|yes|yeah|yep|that one|this one|the (?:first|second|third|last))\b/i.test(lower)
  ) {
    return {
      input: baseInput,
      rankPreferences: {
        anchorMinutes: bareTime,
        narrowAroundAnchor: true,
      },
      reason: "refine_anchor_time",
    };
  }

  const anchor = extractAnchorMinutes(message);
  if (anchor != null && /\b(around|about|closer|near|after|before)\b/i.test(lower)) {
    const rankPreferences: SchedulingRefinement["rankPreferences"] = {
      anchorMinutes: anchor,
      narrowAroundAnchor: /\b(around|about|closer|near)\b/i.test(lower),
    };
    if (/\bafter\b/i.test(lower)) {
      rankPreferences.searchAfterMinutes = anchor;
    }
    if (/\bbefore\b/i.test(lower)) {
      rankPreferences.searchBeforeMinutes = anchor;
    }
    return {
      input: baseInput,
      rankPreferences,
      reason: "refine_anchor_time",
    };
  }

  return null;
}

export function buildSlotRankPreferencesFromState(
  scheduling: SchedulingState | undefined,
  rangeInput: AvailabilityRangeInput,
): {
  partOfDay?: SchedulingPartOfDay;
  anchorMinutes?: number;
  searchAfterMinutes?: number;
  searchBeforeMinutes?: number;
  narrowAroundAnchor?: boolean;
  rejectedPartOfDay?: SchedulingPartOfDay[];
  earliestAllowedMinutes?: number;
  latestAllowedMinutes?: number;
  rejectedSlotStarts?: string[];
} {
  const narrowAroundAnchor =
    scheduling?.anchorTimeMinutes != null &&
    (rangeInput.partOfDay === scheduling.partOfDay || scheduling.partOfDay === "full_day");

  return {
    partOfDay: rangeInput.partOfDay ?? scheduling?.partOfDay,
    anchorMinutes: scheduling?.anchorTimeMinutes,
    searchAfterMinutes: scheduling?.searchAfterMinutes ?? scheduling?.earliestAllowedMinutes,
    searchBeforeMinutes: scheduling?.searchBeforeMinutes ?? scheduling?.latestAllowedMinutes,
    narrowAroundAnchor,
    rejectedPartOfDay: scheduling?.rejectedPartOfDay,
    earliestAllowedMinutes: scheduling?.earliestAllowedMinutes,
    latestAllowedMinutes: scheduling?.latestAllowedMinutes,
    rejectedSlotStarts: scheduling?.rejectedSlotStarts,
  };
}

export function summarizeOfferedRange(offeredSlots: string[]): {
  earliestMinutes: number | null;
  latestMinutes: number | null;
} {
  return {
    earliestMinutes: earliestOfferedMinutes(offeredSlots),
    latestMinutes: latestOfferedMinutes(offeredSlots),
  };
}

export function slotMatchesMinutes(iso: string, minutes: number, tolerance = 0): boolean {
  const slotMinutes = slotStartMinutes(iso);
  if (slotMinutes === null) return false;
  return Math.abs(slotMinutes - minutes) <= tolerance;
}
