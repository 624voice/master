import type { SchedulingPartOfDay, SchedulingState } from "~/server/speed2Lead/sessionMemoryTypes";
import type {
  AvailabilityPreference,
  CanonicalSchedulingState,
} from "~/server/scheduling/types";

function legacyPartToPreference(part?: SchedulingPartOfDay): AvailabilityPreference | undefined {
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

export function toCanonicalSchedulingState(
  legacy?: SchedulingState,
): CanonicalSchedulingState {
  if (!legacy) return { status: "idle" };

  const availabilityPreference =
    legacy.availabilityPreference ??
    legacyPartToPreference(legacy.partOfDay) ??
    (legacy.anchorTimeMinutes != null ? "exact_time" : undefined);

  return {
    status: legacy.status,
    requestedDate: legacy.requestedDate ?? legacy.centralDate,
    availabilityPreference,
    exactTimeMinutes: legacy.exactTimeMinutes ?? legacy.anchorTimeMinutes,
    activeRequestKey: legacy.activeRequestKey,
    offeredSlots: legacy.offeredSlots,
    lastPresentedOfferKey: legacy.lastPresentedOfferKey ?? legacy.lastOfferedSlotKey,
    selectedStart: legacy.selectedStart,
    calendarEventId: legacy.calendarEventId,
    calendarUnavailable: legacy.calendarUnavailable,
    providerFailureReason: legacy.providerFailureReason,
    bookingPending: legacy.bookingPending,
  };
}

export function fromCanonicalSchedulingState(
  canonical: CanonicalSchedulingState,
): SchedulingState {
  const partOfDay: SchedulingPartOfDay | undefined =
    canonical.availabilityPreference === "morning"
      ? "morning"
      : canonical.availabilityPreference === "afternoon"
        ? "afternoon"
        : canonical.availabilityPreference === "full_day" ||
            canonical.availabilityPreference === "earliest"
          ? "full_day"
          : undefined;

  return {
    status: canonical.status,
    requestedDate: canonical.requestedDate,
    availabilityPreference: canonical.availabilityPreference,
    exactTimeMinutes: canonical.exactTimeMinutes,
    centralDate: canonical.requestedDate,
    partOfDay,
    anchorTimeMinutes: canonical.exactTimeMinutes,
    activeRequestKey: canonical.activeRequestKey,
    offeredSlots: canonical.offeredSlots,
    lastPresentedOfferKey: canonical.lastPresentedOfferKey,
    lastOfferedSlotKey: canonical.lastPresentedOfferKey,
    selectedStart: canonical.selectedStart,
    calendarEventId: canonical.calendarEventId,
    calendarUnavailable: canonical.calendarUnavailable,
    providerFailureReason: canonical.providerFailureReason,
    bookingPending: canonical.bookingPending,
  };
}

export function invalidateOffersForRequestChange(
  state: CanonicalSchedulingState,
  nextRequestKey: string,
): CanonicalSchedulingState {
  if (state.activeRequestKey === nextRequestKey) {
    return state;
  }
  return {
    ...state,
    activeRequestKey: nextRequestKey,
    offeredSlots: undefined,
    lastPresentedOfferKey: undefined,
    status: state.status === "slots_offered" ? "idle" : state.status,
  };
}
