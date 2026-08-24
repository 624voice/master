import {
  CONSULTATION_TIMEZONE,
  getConsultationBusinessHours,
  getConsultationDurationMinutes,
} from "~/server/appointmentLifecycle/consultationConfig";
import {
  buildClosedDayCopy,
  buildExactUnavailableCopy,
  buildNeedDateCopy,
  buildNoAvailabilityCopy,
  buildProviderConflictCopy,
  buildSlotOfferCopy,
} from "~/server/scheduling/copy";
import { filterAndRankSlots } from "~/server/scheduling/filterRank";
import {
  buildSchedulingRequestFromState,
  mergeIntentIntoState,
  parseSchedulingIntentUpdate,
} from "~/server/scheduling/intentParser";
import { bookProviderSlot, queryProviderAvailability } from "~/server/scheduling/provider";
import {
  businessDatesForward,
  resolveRangeForRequest,
  tomorrowOrTodayCentral,
} from "~/server/scheduling/rangeResolver";
import {
  buildRangeRequestKey,
  buildSchedulingRequestKey,
  offerSetKey,
} from "~/server/scheduling/requestKey";
import {
  detectSchedulingConstraints,
  filterSlotsForSchedulingState,
  hasExplicitExactTimeRequest,
  resolveOfferedSlotSelectionCandidate,
  resolveRequestedMinutesFromMessage,
} from "~/server/speed2Lead/schedulingContext";
import {
  looksLikeSlotSelection,
} from "~/server/scheduling/selection";
import { fromCanonicalSchedulingState, invalidateOffersForRequestChange } from "~/server/scheduling/state";
import type { LegacyConstraintFields } from "~/server/scheduling/state";
import {
  applyBookingTraceFields,
  createEmptyTrace,
  inferOfferPresentationType,
  inferResponseSource,
  inferZeroSlotReason,
  logSchedulingTrace,
} from "~/server/scheduling/trace";
import type {
  BookingCustomer,
  CanonicalSchedulingState,
  ProcessSchedulingTurnInput,
  SchedulingRequest,
  SchedulingTurnResult,
} from "~/server/scheduling/types";
import {
  isConfiguredBusinessDay,
  resolveAvailabilityRange,
  tomorrowCentralDate,
} from "~/server/speed2Lead/schedulingRange";

const FORWARD_SEARCH_DAYS = 14;

function applyConstraintFilter(
  slots: string[],
  legacyScheduling?: ReturnType<typeof fromCanonicalSchedulingState>,
): string[] {
  if (!legacyScheduling || slots.length === 0) return slots;
  return filterSlotsForSchedulingState(slots, legacyScheduling);
}

function detectSchedulingIntent(message: string): boolean {
  return /\b(when|schedule|book|appointment|available|availability|tomorrow|monday|tuesday|wednesday|thursday|friday|morning|afternoon|time|meet|talk|first\s+available|anytime|flexible)\b/i.test(
    message,
  );
}

