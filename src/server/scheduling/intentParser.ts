import {
  parseFlexibleTimeToken,
  resolveRequestedMinutesFromMessage,
  resolveOfferedSlotSelectionCandidate,
  slotMatchesMinutes,
  detectDaypartSelectionCorrection,
} from "~/server/speed2Lead/schedulingContext";
import {
  nextWeekdayCentral,
  tomorrowCentralDate,
} from "~/server/speed2Lead/schedulingRange";
import type { AvailabilityPreference, CanonicalSchedulingState } from "~/server/scheduling/types";
import type { LegacyConstraintFields } from "~/server/scheduling/state";
import {
  applySchedulingStateUpdate,
  clearField,
  preserve,
  replaceField,
  type SchedulingStateUpdate,
} from "~/server/scheduling/stateUpdate";

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
  /\b(any\s*time|anytime|whenever|i'?m\s+flexible|im\s+flexible|flexible|any\s+time\s+works|whatever\s+you\s+have|what\s+(?:morning|afternoon|evening)\s+times?\s+do\s+you\s+have)\b/i;

const EXPLICIT_DAYPART_RE =
  /\b(morning|before\s+noon|afternoon|after\s+lunch|evenings?)\b/i;

const EVENING_PREFERENCE_RE =
  /\bevenings?\b(?:\s+(?:work|works|better|best|prefer|preferred|only|is\s+best))|\b(?:prefer|better|best|only)\s+(?:in\s+)?(?:the\s+)?evenings?\b/i;

const LATE_MORNING_RE = /\b(late morning|late-morning)\b/i;
const LATE_AFTERNOON_RE = /\b(late afternoon|late-afternoon|end of day)\b/i;
const NOONISH_RE = /\b(noon(?:-ish)?|around noon|about noon)\b/i;
const BETWEEN_TIMES_RE =
  /\bbetween\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\s+and\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b/i;
const AFTER_TIME_RE = /\bafter\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b/i;
const BEFORE_TIME_RE = /\bbefore\s+(?:noon|(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4}))\b/i;
const AROUND_TIME_RE = /\b(?:around|about)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4}|noon)\b/i;

const REFINEMENT_LATER_RE =
  /\b(later|too early|after those|anything later|something later|need something later|anything after|move later|push it later|later that morning|anything later that morning|later in the morning)\b/i;

const REFINEMENT_EARLIER_RE =
  /\b(earlier|too late|before those|anything earlier|something earlier|move earlier)\b/i;

const NEGATED_TIME_RE =
  /\b(?:no|not|n't|dont|won't|wont|doesn'?t|does not)\b[^?.!]{0,40}?\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b|\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b[^?.!]{0,20}?\b(?:doesn'?t|does not|don'?t|won'?t|wont)\s+work\b|\banything\s+but\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b/i;

const WHAT_ABOUT_TIME_RE =
  /\b(?:what|how)\s+about\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b/i;

const AT_TIME_RE = /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b/i;

