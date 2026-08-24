import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import type {
  BookingFailureStage,
  OfferPresentationType,
  ResponseSource,
  SchedulingTrace,
  ZeroSlotReason,
} from "~/server/scheduling/types";
import type { ProviderBookingResult } from "~/server/scheduling/provider";
import { applyBookingStageSnapshotToSchedulingTrace } from "~/server/scheduling/bookingStageTrace";

export function createEmptyTrace(now: Date): SchedulingTrace {
  const parts = parseCentralParts(now, CONSULTATION_TIMEZONE);
  return {
    centralNow: {
      date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
      time: `${parts.hour}:${String(parts.minute).padStart(2, "0")}`,
      timezone: CONSULTATION_TIMEZONE,
    },
    providerInvoked: false,
    rawProviderSlotCount: 0,
    filteredSlotCount: 0,
    finalOfferedSlotCount: 0,
    finalOfferedSlots: [],
    responseSource: "no_provider",
    offerPresentationType: "none",
    bookingAttempted: false,
    eventIdPresent: false,
  };
}

export function logSchedulingTrace(trace: SchedulingTrace, phoneSuffix?: string): void {
  if (!phoneSuffix) return;
  console.log(
    JSON.stringify({
      component: "schedulingService",
      event: "scheduling_trace",
      at: new Date().toISOString(),
      phoneSuffix: `***${phoneSuffix}`,
      ...trace,
    }),
  );
}

function inferBookingFailureStage(booked: Extract<ProviderBookingResult, { ok: false }>): BookingFailureStage {
  if (booked.diagnostics?.failureStage) {
    return booked.diagnostics.failureStage;
  }
  if (booked.failureType === "provider_conflict") {
    return "recheck_failed";
  }
  if (booked.diagnostics?.createAttempted) {
    return "insert_failed";
  }
  return "unknown";
}

/** Populate booking-specific trace fields from a provider booking attempt. */
export function applyBookingTraceFields(
  trace: SchedulingTrace,
  args: {
    selectedStart?: string;
    selectionResolved?: boolean;
    booked: ProviderBookingResult;
  },
): void {
  trace.bookingAttempted = true;
  trace.selectedStart = args.selectedStart;
  trace.selectionResolved = args.selectionResolved;

  if (args.booked.ok) {
    trace.eventIdPresent = true;
    trace.bookingResultType = "BOOKED";
    trace.providerRecheckAttempted = true;
    trace.providerRecheckResult = "succeeded";
    trace.createEventAttempted = true;
    trace.createEventResult = "succeeded";
    trace.finalBookingReason = "booked";
    trace.bookProviderSlotEntered = true;
    trace.bookConsultationEntered = true;
    return;
  }

  const diagnostics = args.booked.diagnostics;
  if (diagnostics?.stageSnapshot) {
    applyBookingStageSnapshotToSchedulingTrace(trace, diagnostics.stageSnapshot);
  }

  trace.bookingResultType =
    args.booked.failureType === "provider_conflict" ? "PROVIDER_CONFLICT" : "PROVIDER_ERROR";
  trace.finalBookingReason = diagnostics?.stageSnapshot?.finalBookingReason ?? args.booked.reason;
  trace.detailedFailureStage =
    diagnostics?.detailedFailureStage ?? diagnostics?.stageSnapshot?.failureStage;
  if (!trace.providerRecheckAttempted) {
    trace.providerRecheckAttempted = diagnostics?.recheckAttempted ?? true;
  }
  if (!trace.providerRecheckResult) {
    trace.providerRecheckResult =
      diagnostics?.recheckSucceeded === true
        ? "succeeded"
        : diagnostics?.recheckSucceeded === false
          ? "failed"
          : args.booked.failureType === "provider_conflict"
            ? "failed"
            : "unknown";
  }
  if (trace.createEventAttempted == null) {
    trace.createEventAttempted = diagnostics?.createAttempted ?? false;
  }
  if (!trace.createEventResult) {
    trace.createEventResult = diagnostics?.createSucceeded
      ? "succeeded"
      : diagnostics?.createAttempted
        ? "failed"
        : "not_attempted";
  }
  if (!trace.failureStage) {
    trace.failureStage = inferBookingFailureStage(args.booked);
  }
  trace.providerHttpStatus = trace.providerHttpStatus ?? diagnostics?.insertHttpStatus;
  trace.providerErrorReason = trace.providerErrorReason ?? diagnostics?.googleErrorReason;
  trace.providerErrorMessage = trace.providerErrorMessage ?? diagnostics?.googleErrorMessage;
  trace.sendUpdatesUsed = trace.sendUpdatesUsed ?? diagnostics?.sendUpdatesUsed;
  trace.bookingAttendeeCount = trace.bookingAttendeeCount ?? diagnostics?.attendeeCount;
  trace.failureReason = trace.failureReason ?? args.booked.reason;
}

export function inferZeroSlotReason(args: {
  providerInvoked: boolean;
  rawProviderSlotCount: number;
  filteredSlotCount: number;
  providerOk: boolean;
}): ZeroSlotReason | undefined {
  if (!args.providerInvoked) return "never_called";
  if (!args.providerOk) return "provider_error";
  if (args.rawProviderSlotCount === 0) return "provider_empty";
  if (args.filteredSlotCount === 0) return "constraint_filter";
  return undefined;
}

export function inferResponseSource(providerInvoked: boolean, reusedStale: boolean): ResponseSource {
  if (!providerInvoked) return "no_provider";
  if (reusedStale) return "stale_state";
  return "fresh_fetch";
}

export function inferOfferPresentationType(args: {
  slots: string[];
  lastPresentedOfferKey?: string;
  requestKeyChanged: boolean;
}): OfferPresentationType {
  if (args.slots.length === 0) return "no_availability";
  const nextKey = [...args.slots].sort().join("|");
  if (!args.lastPresentedOfferKey) return "first_offer";
  if (args.requestKeyChanged) return "changed_offer";
  if (args.lastPresentedOfferKey === nextKey) return "repeat_offer";
  return "changed_offer";
}