async function fetchSlotsForRequest(
  request: SchedulingRequest,
  now: Date,
  legacyScheduling?: ReturnType<typeof fromCanonicalSchedulingState>,
  maxOffer = 3,
): Promise<{
  ok: boolean;
  rawSlots: string[];
  filteredSlots: string[];
  queryStartIso?: string;
  queryEndIso?: string;
  reason?: string;
}> {
  if (request.availabilityPreference === "earliest" && !request.requestedDate) {
    const startDate = tomorrowCentralDate(now);
    const dates = businessDatesForward(startDate, FORWARD_SEARCH_DAYS, request.timezone);
    for (const date of dates) {
      const dayRequest: SchedulingRequest = {
        ...request,
        requestedDate: date,
        availabilityPreference: "earliest",
      };
      const resolved = resolveRangeForRequest(dayRequest, now);
      if ("error" in resolved) continue;
      const provider = await queryProviderAvailability({
        rangeStart: resolved.rangeStart,
        rangeEnd: resolved.rangeEnd,
        now,
      });
      if (!provider.ok) {
        return {
          ok: false,
          rawSlots: [],
          filteredSlots: [],
          queryStartIso: provider.queryStartIso,
          queryEndIso: provider.queryEndIso,
          reason: provider.reason,
        };
      }
      const filtered = applyConstraintFilter(
        filterAndRankSlots({
          rawSlots: provider.slots,
          request: dayRequest,
          maxOffer,
        }),
        legacyScheduling,
      );
      if (filtered.length > 0) {
        return {
          ok: true,
          rawSlots: provider.slots,
          filteredSlots: filtered,
          queryStartIso: provider.queryStartIso,
          queryEndIso: provider.queryEndIso,
        };
      }
    }
    return { ok: true, rawSlots: [], filteredSlots: [] };
  }

  const resolved = resolveRangeForRequest(request, now);
  if ("error" in resolved) {
    return { ok: false, rawSlots: [], filteredSlots: [], reason: resolved.error };
  }

  const provider = await queryProviderAvailability({
    rangeStart: resolved.rangeStart,
    rangeEnd: resolved.rangeEnd,
    now,
  });

  if (!provider.ok) {
    return {
      ok: false,
      rawSlots: [],
      filteredSlots: [],
      queryStartIso: provider.queryStartIso,
      queryEndIso: provider.queryEndIso,
      reason: provider.reason,
    };
  }

  const filtered = applyConstraintFilter(
    filterAndRankSlots({
      rawSlots: provider.slots,
      request: {
        ...request,
        requestedDate: resolved.centralDate ?? request.requestedDate,
      },
      maxOffer,
    }),
    legacyScheduling,
  );

  return {
    ok: true,
    rawSlots: provider.slots,
    filteredSlots: filtered,
    queryStartIso: provider.queryStartIso,
    queryEndIso: provider.queryEndIso,
  };
}

function finalizeOfferResult(args: {
  state: CanonicalSchedulingState;
  requestKey: string;
  requestKeyBefore?: string;
  filteredSlots: string[];
  rawProviderSlotCount: number;
  providerInvoked: boolean;
  queryStartIso?: string;
  queryEndIso?: string;
  trace: ReturnType<typeof createEmptyTrace>;
}): SchedulingTurnResult {
  const requestChanged = args.requestKeyBefore !== args.requestKey;
  const presentation = inferOfferPresentationType({
    slots: args.filteredSlots,
    lastPresentedOfferKey: args.state.lastPresentedOfferKey,
    requestKeyChanged: requestChanged,
  });

  const nextState: CanonicalSchedulingState =
    args.filteredSlots.length > 0
      ? {
          ...args.state,
          activeRequestKey: args.requestKey,
          offeredSlots: args.filteredSlots,
          status: "slots_offered",
        }
      : {
          ...args.state,
          activeRequestKey: args.requestKey,
          offeredSlots: undefined,
          status: "idle",
        };

  args.trace.providerInvoked = args.providerInvoked;
  args.trace.queryStartIso = args.queryStartIso;
  args.trace.queryEndIso = args.queryEndIso;
  args.trace.rawProviderSlotCount = args.rawProviderSlotCount;
  args.trace.filteredSlotCount = args.filteredSlots.length;
  args.trace.finalOfferedSlotCount = args.filteredSlots.length;
  args.trace.finalOfferedSlots = args.filteredSlots;
  args.trace.requestKeyAfter = args.requestKey;
  args.trace.offerPresentationType = presentation;
  args.trace.responseSource = inferResponseSource(args.providerInvoked, false);
  args.trace.zeroSlotReason = inferZeroSlotReason({
    providerInvoked: args.providerInvoked,
    rawProviderSlotCount: args.rawProviderSlotCount,
    filteredSlotCount: args.filteredSlots.length,
    providerOk: true,
  });

  if (args.filteredSlots.length === 0) {
    return {
      outcome: "NO_AVAILABILITY",
      state: nextState,
      offeredSlots: [],
      offerPresentationType: "no_availability",
      trace: args.trace,
    };
  }

  return {
    outcome: "OFFERED_SLOTS",
    state: nextState,
    offeredSlots: args.filteredSlots,
    offerPresentationType: presentation,
    trace: args.trace,
  };
}

