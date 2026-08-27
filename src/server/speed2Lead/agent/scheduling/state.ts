import type { SchedulingPartOfDay, SchedulingState } from "~/server/speed2Lead/sessionMemoryTypes";
import type {
  AvailabilityPreference,
  CanonicalSchedulingState,
  SchedulingRequest,
} from "~/server/speed2Lead/agent/scheduling/types";
import { normalizeImpossibleBounds } from "~/server/speed2Lead/agent/scheduling/stateUpdate";

export type LegacyConstraintFields = {
  partOfDay?: SchedulingPartOfDay;
  rejectedPartOfDay?: SchedulingPartOfDay[];
  rejectedSlotStarts?: string[];
  searchAfterMinutes?: number;
  searchBeforeMinutes?: number;
  earliestAllowedMinutes?: number;
  latestAllowedMinutes?: number;
  anchorTimeMinutes?: number;
  availabilityAttempts?: number;
};

function legacyPartToPreference(part?: SchedulingPartOfDay): AvailabilityPreference | undefined {
  switch (part) {
    case "morning":
      return "morning";
    case "afternoon":
      return "afternoon";
    case "evening":
      return "evening";
    case "full_day":
      return "full_day";
    default:
      return undefined;
  }
}

export function toCanonicalSchedulingState(
  legacy?: SchedulingState,
): CanonicalSchedulingState & LegacyConstraintFields {
  if (!legacy) return { status: "idle" };

  const availabilityPreference =
    legacy.availabilityPreference ??
    legacyPartToPreference(legacy.partOfDay) ??
    (legacy.exactTimeMinutes != null ? "exact_time" : undefined);

  return {
    status: legacy.status,
    requestedDate: legacy.requestedDate ?? legacy.centralDate,
    availabilityPreference,
    exactTimeMinutes: legacy.exactTimeMinutes,
    activeRequestKey: legacy.activeRequestKey,
    offeredSlots: legacy.offeredSlots,
    lastPresentedOfferKey: legacy.lastPresentedOfferKey ?? legacy.lastOfferedSlotKey,
    selectedStart: legacy.selectedStart,
    calendarEventId: legacy.calendarEventId,
    googleMeetUrl: legacy.googleMeetUrl,
    calendarUnavailable: legacy.calendarUnavailable,
    providerFailureReason: legacy.providerFailureReason,
    bookingPending: legacy.bookingPending,
    partOfDay: legacy.partOfDay,
    rejectedPartOfDay: legacy.rejectedPartOfDay,
    rejectedSlotStarts: legacy.rejectedSlotStarts,
    searchAfterMinutes: legacy.searchAfterMinutes,
    searchBeforeMinutes: legacy.searchBeforeMinutes,
    earliestAllowedMinutes: legacy.earliestAllowedMinutes,
    latestAllowedMinutes: legacy.latestAllowedMinutes,
    availabilityAttempts: legacy.availabilityAttempts,
    anchorTimeMinutes: legacy.anchorTimeMinutes,
  };
}

export function fromCanonicalSchedulingState(
  canonical: CanonicalSchedulingState & LegacyConstraintFields,
): SchedulingState {
  const partOfDay: SchedulingPartOfDay | undefined =
    canonical.partOfDay ??
    (canonical.availabilityPreference === "morning"
      ? "morning"
      : canonical.availabilityPreference === "afternoon"
        ? "afternoon"
        : canonical.availabilityPreference === "evening"
          ? "evening"
          : canonical.availabilityPreference === "full_day" ||
              canonical.availabilityPreference === "earliest"
            ? "full_day"
            : undefined);

  return {
    status: canonical.status,
    requestedDate: canonical.requestedDate,
    availabilityPreference: canonical.availabilityPreference,
    exactTimeMinutes: canonical.exactTimeMinutes,
    centralDate: canonical.requestedDate,
    partOfDay,
    anchorTimeMinutes: canonical.anchorTimeMinutes,
    activeRequestKey: canonical.activeRequestKey,
    offeredSlots: canonical.offeredSlots,
    lastPresentedOfferKey: canonical.lastPresentedOfferKey,
    lastOfferedSlotKey: canonical.lastPresentedOfferKey,
    selectedStart: canonical.selectedStart,
    calendarEventId: canonical.calendarEventId,
    googleMeetUrl: canonical.googleMeetUrl,
    calendarUnavailable: canonical.calendarUnavailable,
    providerFailureReason: canonical.providerFailureReason,
    bookingPending: canonical.bookingPending,
    rejectedPartOfDay: canonical.rejectedPartOfDay,
    rejectedSlotStarts: canonical.rejectedSlotStarts,
    searchAfterMinutes: canonical.searchAfterMinutes,
    searchBeforeMinutes: canonical.searchBeforeMinutes,
    earliestAllowedMinutes: canonical.earliestAllowedMinutes,
    latestAllowedMinutes: canonical.latestAllowedMinutes,
    availabilityAttempts: canonical.availabilityAttempts,
  };
}

export function invalidateOffersForRequestChange(
  state: CanonicalSchedulingState & LegacyConstraintFields,
  nextRequestKey: string,
): CanonicalSchedulingState & LegacyConstraintFields {
  if (state.activeRequestKey === nextRequestKey) {
    return state;
  }
  const priorDate = state.requestedDate;
  const nextDate = nextRequestKey.match(/^date:([^|]+)/)?.[1];
  const dateChanged = priorDate != null && nextDate != null && priorDate !== nextDate;
  return {
    ...state,
    activeRequestKey: nextRequestKey,
    offeredSlots: undefined,
    lastPresentedOfferKey: undefined,
    rejectedPartOfDay: dateChanged ? [] : state.rejectedPartOfDay,
    rejectedSlotStarts: dateChanged ? undefined : state.rejectedSlotStarts,
    status: state.status === "slots_offered" ? "idle" : state.status,
  };
}

export function buildRequestFromCanonicalState(
  state: CanonicalSchedulingState & LegacyConstraintFields,
  timezone: string,
  businessHours: import("~/server/appointmentLifecycle/consultationConfig").ConsultationBusinessHours,
  meetingDurationMinutes: number,
): SchedulingRequest | null {
  if (!state.availabilityPreference) {
    return null;
  }
  if (state.availabilityPreference !== "earliest" && !state.requestedDate) {
    return null;
  }

  const normalized = normalizeImpossibleBounds(state);

  return {
    timezone,
    requestedDate: normalized.requestedDate,
    availabilityPreference: normalized.availabilityPreference!,
    exactTimeMinutes: normalized.exactTimeMinutes,
    lowerTimeBound: normalized.searchAfterMinutes ?? normalized.earliestAllowedMinutes,
    upperTimeBound: normalized.searchBeforeMinutes ?? normalized.latestAllowedMinutes,
    anchorTime: normalized.anchorTimeMinutes,
    businessHours,
    meetingDurationMinutes,
  };
}
