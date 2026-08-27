import type { AvailabilityPreference, CanonicalSchedulingState } from "~/server/speed2Lead/agent/scheduling/types";
import type { LegacyConstraintFields } from "~/server/speed2Lead/agent/scheduling/state";
import type { SchedulingPartOfDay } from "~/server/speed2Lead/sessionMemoryTypes";

/** Explicit field mutation — no ambiguous undefined/null. */
export type FieldUpdate<T> =
  | { op: "preserve" }
  | { op: "replace"; value: T }
  | { op: "clear" };

export type RejectedSlotUpdate =
  | { op: "preserve" }
  | { op: "clear" }
  | { op: "add"; values: string[] };

export type SchedulingStateUpdate = {
  requestedDate?: FieldUpdate<string>;
  availabilityPreference?: FieldUpdate<AvailabilityPreference>;
  exactTimeMinutes?: FieldUpdate<number>;
  anchorTimeMinutes?: FieldUpdate<number>;
  lowerTimeBound?: FieldUpdate<number>;
  upperTimeBound?: FieldUpdate<number>;
  rejectedSlotStarts?: RejectedSlotUpdate;
  rejectedPartOfDay?: FieldUpdate<SchedulingPartOfDay[]>;
  /** When true, clear offered slots and lastPresentedOfferKey (request semantics changed). */
  invalidateOffers?: boolean;
};

export function preserve<T>(): FieldUpdate<T> {
  return { op: "preserve" };
}

export function replaceField<T>(value: T): FieldUpdate<T> {
  return { op: "replace", value };
}

export function clearField<T>(): FieldUpdate<T> {
  return { op: "clear" };
}

function resolveField<T>(
  update: FieldUpdate<T> | undefined,
  prior: T | undefined,
): T | undefined {
  if (!update || update.op === "preserve") return prior;
  if (update.op === "clear") return undefined;
  return update.value;
}

function resolveRejectedSlots(
  update: RejectedSlotUpdate | undefined,
  prior: string[] | undefined,
): string[] | undefined {
  if (!update || update.op === "preserve") return prior;
  if (update.op === "clear") return undefined;
  const merged = [...(prior ?? []), ...update.values];
  return merged.length > 0 ? [...new Set(merged)] : undefined;
}

function preferenceToLegacyPart(
  part?: AvailabilityPreference,
): LegacyConstraintFields["partOfDay"] {
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

/** Apply explicit scheduling state update once — canonical constraint owner. */
export function applySchedulingStateUpdate(
  prior: CanonicalSchedulingState & LegacyConstraintFields,
  update: SchedulingStateUpdate,
): CanonicalSchedulingState & LegacyConstraintFields {
  const requestedDate = resolveField(update.requestedDate, prior.requestedDate);
  const availabilityPreference = resolveField(
    update.availabilityPreference,
    prior.availabilityPreference,
  );
  const exactTimeMinutes = resolveField(update.exactTimeMinutes, prior.exactTimeMinutes);
  const anchorTimeMinutes = resolveField(update.anchorTimeMinutes, prior.anchorTimeMinutes);
  const lowerTimeBound = resolveField(update.lowerTimeBound, prior.searchAfterMinutes ?? prior.earliestAllowedMinutes);
  const upperTimeBound = resolveField(update.upperTimeBound, prior.searchBeforeMinutes ?? prior.latestAllowedMinutes);
  const rejectedSlotStarts = resolveRejectedSlots(update.rejectedSlotStarts, prior.rejectedSlotStarts);
  const rejectedPartOfDay = resolveField(update.rejectedPartOfDay, prior.rejectedPartOfDay);

  const partOfDay =
    update.availabilityPreference?.op === "replace"
      ? preferenceToLegacyPart(update.availabilityPreference.value)
      : update.availabilityPreference?.op === "clear"
        ? undefined
        : prior.partOfDay ??
          preferenceToLegacyPart(availabilityPreference);

  const next: CanonicalSchedulingState & LegacyConstraintFields = {
    ...prior,
    requestedDate,
    availabilityPreference,
    exactTimeMinutes,
    anchorTimeMinutes,
    partOfDay,
    rejectedSlotStarts,
    rejectedPartOfDay,
    searchAfterMinutes: lowerTimeBound,
    searchBeforeMinutes: upperTimeBound,
    earliestAllowedMinutes: lowerTimeBound,
    latestAllowedMinutes: upperTimeBound,
  };

  if (update.invalidateOffers) {
    next.offeredSlots = undefined;
    next.lastPresentedOfferKey = undefined;
    if (next.status === "slots_offered") {
      next.status = "idle";
    }
  }

  return next;
}

export type ConstraintValidationResult =
  | { ok: true }
  | { ok: false; reason: "impossible_bounds"; lower: number; upper: number };

/** Reject impossible lower > upper before provider query. */
export function validateSchedulingConstraints(
  state: CanonicalSchedulingState & LegacyConstraintFields,
): ConstraintValidationResult {
  const lower = state.searchAfterMinutes ?? state.earliestAllowedMinutes;
  const upper = state.searchBeforeMinutes ?? state.latestAllowedMinutes;
  if (lower != null && upper != null && lower > upper) {
    return { ok: false, reason: "impossible_bounds", lower, upper };
  }
  return { ok: true };
}

/** Normalize corrupted bounds based on current semantic preference. */
export function normalizeImpossibleBounds(
  state: CanonicalSchedulingState & LegacyConstraintFields,
): CanonicalSchedulingState & LegacyConstraintFields {
  const validation = validateSchedulingConstraints(state);
  if (validation.ok) return state;

  const pref = state.availabilityPreference;
  let lower = state.searchAfterMinutes ?? state.earliestAllowedMinutes;
  let upper = state.searchBeforeMinutes ?? state.latestAllowedMinutes;

  if (pref === "morning") {
    lower = undefined;
    upper = upper != null && upper <= 12 * 60 ? upper : undefined;
  } else if (pref === "afternoon" || pref === "evening") {
    lower = lower != null && lower >= 12 * 60 ? lower : undefined;
    upper = undefined;
  } else if (pref === "exact_time" && state.exactTimeMinutes != null) {
    lower = undefined;
    upper = undefined;
  } else {
    lower = undefined;
    upper = undefined;
  }

  return {
    ...state,
    searchAfterMinutes: lower,
    searchBeforeMinutes: upper,
    earliestAllowedMinutes: lower,
    latestAllowedMinutes: upper,
  };
}

export function hasMeaningfulUpdate(update: SchedulingStateUpdate): boolean {
  const fields: (FieldUpdate<unknown> | RejectedSlotUpdate | undefined)[] = [
    update.requestedDate,
    update.availabilityPreference,
    update.exactTimeMinutes,
    update.anchorTimeMinutes,
    update.lowerTimeBound,
    update.upperTimeBound,
    update.rejectedPartOfDay,
    update.rejectedSlotStarts,
  ];
  if (update.invalidateOffers) return true;
  return fields.some(
    (field) => field != null && field.op !== "preserve",
  );
}