/** Single deterministic scheduling turn processor — reusable across agents. */
export async function processSchedulingTurn(
  input: ProcessSchedulingTurnInput,
): Promise<SchedulingTurnResult> {
  const now = input.now;
  const trace = createEmptyTrace(now);
  trace.requestKeyBefore = input.state.activeRequestKey;

  let state: CanonicalSchedulingState & LegacyConstraintFields = { ...input.state };
  const priorRequestDate =
    input.state.activeRequestKey?.match(/^date:([^|]+)/)?.[1] ?? input.state.requestedDate;
  let schedulingDateChanged = false;
  if (state.status === "confirmed") {
    return {
      outcome: "BOOKED",
      state,
      offeredSlots: [],
      offerPresentationType: "booked",
      selectedStart: state.selectedStart,
      eventId: state.calendarEventId,
      trace,
    };
  }

  let legacyScheduling = fromCanonicalSchedulingState(state);
  if (input.explicitBookStart && input.bookCustomer) {
    const booked = await bookProviderSlot({
      start: input.explicitBookStart,
      customer: input.bookCustomer,
      now,
    });
    applyBookingTraceFields(trace, {
      selectedStart: input.explicitBookStart,
      selectionResolved: true,
      booked,
    });
    if (booked.ok) {
      const result: SchedulingTurnResult = {
        outcome: "BOOKED",
        state: {
          ...state,
          status: "confirmed",
          selectedStart: booked.selectedStart,
          calendarEventId: booked.eventId,
          offeredSlots: undefined,
        },
        offeredSlots: [],
        offerPresentationType: "booked",
        selectedStart: booked.selectedStart,
        eventId: booked.eventId,
        lifecycleConfirmationSent: booked.lifecycleConfirmationSent,
        trace,
      };
      logSchedulingTrace(result.trace, input.tracePhoneSuffix);
      return result;
    }
    const result: SchedulingTurnResult = {
      outcome:
        booked.failureType === "provider_conflict" ? "PROVIDER_CONFLICT" : "PROVIDER_ERROR",
      state,
      offeredSlots: legacyScheduling.offeredSlots ?? [],
      offerPresentationType: "none",
      trace,
    };
    logSchedulingTrace(result.trace, input.tracePhoneSuffix);
    return result;
  }

  const intentPatch = parseSchedulingIntentUpdate(input.inboundMessage, state, now);
  state = mergeIntentIntoState(state, intentPatch);

  if (input.availabilityInput?.centralDate) {
    schedulingDateChanged =
      priorRequestDate != null &&
      input.availabilityInput.centralDate !== priorRequestDate;
    state = {
      ...state,
      requestedDate: input.availabilityInput.centralDate,
      availabilityPreference:
        input.availabilityInput.partOfDay === "morning"
          ? "morning"
          : input.availabilityInput.partOfDay === "afternoon" ||
              input.availabilityInput.partOfDay === "evening"
            ? "afternoon"
            : input.availabilityInput.partOfDay === "full_day"
              ? "full_day"
              : state.availabilityPreference,
      partOfDay: input.availabilityInput.partOfDay ?? state.partOfDay,
      rejectedPartOfDay: schedulingDateChanged ? [] : state.rejectedPartOfDay,
      rejectedSlotStarts: schedulingDateChanged ? undefined : state.rejectedSlotStarts,
      offeredSlots: schedulingDateChanged ? undefined : state.offeredSlots,
    };
  }

  legacyScheduling = fromCanonicalSchedulingState(state);
  const priorDate = legacyScheduling.centralDate;
  const constraintPatch = detectSchedulingConstraints(
    input.inboundMessage,
    legacyScheduling,
    legacyScheduling.offeredSlots ?? [],
  );
  if (
    constraintPatch.centralDate != null &&
    priorRequestDate != null &&
    constraintPatch.centralDate !== priorRequestDate
  ) {
    schedulingDateChanged = true;
  }
  legacyScheduling = {
    ...legacyScheduling,
    ...constraintPatch,
    rejectedPartOfDay: schedulingDateChanged
      ? (constraintPatch.rejectedPartOfDay ?? [])
      : (constraintPatch.rejectedPartOfDay ?? legacyScheduling.rejectedPartOfDay),
    rejectedSlotStarts: schedulingDateChanged
      ? constraintPatch.rejectedSlotStarts
      : (constraintPatch.rejectedSlotStarts ?? legacyScheduling.rejectedSlotStarts),
  };
  state = {
    ...state,
    partOfDay: constraintPatch.partOfDay ?? legacyScheduling.partOfDay,
    rejectedPartOfDay: schedulingDateChanged
      ? (constraintPatch.rejectedPartOfDay ?? [])
      : (legacyScheduling.rejectedPartOfDay ?? state.rejectedPartOfDay),
    rejectedSlotStarts: legacyScheduling.rejectedSlotStarts,
    searchAfterMinutes: legacyScheduling.searchAfterMinutes,
    searchBeforeMinutes: legacyScheduling.searchBeforeMinutes,
    earliestAllowedMinutes: legacyScheduling.earliestAllowedMinutes,
    latestAllowedMinutes: legacyScheduling.latestAllowedMinutes,
    requestedDate: constraintPatch.centralDate ?? state.requestedDate,
    availabilityPreference:
      constraintPatch.partOfDay === "morning"
        ? "morning"
        : constraintPatch.partOfDay === "afternoon"
          ? "afternoon"
          : constraintPatch.partOfDay === "evening"
            ? "afternoon"
            : state.availabilityPreference,
  };

  trace.normalizedRequestedDate = state.requestedDate;
  trace.normalizedPreference = state.availabilityPreference;
  trace.normalizedExactTime = state.exactTimeMinutes;

  const offered = state.offeredSlots ?? [];
  if (offered.length > 0 && resolveOfferedSlotSelectionCandidate(input.inboundMessage, offered)) {
    const selected = resolveOfferedSlotSelectionCandidate(input.inboundMessage, offered);
    if (selected && input.bookCustomer) {
      const booked = await bookProviderSlot({
        start: selected,
        customer: input.bookCustomer,
        now,
      });
      applyBookingTraceFields(trace, {
        selectedStart: selected,
        selectionResolved: true,
        booked,
      });
      if (booked.ok) {
        const bookedState: CanonicalSchedulingState = {
          ...state,
          status: "confirmed",
          selectedStart: booked.selectedStart,
          calendarEventId: booked.eventId,
          offeredSlots: undefined,
          bookingPending: false,
        };
        const result: SchedulingTurnResult = {
          outcome: "BOOKED",
          state: bookedState,
          offeredSlots: [],
          offerPresentationType: "booked",
          selectedStart: booked.selectedStart,
          eventId: booked.eventId,
          lifecycleConfirmationSent: booked.lifecycleConfirmationSent,
          trace,
        };
        logSchedulingTrace(result.trace, input.tracePhoneSuffix);
        return result;
      }
      const result: SchedulingTurnResult = {
        outcome:
          booked.failureType === "provider_conflict" ? "PROVIDER_CONFLICT" : "PROVIDER_ERROR",
        state: { ...state, bookingPending: false },
        offeredSlots: offered,
        offerPresentationType: "none",
        trace,
      };
      logSchedulingTrace(result.trace, input.tracePhoneSuffix);
      return result;
    }
  }

  const timezone = CONSULTATION_TIMEZONE;
  const businessHours = getConsultationBusinessHours();
  const meetingDurationMinutes = getConsultationDurationMinutes();

  if (state.requestedDate) {
    const minutes = resolveRequestedMinutesFromMessage(input.inboundMessage, offered);
    if (
      minutes != null &&
      hasExplicitExactTimeRequest(
        input.inboundMessage,
        fromCanonicalSchedulingState(state),
      )
    ) {
      state = {
        ...state,
        availabilityPreference: "exact_time",
        exactTimeMinutes: minutes,
      };
    }
  }

  const maxOffer = input.maxOffer ?? 3;

  if (input.availabilityInput?.rangeStart && input.availabilityInput.rangeEnd) {
    const resolved = resolveAvailabilityRange(input.availabilityInput, now);
    if ("error" in resolved) {
      trace.zeroSlotReason = "wrong_date";
      trace.responseSource = "no_provider";
      return {
        outcome: "NEED_DATE",
        state,
        offeredSlots: [],
        offerPresentationType: "none",
        trace,
      };
    }

    const requestKey = buildRangeRequestKey(
      input.availabilityInput.rangeStart,
      input.availabilityInput.rangeEnd,
    );
    state = {
      ...invalidateOffersForRequestChange(state, requestKey),
      availabilityPreference: "earliest",
    };
    legacyScheduling = fromCanonicalSchedulingState(state);

    const provider = await queryProviderAvailability({
      rangeStart: resolved.rangeStart,
      rangeEnd: resolved.rangeEnd,
      now,
    });
    trace.providerInvoked = true;

    if (!provider.ok) {
      trace.zeroSlotReason = "provider_error";
      trace.responseSource = "fresh_fetch";
      return {
        outcome: "PROVIDER_ERROR",
        state: { ...state, calendarUnavailable: true, providerFailureReason: provider.reason },
        offeredSlots: [],
        offerPresentationType: "none",
        trace,
      };
    }

    const rangeRequest: SchedulingRequest = {
      timezone,
      availabilityPreference: "earliest",
      businessHours,
      meetingDurationMinutes,
    };
    const filtered = applyConstraintFilter(
      filterAndRankSlots({
        rawSlots: provider.slots,
        request: rangeRequest,
        maxOffer,
      }),
      legacyScheduling,
    );

    const result = finalizeOfferResult({
      state,
      requestKey,
      requestKeyBefore: trace.requestKeyBefore,
      filteredSlots: filtered,
      rawProviderSlotCount: provider.slots.length,
      providerInvoked: true,
      queryStartIso: provider.queryStartIso,
      queryEndIso: provider.queryEndIso,
      trace,
    });
    logSchedulingTrace(result.trace, input.tracePhoneSuffix);
    return result;
  }

  const request = buildSchedulingRequestFromState(state, timezone, businessHours, meetingDurationMinutes);
  if (!request) {
    if (!detectSchedulingIntent(input.inboundMessage)) {
      return {
        outcome: "NEED_DATE",
        state,
        offeredSlots: [],
        offerPresentationType: "none",
        trace,
      };
    }
    trace.responseSource = "no_provider";
    return {
      outcome: "NEED_DATE",
      state,
      offeredSlots: [],
      offerPresentationType: "none",
      trace,
    };
  }

  const requestKey = buildSchedulingRequestKey(request);
  state = invalidateOffersForRequestChange(state, requestKey);
  legacyScheduling = fromCanonicalSchedulingState(state);

  if (request.requestedDate && !isConfiguredBusinessDay(request.requestedDate)) {
    trace.zeroSlotReason = "wrong_date";
    return {
      outcome: "NEED_DATE",
      state,
      offeredSlots: [],
      offerPresentationType: "no_availability",
      closedDayDate: request.requestedDate,
      trace,
    };
  }

  if (request.availabilityPreference === "exact_time" && request.exactTimeMinutes != null) {
    trace.bookingAttempted = Boolean(input.bookCustomer);
    const fetched = await fetchSlotsForRequest(request, now, legacyScheduling, maxOffer);
    trace.providerInvoked = true;
    if (!fetched.ok) {
      trace.zeroSlotReason = "provider_error";
      return {
        outcome: "PROVIDER_ERROR",
        state: { ...state, calendarUnavailable: true, providerFailureReason: fetched.reason },
        offeredSlots: [],
        offerPresentationType: "none",
        trace,
      };
    }
    const exactMatch = fetched.filteredSlots;
    const shouldAutoBookExact =
      exactMatch.length === 1 &&
      input.bookCustomer &&
      !/\b(around|about|roughly|maybe|probably|like|closer|near)\b/i.test(
        input.inboundMessage.toLowerCase(),
      );
    if (shouldAutoBookExact) {
      const booked = await bookProviderSlot({
        start: exactMatch[0]!,
        customer: input.bookCustomer,
        now,
      });
      applyBookingTraceFields(trace, {
        selectedStart: exactMatch[0],
        selectionResolved: true,
        booked,
      });
      if (booked.ok) {
        const result: SchedulingTurnResult = {
          outcome: "BOOKED",
          state: {
            ...state,
            status: "confirmed",
            selectedStart: booked.selectedStart,
            calendarEventId: booked.eventId,
          },
          offeredSlots: [],
          offerPresentationType: "booked",
          selectedStart: booked.selectedStart,
          eventId: booked.eventId,
          lifecycleConfirmationSent: booked.lifecycleConfirmationSent,
          trace,
        };
        logSchedulingTrace(result.trace, input.tracePhoneSuffix);
        return result;
      }
      const result: SchedulingTurnResult = {
        outcome:
          booked.failureType === "provider_conflict" ? "PROVIDER_CONFLICT" : "PROVIDER_ERROR",
        state,
        offeredSlots: fetched.filteredSlots,
        offerPresentationType: "none",
        trace,
      };
      logSchedulingTrace(result.trace, input.tracePhoneSuffix);
      return result;
    }
    if (exactMatch.length === 0) {
      const altRequest: SchedulingRequest = {
        ...request,
        availabilityPreference: "full_day",
      };
      const altFetched = await fetchSlotsForRequest(altRequest, now, legacyScheduling, maxOffer);
      const alternatives = altFetched.filteredSlots.slice(0, 3);
      trace.zeroSlotReason =
        altFetched.rawSlots.length > 0 && alternatives.length === 0
          ? "constraint_filter"
          : "provider_empty";
      return {
        outcome: "NO_AVAILABILITY",
        state: {
          ...state,
          activeRequestKey: requestKey,
          exactTimeMinutes: request.exactTimeMinutes,
          availabilityPreference: "exact_time",
          status: alternatives.length > 0 ? "slots_offered" : "idle",
          offeredSlots: alternatives.length > 0 ? alternatives : undefined,
        },
        offeredSlots: alternatives,
        offerPresentationType: alternatives.length > 0 ? "changed_offer" : "no_availability",
        trace: {
          ...trace,
          providerInvoked: true,
          rawProviderSlotCount: fetched.rawSlots.length,
          filteredSlotCount: 0,
          finalOfferedSlotCount: alternatives.length,
          finalOfferedSlots: alternatives,
          requestKeyAfter: requestKey,
          zeroSlotReason: trace.zeroSlotReason,
          responseSource: "fresh_fetch",
        },
      };
    }
    return finalizeOfferResult({
      state,
      requestKey,
      requestKeyBefore: trace.requestKeyBefore,
      filteredSlots: exactMatch,
      rawProviderSlotCount: fetched.rawSlots.length,
      providerInvoked: true,
      queryStartIso: fetched.queryStartIso,
      queryEndIso: fetched.queryEndIso,
      trace,
    });
  }

  const fetched = await fetchSlotsForRequest(request, now, legacyScheduling, maxOffer);
  trace.providerInvoked = true;

  if (!fetched.ok) {
    trace.zeroSlotReason = "provider_error";
    trace.responseSource = "fresh_fetch";
    return {
      outcome: "PROVIDER_ERROR",
      state: { ...state, calendarUnavailable: true, providerFailureReason: fetched.reason },
      offeredSlots: [],
      offerPresentationType: "none",
      trace,
    };
  }

  const result = finalizeOfferResult({
    state,
    requestKey,
    requestKeyBefore: trace.requestKeyBefore,
    filteredSlots: fetched.filteredSlots,
    rawProviderSlotCount: fetched.rawSlots.length,
    providerInvoked: true,
    queryStartIso: fetched.queryStartIso,
    queryEndIso: fetched.queryEndIso,
    trace,
  });

  logSchedulingTrace(result.trace, input.tracePhoneSuffix);
  return result;
}

