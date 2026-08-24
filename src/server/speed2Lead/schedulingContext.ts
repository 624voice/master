import { parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import {
  earliestOfferedMinutes,
  latestOfferedMinutes,
  parseClockToMinutes,
  rankSlotsForOffer,
  slotStartMinutes,
} from "~/server/speed2Lead/slotRanking";
import {
  detectSemanticDaypartSelection,
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

/** Genuine daypart rejection — excludes bare "no afternoon" correction phrases. */
const DAYPART_WONT_WORK_RE = "(?:(?:don|doesn)'?t|dont|won'?t|wont|do not|does not)\\s+work(?:\\s+for\\s+me)?";

const REJECT_MORNING_RE = new RegExp(
  `\\b(morning(?:s)?\\s+${DAYPART_WONT_WORK_RE}|(?:no|not)\\s+mornings?\\s+(?:work|for me|available)|can'?t do mornings?|cant do mornings?|mornings?\\s+(?:are\\s+)?(?:out|off the table))\\b`,
  "i",
);

const REJECT_AFTERNOON_RE = new RegExp(
  `\\b(afternoon(?:s)?\\s+${DAYPART_WONT_WORK_RE}|(?:no|not)\\s+afternoons?\\s+(?:work|for me|available)|can'?t do afternoons?|cant do afternoons?|afternoons?\\s+(?:are\\s+)?(?:out|off the table))\\b`,
  "i",
);

const REJECT_EVENING_RE = new RegExp(
  `\\b(evening(?:s)?\\s+${DAYPART_WONT_WORK_RE}|(?:no|not)\\s+evenings?\\s+(?:work|for me|available)|can'?t do evenings?|evenings?\\s+(?:are\\s+)?(?:out|off the table))\\b`,
  "i",
);

const DAYPART_CORRECTION_RE =
  /\b(actually|i\s+meant|meant|instead|rather)\b/i;

const REJECT_OFFERED_RE =
  /\b(none of those|not those|any(?:thing)? else|something else|different times?|other options?|doesn'?t work|dont work|won'?t work|wont work|too early|too late)\b/i;

const PREFER_AFTERNOON_RE =
  /\b(need afternoon|want afternoon|what about afternoon|(?:i\s+)?said afternoon|afternoons?|after lunch|after noon)\b/i;

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

function dominantPartOfDayFromSlots(slots: string[]): SchedulingPartOfDay | null {
  if (slots.length === 0) return null;
  const parts = slots
    .map((slot) => slotStartMinutes(slot))
    .filter((value): value is number => value !== null)
    .map((minutes) => (minutes < 12 * 60 ? "morning" : minutes < 17 * 60 ? "afternoon" : "evening"));
  if (parts.length === 0) return null;
  const morning = parts.filter((part) => part === "morning").length;
  const afternoon = parts.filter((part) => part === "afternoon").length;
  const evening = parts.filter((part) => part === "evening").length;
  if (afternoon >= morning && afternoon >= evening) return "afternoon";
  if (morning >= afternoon && morning >= evening) return "morning";
  return "evening";
}

/** Conversational daypart correction/selection — not rejection. */
export function detectDaypartSelectionCorrection(
  message: string,
  scheduling?: SchedulingState,
): SchedulingPartOfDay | null {
  const lower = message.toLowerCase().trim();
  const offered = scheduling?.offeredSlots ?? [];

  const insteadMatch = lower.match(/\b(morning|afternoon|evening)\s+instead\b/);
  if (insteadMatch?.[1]) {
    return insteadMatch[1] as SchedulingPartOfDay;
  }

  const explicitPart = explicitPartOfDayFromMessage(message) ?? detectSemanticDaypartSelection(message);
  if (!explicitPart) {
    return null;
  }

  if (
    REJECT_MORNING_RE.test(lower) ||
    REJECT_AFTERNOON_RE.test(lower) ||
    REJECT_EVENING_RE.test(lower)
  ) {
    return null;
  }

  if (scheduling?.centralDate && !hasKnownSchedulingPartOfDay(scheduling)) {
    return explicitPart;
  }

  if (DAYPART_CORRECTION_RE.test(lower)) {
    return explicitPart;
  }

  if (/^\s*no\b[,\s]+/i.test(lower)) {
    return explicitPart;
  }

  if (/\bno\s+(?:,?\s*)?(morning|afternoon|evening)\b/i.test(lower)) {
    return explicitPart;
  }

  if (PART_OF_DAY_SWITCH_RE.test(lower)) {
    return explicitPart;
  }

  const dominantOffered = dominantPartOfDayFromSlots(offered);
  if (dominantOffered && dominantOffered !== explicitPart) {
    return explicitPart;
  }

  return null;
}

export function normalizeSchedulingStateConstraints(
  scheduling: SchedulingState,
  options: { prior?: SchedulingState } = {},
): SchedulingState {
  const prior = options.prior;
  const normalized: SchedulingState = { ...scheduling };

  if (
    prior?.centralDate &&
    normalized.centralDate &&
    prior.centralDate !== normalized.centralDate
  ) {
    normalized.rejectedSlotStarts = undefined;
    normalized.searchAfterMinutes = undefined;
    normalized.searchBeforeMinutes = undefined;
    normalized.lastOfferedSlotKey = undefined;
    normalized.lastOfferedEarliestMinutes = undefined;
    normalized.lastOfferedLatestMinutes = undefined;
    normalized.offeredSlots = undefined;
    normalized.status = normalized.status === "slots_offered" ? "idle" : normalized.status;
  }

  if (
    prior?.partOfDay &&
    normalized.partOfDay &&
    prior.partOfDay !== normalized.partOfDay &&
    normalized.partOfDay !== "full_day"
  ) {
    normalized.rejectedSlotStarts = undefined;
    normalized.searchAfterMinutes = undefined;
    normalized.searchBeforeMinutes = undefined;
    normalized.offeredSlots = undefined;
    normalized.status = normalized.status === "slots_offered" ? "idle" : normalized.status;
  }

  if (normalized.partOfDay && normalized.partOfDay !== "full_day") {
    const filtered = (normalized.rejectedPartOfDay ?? []).filter(
      (part) => part !== normalized.partOfDay,
    );
    normalized.rejectedPartOfDay = filtered.length > 0 ? filtered : undefined;
  }

  if (normalized.rejectedPartOfDay?.length === 0) {
    normalized.rejectedPartOfDay = undefined;
  }

  return normalized;
}

export function messageHasResolvedDayWithoutPartOfDay(
  message: string,
  scheduling: SchedulingState | undefined,
  preferenceInput: AvailabilityRangeInput | null | undefined,
  now = new Date(),
): boolean {
  const merged =
    buildAvailabilityInputFromSchedulingState(scheduling, message, now) ?? preferenceInput;
  if (!merged?.centralDate) {
    return false;
  }
  const part = merged.partOfDay;
  if (part && part !== "full_day") {
    return false;
  }
  if (resolveRequestedMinutesFromMessage(message, scheduling?.offeredSlots ?? []) !== null) {
    return false;
  }
  if (extractAnchorMinutes(message) !== null) {
    return false;
  }
  return true;
}

export function detectSchedulingConstraints(
  message: string,
  scheduling: SchedulingState | undefined,
  offeredSlots: string[] = [],
): SchedulingConstraintPatch {
  const patch: SchedulingConstraintPatch = {};
  const lower = message.toLowerCase();
  const rejected = new Set(scheduling?.rejectedPartOfDay ?? []);

  const daypartCorrection = detectDaypartSelectionCorrection(message, {
    ...scheduling,
    offeredSlots: offeredSlots.length > 0 ? offeredSlots : scheduling?.offeredSlots,
  });
  if (daypartCorrection) {
    rejected.delete(daypartCorrection);
    patch.partOfDay = daypartCorrection;
    if (daypartCorrection === "afternoon") {
      patch.earliestAllowedMinutes = Math.max(scheduling?.earliestAllowedMinutes ?? 0, 12 * 60);
    } else if (daypartCorrection === "morning") {
      patch.latestAllowedMinutes = Math.min(scheduling?.latestAllowedMinutes ?? 24 * 60, 12 * 60);
    } else if (daypartCorrection === "evening") {
      patch.earliestAllowedMinutes = Math.max(scheduling?.earliestAllowedMinutes ?? 0, 16 * 60);
    }
  }

  if (!daypartCorrection && REJECT_MORNING_RE.test(lower)) {
    rejected.add("morning");
    patch.partOfDay = "afternoon";
    patch.earliestAllowedMinutes = Math.max(scheduling?.earliestAllowedMinutes ?? 0, 12 * 60);
    patch.searchAfterMinutes = Math.max(scheduling?.searchAfterMinutes ?? 0, 12 * 60 - 1);
  }

  if (!daypartCorrection && REJECT_AFTERNOON_RE.test(lower)) {
    rejected.add("afternoon");
    patch.partOfDay = "evening";
    patch.latestAllowedMinutes = Math.min(scheduling?.latestAllowedMinutes ?? 24 * 60, 12 * 60);
  }

  if (!daypartCorrection && REJECT_EVENING_RE.test(lower)) {
    rejected.add("evening");
    patch.partOfDay = "afternoon";
  }

  if (
    !daypartCorrection &&
    !patch.partOfDay &&
    PREFER_AFTERNOON_RE.test(lower) &&
    !rejected.has("afternoon")
  ) {
    patch.partOfDay = "afternoon";
    rejected.delete("afternoon");
    patch.earliestAllowedMinutes = Math.max(scheduling?.earliestAllowedMinutes ?? 0, 12 * 60);
  }

  if (!patch.partOfDay && PREFER_MORNING_RE.test(lower) && !rejected.has("morning")) {
    patch.partOfDay = "morning";
    rejected.delete("morning");
    patch.latestAllowedMinutes = Math.min(scheduling?.latestAllowedMinutes ?? 24 * 60, 12 * 60);
  }

  if (!patch.partOfDay && PREFER_EVENING_RE.test(lower) && !rejected.has("evening")) {
    patch.partOfDay = "evening";
    rejected.delete("evening");
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

  const anchor = extractAnchorMinutes(message) ?? extractRequestedTimeMinutes(message, offeredSlots);
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

  const merged = normalizeSchedulingStateConstraints(
    {
      ...scheduling,
      ...patch,
      rejectedPartOfDay: patch.rejectedPartOfDay ?? scheduling?.rejectedPartOfDay,
      partOfDay: patch.partOfDay ?? scheduling?.partOfDay,
      centralDate: patch.centralDate ?? scheduling?.centralDate,
    },
    { prior: scheduling },
  );

  return {
    ...patch,
    partOfDay: merged.partOfDay !== scheduling?.partOfDay ? merged.partOfDay : patch.partOfDay,
    rejectedPartOfDay: merged.rejectedPartOfDay,
    centralDate: merged.centralDate !== scheduling?.centralDate ? merged.centralDate : patch.centralDate,
    rejectedSlotStarts:
      merged.centralDate !== scheduling?.centralDate ? undefined : patch.rejectedSlotStarts,
    searchAfterMinutes:
      merged.centralDate !== scheduling?.centralDate ? undefined : patch.searchAfterMinutes,
    searchBeforeMinutes:
      merged.centralDate !== scheduling?.centralDate ? undefined : patch.searchBeforeMinutes,
  };
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
  if (detectSemanticDaypartSelection(message)) return true;
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
  return detectSemanticDaypartSelection(message);
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
  const anchorMatch =
    message.match(ANCHOR_TIME_RE) ??
    message.match(AFTER_BEFORE_TIME_RE) ??
    message.match(/\bat\s+(\d{1,2}(?::\d{2})?)\b/i);
  if (!anchorMatch) return null;
  return parseFlexibleTimeToken(anchorMatch[1] ?? anchorMatch[2] ?? "");
}

export function parseFlexibleTimeToken(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, "");
  const dotted = trimmed.match(/^(\d{1,2})\.(\d{2})(am|pm)?$/i);
  if (dotted) {
    const hour = Number.parseInt(dotted[1] ?? "0", 10);
    const minute = Number.parseInt(dotted[2] ?? "0", 10);
    if (hour < 24 && minute < 60) {
      return applyMeridiemToHour(hour, minute, dotted[3]?.toLowerCase() ?? null, null);
    }
  }

  const compact = trimmed.match(/^(\d{3,4})(am|pm)?$/i);
  if (compact) {
    const digits = compact[1]!.padStart(4, "0");
    const hour = Number.parseInt(digits.slice(0, 2), 10);
    const minute = Number.parseInt(digits.slice(2), 10);
    if (hour < 24 && minute < 60) {
      return applyMeridiemToHour(hour, minute, compact[2]?.toLowerCase() ?? null, null);
    }
  }

  const spaced = trimmed.match(/^(\d{1,2})\s*(\d{2})(am|pm)?$/i);
  if (spaced) {
    const hour = Number.parseInt(spaced[1] ?? "0", 10);
    const minute = Number.parseInt(spaced[2] ?? "0", 10);
    if (hour < 24 && minute < 60) {
      return applyMeridiemToHour(hour, minute, spaced[3]?.toLowerCase() ?? null, null);
    }
  }

  return parseClockToMinutes(trimmed);
}

export type OfferedMeridiemHint = "am" | "pm" | "mixed" | null;

export function inferMeridiemHintFromOfferedSlots(offeredSlots: string[]): OfferedMeridiemHint {
  if (offeredSlots.length === 0) return null;
  const minutes = offeredSlots
    .map((slot) => slotStartMinutes(slot))
    .filter((value): value is number => value !== null);
  if (minutes.length === 0) return null;

  const hasAm = minutes.some((value) => value < 12 * 60);
  const hasPm = minutes.some((value) => value >= 12 * 60);
  if (hasAm && hasPm) return "mixed";
  if (hasPm) return "pm";
  if (hasAm) return "am";
  return null;
}

function applyMeridiemToHour(
  hour: number,
  minute: number,
  explicitMeridiem: string | null,
  offeredHint: OfferedMeridiemHint,
): number {
  let meridiem = explicitMeridiem;
  if (!meridiem && offeredHint === "am") {
    meridiem = "am";
  } else if (!meridiem && offeredHint === "pm") {
    meridiem = "pm";
  } else if (!meridiem) {
    meridiem = hour >= 8 && hour <= 11 ? "am" : "pm";
  }

  let normalizedHour = hour;
  if (meridiem === "pm" && normalizedHour < 12) normalizedHour += 12;
  if (meridiem === "am" && normalizedHour === 12) normalizedHour = 0;
  if (normalizedHour >= 24 || minute >= 60) return Number.NaN;
  return normalizedHour * 60 + minute;
}

function extractTimeToken(message: string): { raw: string; explicitMeridiem: string | null } | null {
  const lower = message.toLowerCase();
  const patterns = [
    /\b(\d{1,2}:\d{2}\s*(?:am|pm)?)\b/i,
    /\b(\d{1,2}\.\d{2}\s*(?:am|pm)?)\b/i,
    /\b(\d{1,2}\s+\d{2}\s*(?:am|pm)?)\b/i,
    /\b(\d{3,4}\s*(?:am|pm)?)\b/i,
    /\b(\d{1,2}\s*(?:am|pm))\b/i,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match?.[1]) {
      const token = match[1].trim();
      const meridiemMatch = token.match(/(am|pm)\s*$/i);
      return {
        raw: token.replace(/\s*(am|pm)\s*$/i, "").trim(),
        explicitMeridiem: meridiemMatch?.[1]?.toLowerCase() ?? null,
      };
    }
  }

  const selectionMatch = lower.match(
    /\b(?:let'?s\s+do|lets?\s+do|let\s+me\s+do|i'?ll\s+take|take|book|do)\s+(\d{1,2})(?::(\d{2}))?\b/i,
  );
  if (selectionMatch?.[1]) {
    const hour = selectionMatch[1];
    const minute = selectionMatch[2];
    return {
      raw: minute ? `${hour}:${minute}` : hour,
      explicitMeridiem: null,
    };
  }

  const aboutMatch = lower.match(/\b(?:how|what)\s+about\s+(\d{1,2})(?::(\d{2}))?\b/i);
  if (aboutMatch?.[1]) {
    const hour = aboutMatch[1];
    const minute = aboutMatch[2];
    return {
      raw: minute ? `${hour}:${minute}` : hour,
      explicitMeridiem: null,
    };
  }

  return null;
}

export function resolveRequestedMinutesFromMessage(
  message: string,
  offeredSlots: string[] = [],
): number | null {
  const token = extractTimeToken(message);
  if (!token) return null;

  const offeredHint = inferMeridiemHintFromOfferedSlots(offeredSlots);
  const parsed = parseFlexibleTimeToken(
    token.explicitMeridiem ? `${token.raw}${token.explicitMeridiem}` : token.raw,
  );
  if (parsed == null || Number.isNaN(parsed)) return null;

  const hasExplicitMeridiem = token.explicitMeridiem != null;
  if (hasExplicitMeridiem) return parsed;

  const compactMatch = token.raw.replace(/\s+/g, "").match(/^(\d{1,2})[:.]?(\d{2})$|^(\d{3,4})$/);
  if (!compactMatch) {
    return parsed;
  }

  let hour: number;
  let minute: number;
  if (compactMatch[3]) {
    const digits = compactMatch[3].padStart(4, "0");
    hour = Number.parseInt(digits.slice(0, 2), 10);
    minute = Number.parseInt(digits.slice(2), 10);
  } else {
    hour = Number.parseInt(compactMatch[1] ?? "0", 10);
    minute = Number.parseInt(compactMatch[2] ?? "0", 10);
  }

  if (offeredHint === "mixed") {
    const amMinutes = applyMeridiemToHour(hour, minute, "am", offeredHint);
    const pmMinutes = applyMeridiemToHour(hour, minute, "pm", offeredHint);
    const amMatches = offeredSlots.filter((slot) => slotMatchesMinutes(slot, amMinutes, 0));
    const pmMatches = offeredSlots.filter((slot) => slotMatchesMinutes(slot, pmMinutes, 0));
    if (amMatches.length === 1 && pmMatches.length === 0) return amMinutes;
    if (pmMatches.length === 1 && amMatches.length === 0) return pmMinutes;
    if (amMatches.length === 0 && pmMatches.length === 1) return pmMinutes;
    if (pmMatches.length === 0 && amMatches.length === 1) return amMinutes;
    if (amMatches.length === 1 && pmMatches.length === 1) return null;
  }

  const contextual = applyMeridiemToHour(hour, minute, null, offeredHint);
  return Number.isNaN(contextual) ? parsed : contextual;
}

export function extractRequestedTimeMinutes(
  message: string,
  offeredSlots: string[] = [],
): number | null {
  if (offeredSlots.length > 0) {
    return resolveRequestedMinutesFromMessage(message, offeredSlots);
  }

  const token = extractTimeToken(message);
  if (token) {
    const parsed = parseFlexibleTimeToken(
      token.explicitMeridiem ? `${token.raw}${token.explicitMeridiem}` : token.raw,
    );
    if (parsed != null && !Number.isNaN(parsed)) return parsed;
  }

  return null;
}

export function needsMeridiemClarification(message: string, offeredSlots: string[]): boolean {
  if (offeredSlots.length === 0) return false;
  if (inferMeridiemHintFromOfferedSlots(offeredSlots) !== "mixed") return false;
  const token = extractTimeToken(message);
  if (!token || token.explicitMeridiem) return false;
  return resolveRequestedMinutesFromMessage(message, offeredSlots) === null;
}

const SLOT_SELECTION_INTENT_RE =
  /\b(works?|good|perfect|sounds\s+good|book|take|grab|yes|yeah|yep|sure|ok(?:ay)?|that\s+one|this\s+one|the\s+(?:first|second|third|last|\d+(?:st|nd|rd|th))\s+one|that\s+\d|this\s+\d|i'?ll\s+take|lets?\s+do|let\s+me\s+do|do\s+\d|(?:the|that)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:one|slot))\b/i;

export function looksLikeSlotSelectionIntent(message: string): boolean {
  return SLOT_SELECTION_INTENT_RE.test(message);
}

const BARE_HOUR_SELECTION_RE =
  /\b(?:(?:let'?s\s+do|lets?\s+do|do|take|book|sure|yes|yeah|yep|ok(?:ay)?)\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:is\s+)?(?:good|works?|perfect|fine|ok(?:ay)?)\b|\b(?:sure|yes|yeah|yep|ok(?:ay)?)\s+(\d{1,2})(?::(\d{2}))?\b|\b(?:sure|yes|yeah|yep|ok(?:ay)?)\s+(\d{3,4})\b|\b(?:let'?s\s+do|lets?\s+do|do|take|book)\s+(\d{1,2})(?::(\d{2}))?\b|\b(?:let'?s\s+do|lets?\s+do|do|take|book)\s+(\d{3,4})\b/i;

/** Resolve bare-hour slot selections such as "3 is good" against offered slots. */
export function resolveBareHourSelectionMinutes(
  message: string,
  offeredSlots: string[],
): number | null {
  if (!looksLikeSlotSelectionIntent(message)) return null;
  const match = message.match(BARE_HOUR_SELECTION_RE);
  if (!match) return null;

  const compact = match[5] ?? match[9];
  if (compact) {
    const digits = compact.padStart(4, "0");
    const hour = Number.parseInt(digits.slice(0, 2), 10);
    const minute = Number.parseInt(digits.slice(2), 10);
    const offeredHint = inferMeridiemHintFromOfferedSlots(offeredSlots);
    const minutes = applyMeridiemToHour(hour, minute, null, offeredHint);
    return Number.isNaN(minutes) ? null : minutes;
  }

  const hour = Number.parseInt(match[1] ?? match[3] ?? "0", 10);
  const minute = Number.parseInt(match[2] ?? match[4] ?? "0", 10);
  if (hour < 1 || hour > 12 || minute >= 60) return null;

  const offeredHint = inferMeridiemHintFromOfferedSlots(offeredSlots);
  const minutes = applyMeridiemToHour(hour, minute, null, offeredHint);
  return Number.isNaN(minutes) ? null : minutes;
}

export type SchedulingTimeIntent = "select" | "request" | "none";

export function classifySchedulingTimeIntent(
  message: string,
  scheduling?: SchedulingState,
): SchedulingTimeIntent {
  const offered = scheduling?.offeredSlots ?? [];
  if (offered.length > 0 && isNonSelectionSchedulingRequest(message)) {
    return "request";
  }

  if (offered.length > 0) {
    if (resolveOfferedSlotSelectionCandidate(message, offered)) {
      return "select";
    }
    if (looksLikeSlotSelectionIntent(message)) {
      return "select";
    }
    const minutes = resolveRequestedMinutesFromMessage(message, offered);
    if (minutes != null) {
      if (isNonSelectionSchedulingRequest(message)) {
        return "request";
      }
      if (/\?\s*$/.test(message.trim())) {
        return "request";
      }
      if (/\b(around|about|like|need|anything|what about|how about|closer|near)\b/i.test(message)) {
        return "request";
      }
    }
  }

  if (hasExplicitExactTimeRequest(message, scheduling)) {
    return "request";
  }

  return "none";
}

function isNonSelectionSchedulingRequest(message: string): boolean {
  return (
    /\b(?:instead|anything\s+around|do\s+you\s+have|any(?:thing)?\s+(?:around|at|for|open)|what\s+about|how\s+about|different\s+time|other\s+time|later\s+time|something\s+(?:around|at|closer|later)|need\s+(?:something|later|a\s+time))\b/i.test(
      message,
    ) ||
    (/\?\s*$/.test(message.trim()) && /\b(\d{1,2}|morning|afternoon|evening)\b/i.test(message))
  );
}

function resolveOrdinalIndex(token: string, count: number): number | null {
  const lower = token.toLowerCase();
  if (lower === "first" || lower === "1st") return 0;
  if (lower === "second" || lower === "2nd") return 1;
  if (lower === "third" || lower === "3rd") return 2;
  if (lower === "last") return count - 1;
  const numeric = lower.match(/^(\d+)/);
  if (numeric) {
    const index = Number.parseInt(numeric[1] ?? "0", 10) - 1;
    return index >= 0 && index < count ? index : null;
  }
  return null;
}

export function resolveOfferedSlotSelectionCandidate(
  message: string,
  offeredSlots: string[],
): string | null {
  if (offeredSlots.length === 0) return null;
  if (isNonSelectionSchedulingRequest(message)) return null;

  const ordinalMatch = message.match(
    /\b(?:the\s+)?(first|second|third|last|\d+(?:st|nd|rd|th))\s+one\b/i,
  );
  if (ordinalMatch) {
    const index = resolveOrdinalIndex(ordinalMatch[1] ?? "", offeredSlots.length);
    if (index != null && index >= 0 && index < offeredSlots.length) {
      return offeredSlots[index] ?? null;
    }
  }

  const bareMinutes = resolveBareHourSelectionMinutes(message, offeredSlots);
  if (bareMinutes != null) {
    const exact = offeredSlots.filter((slot) => slotMatchesMinutes(slot, bareMinutes, 0));
    if (exact.length === 1) return exact[0] ?? null;
    const near = offeredSlots.filter((slot) =>
      slotMatchesMinutes(slot, bareMinutes, 30),
    );
    if (near.length === 1) return near[0] ?? null;
  }

  const requestedMinutes = resolveRequestedMinutesFromMessage(message, offeredSlots);
  if (requestedMinutes != null) {
    const exactMatches = offeredSlots.filter((slot) =>
      slotMatchesMinutes(slot, requestedMinutes, 0),
    );
    if (exactMatches.length === 1) return exactMatches[0] ?? null;

    if (looksLikeSlotSelectionIntent(message)) {
      const near = offeredSlots.filter((slot) =>
        slotMatchesMinutes(slot, requestedMinutes, 30),
      );
      if (near.length === 1) return near[0] ?? null;
    }
  }

  if (
    offeredSlots.length === 1 &&
    (looksLikeSlotSelectionIntent(message) ||
      /\b(that\s+works|works\s+for\s+me|sounds\s+good)\b/i.test(message)) &&
    /\b(yes|yeah|yep|sure|ok(?:ay)?|good|works?|perfect|that\s+one|this\s+one|book|that\s+works|works\s+for\s+me|sounds\s+good)\b/i.test(
      message,
    )
  ) {
    return offeredSlots[0] ?? null;
  }

  return null;
}

export function hasExplicitExactTimeRequest(
  message: string,
  scheduling?: SchedulingState,
): boolean {
  const lower = message.toLowerCase();
  const aboutTimeProbe =
    /\b(?:how|what)\s+about\b/.test(lower) &&
    /\b(?:if you have|do you have|you have|available|open)\b/.test(lower);
  if (isNonSelectionSchedulingRequest(message) && !aboutTimeProbe) {
    return false;
  }
  const minutes = resolveRequestedMinutesFromMessage(message, scheduling?.offeredSlots ?? []);
  if (minutes == null) return false;
  if (aboutTimeProbe) return true;
  if (/\b(around|about|roughly|maybe|probably|like|closer|near)\b/.test(lower)) {
    if (/\b(?:how|what)\s+about\b/.test(lower)) {
      return true;
    }
    return /\b(at|do|let'?s|take|book|works?|good|perfect|that|need)\b/.test(lower);
  }
  return true;
}

export function offeredSlotSetKey(slots: string[]): string {
  return [...slots].sort().join("|");
}

/** Stable fingerprint of active scheduling constraints — used to invalidate stale slot reuse. */
export function schedulingConstraintFingerprint(scheduling?: SchedulingState): string {
  if (!scheduling) return "none";
  return [
    scheduling.activeRequestKey ?? "",
    scheduling.centralDate ?? "",
    scheduling.partOfDay ?? "",
    scheduling.anchorTimeMinutes ?? "",
    scheduling.earliestAllowedMinutes ?? "",
    scheduling.latestAllowedMinutes ?? "",
    scheduling.searchAfterMinutes ?? "",
    scheduling.searchBeforeMinutes ?? "",
    (scheduling.rejectedPartOfDay ?? []).join(","),
    (scheduling.rejectedSlotStarts ?? []).slice(0, 8).join(","),
  ].join("|");
}

export function offeredSlotConstraintKey(
  slots: string[],
  scheduling?: SchedulingState,
): string {
  return `${schedulingConstraintFingerprint(scheduling)}::${offeredSlotSetKey(slots)}`;
}

/** Drop slots that violate persisted date/daypart/constraint state. */
export function filterSlotsForSchedulingState(
  slots: string[],
  scheduling?: SchedulingState,
): string[] {
  if (slots.length === 0 || !scheduling) return slots;

  const rankPrefs = buildSlotRankPreferencesFromState(scheduling, {
    centralDate: scheduling.centralDate,
    partOfDay: scheduling.partOfDay,
  });
  let filtered = rankSlotsForOffer(slots, { ...rankPrefs, maxOffer: 48 });

  if (scheduling.centralDate) {
    filtered = filtered.filter(
      (slot) => centralDateFromOfferedSlot(slot) === scheduling.centralDate,
    );
  }

  return filtered;
}

export function slotsCompatibleWithSchedulingState(
  slots: string[],
  scheduling?: SchedulingState,
): boolean {
  if (slots.length === 0) return true;
  const compatible = filterSlotsForSchedulingState(slots, scheduling);
  return compatible.length === slots.length && compatible.length > 0;
}

export function findMatchingOfferedSlots(
  message: string,
  offeredSlots: string[],
  toleranceMinutes = 0,
): string[] {
  const requestedMinutes = resolveRequestedMinutesFromMessage(message, offeredSlots);
  if (requestedMinutes == null) return [];
  return offeredSlots.filter((slot) => slotMatchesMinutes(slot, requestedMinutes, toleranceMinutes));
}

const NON_SELECTION_SCHEDULING_REQUEST_RE =
  /\b(?:instead|anything\s+around|do\s+you\s+have|any(?:thing)?\s+(?:around|at|for|open)|what\s+about|how\s+about|different\s+time|other\s+time|later\s+time|something\s+(?:around|at|closer|later))\b/i;

function centralDateFromOfferedSlot(startIso: string): string {
  const parts = parseCentralParts(new Date(startIso), CONSULTATION_TIMEZONE);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function buildRefinementBaseInput(
  message: string,
  scheduling: SchedulingState | undefined,
  offeredSlots: string[],
  now: Date,
): AvailabilityRangeInput | null {
  const fromState = buildAvailabilityInputFromSchedulingState(scheduling, message, now);
  if (offeredSlots.length === 0) {
    return fromState;
  }

  const hasWeekdayInMessage = WEEKDAY_NAMES.some((day) =>
    new RegExp(`\\b${day}\\b`, "i").test(message),
  );
  const requestedMinutes = resolveRequestedMinutesFromMessage(message, offeredSlots);
  const refinesOfferedDay =
    !messageChangesDay(message) &&
    !hasWeekdayInMessage &&
    (NON_SELECTION_SCHEDULING_REQUEST_RE.test(message) ||
      (requestedMinutes !== null && !looksLikeSlotSelectionIntent(message)));

  if (refinesOfferedDay) {
    const offeredDay = centralDateFromOfferedSlot(offeredSlots[0]!);
    return {
      centralDate: scheduling?.centralDate ?? offeredDay,
      partOfDay:
        explicitPartOfDayFromMessage(message) ??
        scheduling?.partOfDay ??
        inferPartOfDay(message) ??
        "full_day",
    };
  }

  return fromState;
}

export function detectSchedulingRefinement(
  message: string,
  scheduling: SchedulingState | undefined,
  offeredSlots: string[],
  now = new Date(),
): SchedulingRefinement | null {
  const lower = message.toLowerCase();
  const baseInput = buildRefinementBaseInput(message, scheduling, offeredSlots, now);
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

  const bareTime = resolveRequestedMinutesFromMessage(message, offeredSlots);
  if (
    bareTime != null &&
    offeredSlots.length > 0 &&
    findMatchingOfferedSlots(message, offeredSlots, 0).length === 1
  ) {
    return null;
  }

  if (
    bareTime != null &&
    offeredSlots.length > 0 &&
    looksLikeSlotSelectionIntent(message) &&
    findMatchingOfferedSlots(message, offeredSlots, 30).length > 0
  ) {
    return null;
  }

  if (
    bareTime != null &&
    offeredSlots.length > 0 &&
    !looksLikeSlotSelectionIntent(message) &&
    !/\b(around|about|closer|near|after|before|like|instead|anything|what about|how about)\b/i.test(lower)
  ) {
    const exactMatches = findMatchingOfferedSlots(message, offeredSlots, 0);
    if (exactMatches.length === 1) {
      return null;
    }
  }

  if (
    bareTime != null &&
    offeredSlots.length > 0 &&
    !looksLikeSlotSelectionIntent(message) &&
    !/\b(around|about|closer|near|after|before|like)\b/i.test(lower)
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
  const narrowAroundAnchor = scheduling?.anchorTimeMinutes != null;

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