const SHORT_EXACT_TIME_RE =
  /^(?:\s*(?:what|how)\s+about\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\s*\?\s*$/i;

const BARE_TIME_RE =
  /^(?:\s*(?:maybe|probably)\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\s*$/i;

const REJECT_OFFERED_RE =
  /\b(none of those|not those|any(?:thing)? else|something else|different times?|other options?|doesn'?t work|dont work|won'?t work|wont work|too early|too late)\b/i;

const DAYPART_WONT_WORK = "(?:don|doesn)'?t|dont|won'?t|wont|do not|does not";
const REJECT_MORNING_SIMPLE = new RegExp(
  `\\b(?:no|not)\\s+mornings?\\b|\\bmornings?\\s+${DAYPART_WONT_WORK}\\s+work`,
  "i",
);
const REJECT_AFTERNOON_SIMPLE = new RegExp(
  `\\b(?:no|not)\\s+afternoons?\\b|\\bafternoons?\\s+${DAYPART_WONT_WORK}\\s+work`,
  "i",
);
const REJECT_EVENING_SIMPLE = new RegExp(
  `\\b(?:no|not)\\s+evenings?\\b|\\bevenings?\\s+${DAYPART_WONT_WORK}\\s+work`,
  "i",
);

/** @deprecated Use SchedulingStateUpdate — kept for tests inspecting patch shape. */
export type IntentPatch = {
  requestedDate?: string;
  availabilityPreference?: AvailabilityPreference;
  exactTimeMinutes?: number;
  lowerTimeBound?: number;
  upperTimeBound?: number;
  anchorTime?: number;
};

function emptyUpdate(): SchedulingStateUpdate {
  return {
    requestedDate: preserve(),
    availabilityPreference: preserve(),
    exactTimeMinutes: preserve(),
    anchorTimeMinutes: preserve(),
    lowerTimeBound: preserve(),
    upperTimeBound: preserve(),
    rejectedSlotStarts: preserve(),
    rejectedPartOfDay: preserve(),
  };
}

function resolveDateFromMessage(message: string, now: Date): string | undefined {
  const lower = message.toLowerCase();
  if (/\btomorrow\b/.test(lower)) {
    return tomorrowCentralDate(now);
  }
  for (const weekday of WEEKDAY_NAMES) {
    if (
      new RegExp(
        `\\b(?:what about|how about|instead|switch to|actually|then|need)?\\s*(?:next\\s+)?${weekday}\\b`,
      ).test(lower)
    ) {
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

function isActiveScheduling(prior?: CanonicalSchedulingState): boolean {
  if (!prior) return false;
  return (
    prior.status === "slots_offered" ||
    Boolean(prior.requestedDate) ||
    Boolean(prior.availabilityPreference)
  );
}

function extractNegatedTimeMinutes(
  message: string,
  offeredSlots: string[],
): number | null {
  const match = message.match(NEGATED_TIME_RE);
  if (!match) return null;
  const raw = (match[1] ?? match[2] ?? match[3] ?? "").trim();
  if (!raw) return null;
  const parsed = resolveRequestedMinutesFromMessage(raw, offeredSlots);
  if (parsed != null) return parsed;
  return parseFlexibleTimeToken(raw.replace(/\s+/g, ""));
}

function resolveShortTimeMinutes(raw: string, offeredSlots: string[]): number | null {
  const fromMessage = resolveRequestedMinutesFromMessage(raw, offeredSlots);
  if (fromMessage != null) return fromMessage;
  const parsed = parseFlexibleTimeToken(raw.replace(/\s+/g, ""));
  return parsed == null || Number.isNaN(parsed) ? null : parsed;
}

function extractExactTimeMinutes(
  message: string,
  prior: CanonicalSchedulingState | undefined,
  offeredSlots: string[],
): number | null {
  const lower = message.toLowerCase().trim();

  if (NEGATED_TIME_RE.test(lower)) return null;

  const contextual = isActiveScheduling(prior);
  const whatAbout = lower.match(WHAT_ABOUT_TIME_RE);
  if (whatAbout && !/\b(around|about)\b/.test(lower)) {
    const raw = (whatAbout[1] ?? "").trim();
    const parsed = resolveShortTimeMinutes(raw, offeredSlots);
    if (parsed != null) return parsed;
  }

  if (contextual && SHORT_EXACT_TIME_RE.test(lower)) {
    const shortMatch = lower.match(SHORT_EXACT_TIME_RE);
    const raw = (shortMatch?.[1] ?? "").trim();
    if (raw) {
      const parsed = resolveShortTimeMinutes(raw, offeredSlots);
      if (parsed != null) return parsed;
    }
  }

  if (contextual && BARE_TIME_RE.test(lower)) {
    const bareMatch = lower.match(BARE_TIME_RE);
    const raw = (bareMatch?.[1] ?? "").trim();
    if (raw) {
      const parsed = resolveShortTimeMinutes(raw, offeredSlots);
      if (parsed != null) return parsed;
    }
  }

  if (/\blet'?s\s+do\b/i.test(message)) {
    const letsDoMatch = message.match(
      /\blet'?s\s+do\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4})\b/i,
    );
    if (letsDoMatch?.[1]) {
      const parsed = resolveShortTimeMinutes(letsDoMatch[1], offeredSlots);
      if (parsed != null) return parsed;
    }
    if (!/\b(at|around|about)\b/i.test(message)) {
      return null;
    }
  }

  const atMatch = lower.match(AT_TIME_RE);
  if (atMatch && !/\b(around|about)\b/.test(lower)) {
    const raw = (atMatch[1] ?? "").trim();
    const parsed = resolveShortTimeMinutes(raw, offeredSlots);
    if (parsed != null) return parsed;
  }

  const parsed = resolveRequestedMinutesFromMessage(message, offeredSlots);
  if (parsed != null) {
    if (/\b(around|about|roughly|closer|near)\b/i.test(lower) && !/\b(?:what|how)\s+about\b/.test(lower)) {
      return null;
    }
    if (contextual || /\b(at|do|take|book|am|pm)\b/i.test(lower) || /\?\s*$/.test(lower)) {
      return parsed;
    }
  }

  return null;
}

function clearTimeConstraints(): Pick<
  SchedulingStateUpdate,
  "exactTimeMinutes" | "anchorTimeMinutes" | "lowerTimeBound" | "upperTimeBound"
> {
  return {
    exactTimeMinutes: clearField(),
    anchorTimeMinutes: clearField(),
    lowerTimeBound: clearField(),
    upperTimeBound: clearField(),
  };
}

function clearExactAndAnchor(): Pick<
  SchedulingStateUpdate,
  "exactTimeMinutes" | "anchorTimeMinutes"
> {
  return {
    exactTimeMinutes: clearField(),
    anchorTimeMinutes: clearField(),
  };
}

/** Semantic parse → explicit SchedulingStateUpdate. */
export function parseSchedulingStateUpdate(
  message: string,
  prior: (CanonicalSchedulingState & LegacyConstraintFields) | undefined,
  now: Date,
  offeredSlots: string[] = [],
): SchedulingStateUpdate {
  const lower = message.toLowerCase().trim();
  const update = emptyUpdate();
  let dateChanged = false;
  let daypartChanged = false;
  let broadened = false;

  if (
    offeredSlots.length > 0 &&
    resolveOfferedSlotSelectionCandidate(message, offeredSlots)
  ) {
    return update;
  }

  const negatedMinutes = extractNegatedTimeMinutes(message, offeredSlots);
  if (negatedMinutes != null) {
    if (prior?.exactTimeMinutes === negatedMinutes) {
      update.exactTimeMinutes = clearField();
      update.availabilityPreference =
        prior?.availabilityPreference === "exact_time"
          ? replaceField(prior?.partOfDay === "morning"
              ? "morning"
              : prior?.partOfDay === "afternoon" || prior?.partOfDay === "evening"
                ? "afternoon"
                : "full_day")
          : preserve();
    } else {
      update.exactTimeMinutes = preserve();
    }
    update.anchorTimeMinutes =
      prior?.anchorTimeMinutes === negatedMinutes ? clearField() : preserve();
    const rejected = offeredSlots.filter((slot) => slotMatchesMinutes(slot, negatedMinutes, 0));
    if (rejected.length > 0) {
      update.rejectedSlotStarts = { op: "add", values: rejected };
    }
    update.invalidateOffers = true;
    return update;
  }

  if (EARLIEST_RE.test(lower)) {
    update.availabilityPreference = replaceField("earliest");
    Object.assign(update, clearExactAndAnchor());
    broadened = true;
  }

  if (FLEXIBLE_RE.test(lower) && update.availabilityPreference?.op !== "replace") {
    update.availabilityPreference = replaceField("full_day");
    Object.assign(update, clearExactAndAnchor());
    broadened = true;
  }

  const resolvedDate = resolveDateFromMessage(message, now);
  if (resolvedDate) {
    if (prior?.requestedDate !== resolvedDate) {
      update.requestedDate = replaceField(resolvedDate);
      dateChanged = true;
      Object.assign(update, clearTimeConstraints());
      update.rejectedSlotStarts = { op: "clear" };
      update.rejectedPartOfDay = replaceField([]);
      update.invalidateOffers = true;
    } else if (
      !hasExplicitDaypart(message) &&
      !AT_TIME_RE.test(lower) &&
      !WHAT_ABOUT_TIME_RE.test(lower) &&
      !SHORT_EXACT_TIME_RE.test(lower) &&
      !/\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(lower) &&
      !FLEXIBLE_RE.test(lower)
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
        update.availabilityPreference = replaceField("full_day");
        Object.assign(update, clearExactAndAnchor());
        broadened = true;
      }
    }
  }

  const rejectsAfternoon =
    /\b(?:no|not)\s+afternoons?\b/i.test(lower) ||
    /\bafternoons?\s+(?:don|doesn)'?t\b/i.test(lower);
  const rejectsMorning =
    /\b(?:no|not)\s+mornings?\b/i.test(lower) ||
    /\bmornings?\s+(?:don|doesn)'?t\b/i.test(lower);

  if (!rejectsMorning && /\b(?:need\s+a\s+)?(?:morning|before\s+noon)\b/.test(lower)) {
    update.availabilityPreference = replaceField("morning");
    daypartChanged = true;
  } else if (
    !rejectsAfternoon &&
    /\b(after\s+lunch|afternoon)\b/.test(lower) &&
    !EVENING_PREFERENCE_RE.test(lower)
  ) {
    update.availabilityPreference = replaceField("afternoon");
    daypartChanged = true;
  } else if (EVENING_PREFERENCE_RE.test(lower) || /\bevenings?\b/.test(lower)) {
    update.availabilityPreference = replaceField("evening");
    daypartChanged = true;
  }

  if (daypartChanged) {
    Object.assign(update, clearExactAndAnchor());
    if (update.lowerTimeBound?.op === "preserve") update.lowerTimeBound = clearField();
    if (update.upperTimeBound?.op === "preserve") update.upperTimeBound = clearField();
    update.invalidateOffers = true;
  }

  if (LATE_MORNING_RE.test(lower)) {
    update.availabilityPreference = replaceField("morning");
    update.lowerTimeBound = replaceField(10 * 60);
    update.upperTimeBound = replaceField(12 * 60);
    Object.assign(update, clearExactAndAnchor());
  } else if (LATE_AFTERNOON_RE.test(lower)) {
    update.availabilityPreference = replaceField("afternoon");
    update.lowerTimeBound = replaceField(14 * 60);
    update.upperTimeBound = replaceField(17 * 60);
    Object.assign(update, clearExactAndAnchor());
  }

  const betweenMatch = lower.match(BETWEEN_TIMES_RE);
  if (betweenMatch) {
    const lo = parseFlexibleTimeToken((betweenMatch[1] ?? "").replace(/\s+/g, ""));
    const hi = parseFlexibleTimeToken((betweenMatch[2] ?? "").replace(/\s+/g, ""));
    if (lo != null && hi != null) {
      update.lowerTimeBound = replaceField(lo);
      update.upperTimeBound = replaceField(hi);
      Object.assign(update, clearExactAndAnchor());
    }
  }

  const afterMatch = lower.match(AFTER_TIME_RE);
  if (afterMatch && !betweenMatch) {
    const minutes = parseFlexibleTimeToken((afterMatch[1] ?? "").replace(/\s+/g, ""));
    if (minutes != null) {
      update.lowerTimeBound = replaceField(minutes);
      Object.assign(update, clearExactAndAnchor());
    }
  }

  const beforeMatch = lower.match(BEFORE_TIME_RE);
  if (beforeMatch && !betweenMatch) {
    if ((beforeMatch[1] ?? "").toLowerCase() === "noon" || /\bbefore\s+noon\b/i.test(lower)) {
      update.upperTimeBound = replaceField(12 * 60);
      update.availabilityPreference =
        update.availabilityPreference?.op === "replace"
          ? update.availabilityPreference
          : replaceField("morning");
      Object.assign(update, clearExactAndAnchor());
    } else {
      const minutes = parseFlexibleTimeToken((beforeMatch[1] ?? "").replace(/\s+/g, ""));
      if (minutes != null) {
        update.upperTimeBound = replaceField(minutes);
        Object.assign(update, clearExactAndAnchor());
      }
    }
  }

  if (REFINEMENT_LATER_RE.test(lower)) {
    const reference =
      prior?.exactTimeMinutes ??
      prior?.anchorTimeMinutes ??
      prior?.searchAfterMinutes ??
      prior?.earliestAllowedMinutes;
    if (reference != null) {
      update.lowerTimeBound = replaceField(reference + 1);
      Object.assign(update, clearExactAndAnchor());
    }
  }

  if (REFINEMENT_EARLIER_RE.test(lower)) {
    const reference =
      prior?.exactTimeMinutes ??
      prior?.anchorTimeMinutes ??
      prior?.searchBeforeMinutes ??
      prior?.latestAllowedMinutes;
    if (reference != null) {
      update.upperTimeBound = replaceField(reference - 1);
      Object.assign(update, clearExactAndAnchor());
    }
  }

  const aroundMatch = lower.match(AROUND_TIME_RE);
  if (aroundMatch && !WHAT_ABOUT_TIME_RE.test(lower)) {
    const raw = (aroundMatch[1] ?? "").replace(/\s+/g, "");
    const minutes = raw === "noon" ? 12 * 60 : parseFlexibleTimeToken(raw);
    if (minutes != null) {
      update.anchorTimeMinutes = replaceField(minutes);
      update.exactTimeMinutes = clearField();
      if (update.availabilityPreference?.op === "preserve") {
        update.availabilityPreference = replaceField(inferDaypartFromAnchorMinutes(minutes));
      }
      if (NOONISH_RE.test(lower) && update.availabilityPreference?.op === "preserve") {
        update.availabilityPreference = replaceField("full_day");
      }
    }
  } else if (NOONISH_RE.test(lower) && !WHAT_ABOUT_TIME_RE.test(lower)) {
    update.anchorTimeMinutes = replaceField(12 * 60);
    update.exactTimeMinutes = clearField();
  }

  const exactMinutes = extractExactTimeMinutes(message, prior, offeredSlots);
  const dateForExact = resolvedDate ?? prior?.requestedDate;
  const isAroundIntent = Boolean(aroundMatch) && !WHAT_ABOUT_TIME_RE.test(lower);
  if (
    exactMinutes != null &&
    dateForExact &&
    !isAroundIntent &&
    update.anchorTimeMinutes?.op !== "replace"
  ) {
    update.availabilityPreference = replaceField("exact_time");
    update.exactTimeMinutes = replaceField(exactMinutes);
    update.requestedDate = resolvedDate ? replaceField(resolvedDate) : preserve();
    update.anchorTimeMinutes = clearField();
    if (update.lowerTimeBound?.op === "preserve") update.lowerTimeBound = clearField();
    if (update.upperTimeBound?.op === "preserve") update.upperTimeBound = clearField();
    update.invalidateOffers = true;
  }

  if (REJECT_OFFERED_RE.test(lower) && offeredSlots.length > 0) {
    update.rejectedSlotStarts = { op: "add", values: offeredSlots };
    update.invalidateOffers = true;
  }

  const daypartCorrection = detectDaypartSelectionCorrection(message, prior
    ? { ...prior, offeredSlots: offeredSlots.length > 0 ? offeredSlots : prior.offeredSlots }
    : undefined);
  if (daypartCorrection) {
    update.availabilityPreference = replaceField(daypartCorrection);
    Object.assign(update, clearExactAndAnchor());
    if (update.lowerTimeBound?.op === "preserve") update.lowerTimeBound = clearField();
    if (update.upperTimeBound?.op === "preserve") update.upperTimeBound = clearField();
    update.invalidateOffers = true;
  } else if (REJECT_MORNING_SIMPLE.test(lower)) {
    const rejected = [...(prior?.rejectedPartOfDay ?? []), "morning" as const];
    update.rejectedPartOfDay = replaceField(rejected);
    update.availabilityPreference = replaceField("afternoon");
    Object.assign(update, clearExactAndAnchor());
    update.invalidateOffers = true;
  } else if (REJECT_AFTERNOON_SIMPLE.test(lower)) {
    const rejected = [...(prior?.rejectedPartOfDay ?? []), "afternoon" as const];
    update.rejectedPartOfDay = replaceField(rejected);
    update.availabilityPreference = replaceField("evening");
    Object.assign(update, clearExactAndAnchor());
    update.invalidateOffers = true;
  } else if (REJECT_EVENING_SIMPLE.test(lower)) {
    const rejected = [...(prior?.rejectedPartOfDay ?? []), "evening" as const];
    update.rejectedPartOfDay = replaceField(rejected);
    update.availabilityPreference = replaceField("afternoon");
    Object.assign(update, clearExactAndAnchor());
    update.invalidateOffers = true;
  }

  if (broadened && !dateChanged) {
    Object.assign(update, clearExactAndAnchor());
    if (update.lowerTimeBound?.op === "preserve") update.lowerTimeBound = clearField();
    if (update.upperTimeBound?.op === "preserve") update.upperTimeBound = clearField();
    update.invalidateOffers = true;
  }

  if (dateChanged) {
    update.invalidateOffers = true;
  }

  return update;
}

/** Legacy patch shape for backward-compatible tests. */
export function parseSchedulingIntentUpdate(
  message: string,
  prior: CanonicalSchedulingState | undefined,
  now: Date,
): IntentPatch {
  const update = parseSchedulingStateUpdate(message, prior, now, prior?.offeredSlots ?? []);
  const patch: IntentPatch = {};
  if (update.requestedDate?.op === "replace") patch.requestedDate = update.requestedDate.value;
  if (update.availabilityPreference?.op === "replace") {
    patch.availabilityPreference = update.availabilityPreference.value;
  }
  if (update.exactTimeMinutes?.op === "replace") patch.exactTimeMinutes = update.exactTimeMinutes.value;
  if (update.lowerTimeBound?.op === "replace") patch.lowerTimeBound = update.lowerTimeBound.value;
  if (update.upperTimeBound?.op === "replace") patch.upperTimeBound = update.upperTimeBound.value;
  if (update.anchorTimeMinutes?.op === "replace") patch.anchorTime = update.anchorTimeMinutes.value;
  return patch;
}

export function applyInboundSchedulingUpdate(
  prior: CanonicalSchedulingState & LegacyConstraintFields,
  message: string,
  now: Date,
  offeredSlots: string[] = prior.offeredSlots ?? [],
): CanonicalSchedulingState & LegacyConstraintFields {
  const update = parseSchedulingStateUpdate(message, prior, now, offeredSlots);
  return applySchedulingStateUpdate(prior, update);
}

export function mergeIntentIntoState(
  prior: CanonicalSchedulingState & LegacyConstraintFields,
  patch: IntentPatch,
): CanonicalSchedulingState & LegacyConstraintFields {
  const update: SchedulingStateUpdate = {
    requestedDate: patch.requestedDate != null ? replaceField(patch.requestedDate) : preserve(),
    availabilityPreference:
      patch.availabilityPreference != null
        ? replaceField(patch.availabilityPreference)
        : preserve(),
    exactTimeMinutes:
      patch.exactTimeMinutes != null ? replaceField(patch.exactTimeMinutes) : preserve(),
    anchorTimeMinutes: patch.anchorTime != null ? replaceField(patch.anchorTime) : preserve(),
    lowerTimeBound: patch.lowerTimeBound != null ? replaceField(patch.lowerTimeBound) : preserve(),
    upperTimeBound: patch.upperTimeBound != null ? replaceField(patch.upperTimeBound) : preserve(),
    rejectedSlotStarts: preserve(),
    rejectedPartOfDay: preserve(),
  };

  if (patch.availabilityPreference && patch.availabilityPreference !== "exact_time") {
    update.exactTimeMinutes = clearField();
    if (patch.anchorTime == null) {
      update.anchorTimeMinutes = clearField();
    }
  }
  if (patch.availabilityPreference === "exact_time") {
    update.anchorTimeMinutes = clearField();
  }
  if (patch.requestedDate != null && patch.requestedDate !== prior.requestedDate) {
    Object.assign(update, clearTimeConstraints());
    update.rejectedSlotStarts = { op: "clear" };
    update.invalidateOffers = true;
  }

  return applySchedulingStateUpdate(prior, update);
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
