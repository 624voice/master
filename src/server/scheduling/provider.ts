import { getConsultationSlots } from "~/server/appointmentLifecycle/googleCalendar";
import { bookConsultation } from "~/server/appointmentLifecycle/bookConsultation";
import {
  supportsAttendeeInvites,
  type ConsultationBookingFailureDiagnostics,
} from "~/server/appointmentLifecycle/googleCalendar";
import {
  createBookingStageCollector,
  logBookingStageTrace,
  mapDetailedFailureStage,
  withBookingStageCollector,
  type BookingStageSnapshot,
  type DetailedBookingFailureStage,
} from "~/server/scheduling/bookingStageTrace";
import type { BookingCustomer } from "~/server/scheduling/types";
import type { BookingFailureStage } from "~/server/scheduling/types";

export type ProviderAvailabilityResult =
  | {
      ok: true;
      slots: string[];
      queryStartIso: string;
      queryEndIso: string;
      rawEventCount?: number;
    }
  | { ok: false; reason: string; queryStartIso: string; queryEndIso: string };

export async function queryProviderAvailability(args: {
  rangeStart: Date;
  rangeEnd: Date;
  now: Date;
  maxSlots?: number;
}): Promise<ProviderAvailabilityResult> {
  const queryStartIso = args.rangeStart.toISOString();
  const queryEndIso = args.rangeEnd.toISOString();
  const result = await getConsultationSlots({
    rangeStart: args.rangeStart,
    rangeEnd: args.rangeEnd,
    maxSlots: args.maxSlots ?? 48,
    now: args.now,
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      queryStartIso,
      queryEndIso,
    };
  }

  return {
    ok: true,
    slots: result.slots,
    queryStartIso,
    queryEndIso,
  };
}

export type ProviderBookingDiagnostics = ConsultationBookingFailureDiagnostics & {
  failureStage?: BookingFailureStage;
  detailedFailureStage?: DetailedBookingFailureStage;
  stageSnapshot?: BookingStageSnapshot;
};

function bookingFailureStage(
  reason: string,
  diagnostics?: ConsultationBookingFailureDiagnostics,
  detailed?: DetailedBookingFailureStage,
): BookingFailureStage {
  if (detailed) {
    return mapDetailedFailureStage(detailed);
  }
  if (reason === "slot_unavailable") return "recheck_failed";
  if (reason === "not_configured") return "not_configured";
  if (diagnostics?.createAttempted && !diagnostics.createSucceeded) return "insert_failed";
  return "unknown";
}

function detailedStageFromReason(reason: string): DetailedBookingFailureStage {
  switch (reason) {
    case "not_configured":
      return "not_configured";
    case "slot_unavailable":
      return "recheck_error";
    case "calendar_api_error":
      return "calendar_insert_error";
    case "conference_error":
      return "conference_creation_error";
    case "missing_event_id":
      return "missing_event_id";
    default:
      return "unknown_provider_error";
  }
}

export type ProviderBookingResult =
  | {
      ok: true;
      eventId: string;
      selectedStart: string;
      googleMeetUrl: string;
      lifecycleConfirmationSent?: boolean;
      stageSnapshot: BookingStageSnapshot;
    }
  | {
      ok: false;
      reason: string;
      failureType: "provider_conflict" | "provider_error" | "invalid_selection";
      diagnostics?: ProviderBookingDiagnostics;
    };

export async function bookProviderSlot(args: {
  start: string;
  customer: BookingCustomer;
  now: Date;
  phoneSuffix?: string;
  selectionResolved?: boolean;
}): Promise<ProviderBookingResult> {
  const phoneSuffix = args.phoneSuffix ?? args.customer.phone.slice(-4);
  const collector = createBookingStageCollector({
    selectedStart: args.start,
    selectionResolved: args.selectionResolved,
    phoneSuffix,
  });
  collector.bookProviderSlotEntered = true;
  collector.attendeeIncluded =
    supportsAttendeeInvites() && Boolean(args.customer.email?.trim());
  collector.attendeeCount = collector.attendeeIncluded ? 1 : 0;

  return withBookingStageCollector(collector, async () => {
    const booked = await bookConsultation({
      start: args.start,
      attendeeName: args.customer.name,
      attendeeEmail: args.customer.email,
      phone: args.customer.phone,
      businessName: args.customer.businessName,
      source: args.customer.source,
      notes: args.customer.notes,
      now: args.now,
    });

    const stageSnapshot: BookingStageSnapshot = { ...collector };
    logBookingStageTrace(collector);

    if (!booked.ok) {
      const detailedFailureStage =
        collector.failureStage ?? detailedStageFromReason(booked.reason);
      const diagnostics: ProviderBookingDiagnostics = booked.diagnostics
        ? {
            ...booked.diagnostics,
            failureStage: bookingFailureStage(booked.reason, booked.diagnostics, detailedFailureStage),
            detailedFailureStage,
            stageSnapshot,
          }
        : {
            recheckAttempted: booked.reason === "slot_unavailable",
            recheckSucceeded: booked.reason !== "slot_unavailable",
            createAttempted:
              booked.reason === "calendar_api_error" || booked.reason === "conference_error",
            createSucceeded: false,
            attendeeCount: collector.attendeeCount ?? 0,
            attendeeIncluded: collector.attendeeIncluded,
            failureStage: bookingFailureStage(booked.reason, undefined, detailedFailureStage),
            detailedFailureStage,
            stageSnapshot,
          };

      return {
        ok: false,
        reason: booked.reason,
        failureType:
          booked.reason === "slot_unavailable" ? "provider_conflict" : "provider_error",
        diagnostics,
      };
    }

    if (!booked.eventId || !booked.googleMeetUrl) {
      const detailedFailureStage: DetailedBookingFailureStage = "missing_event_id";
      return {
        ok: false,
        reason: "missing_event_id",
        failureType: "provider_error",
        diagnostics: {
          recheckAttempted: true,
          recheckSucceeded: true,
          createAttempted: true,
          createSucceeded: false,
          attendeeCount: args.customer.email ? 1 : 0,
          failureStage: "parse_failed",
          detailedFailureStage,
          stageSnapshot: {
            ...stageSnapshot,
            failureStage: detailedFailureStage,
            finalBookingReason: "missing_event_id",
          },
        },
      };
    }

    return {
      ok: true,
      eventId: booked.eventId,
      selectedStart: booked.selectedStart,
      googleMeetUrl: booked.googleMeetUrl,
      lifecycleConfirmationSent: booked.lifecycle.smsSent === true,
      stageSnapshot,
    };
  });
}