export function buildReplyFromSchedulingResult(result: SchedulingTurnResult): string | null {
  if (result.closedDayDate) {
    return buildClosedDayCopy(result.closedDayDate);
  }

  switch (result.outcome) {
    case "NEED_DATE":
      return buildNeedDateCopy();
    case "NO_AVAILABILITY":
      if (!result.trace.providerInvoked) return buildNeedDateCopy();
      if (result.state.exactTimeMinutes != null) {
        return buildExactUnavailableCopy(result.offeredSlots);
      }
      return buildNoAvailabilityCopy(Boolean(result.state.requestedDate));
    case "OFFERED_SLOTS":
    case "EXACT_TIME_AVAILABLE":
      return buildSlotOfferCopy(result.offeredSlots, result.offerPresentationType);
    case "PROVIDER_CONFLICT":
      return buildProviderConflictCopy(result.offeredSlots);
    case "INVALID_SELECTION":
      return buildExactUnavailableCopy(result.offeredSlots);
    case "BOOKED":
      return null;
    case "PROVIDER_ERROR":
      return "I'm having trouble pulling my calendar up right now — I still have your timing noted.";
    default:
      return null;
  }
}

export function markOfferPresented(state: CanonicalSchedulingState, slots: string[]): CanonicalSchedulingState {
  if (slots.length === 0) return state;
  return {
    ...state,
    lastPresentedOfferKey: offerSetKey(slots),
  };
}

export { buildSchedulingRequestKey, offerSetKey };
