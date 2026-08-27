import {
  createConsultationEvent,
  type CreateConsultationEventInput,
  type CreateConsultationEventResult,
} from "~/server/appointmentLifecycle/googleCalendar";
import { processCalendarEvent } from "~/server/appointmentLifecycle/processEvent";
import type { ProcessEventResult } from "~/server/appointmentLifecycle/types";
import { getActiveBookingStageCollector } from "~/server/scheduling/bookingStageTrace";

export type BookConsultationInput = CreateConsultationEventInput;

export type BookConsultationSuccess = {
  ok: true;
  eventId: string;
  selectedStart: string;
  googleMeetUrl: string;
  replayed: boolean;
  lifecycle: ProcessEventResult;
};

export type BookConsultationResult = BookConsultationSuccess | CreateConsultationEventResult;

/**
 * Deterministic agent booking: create the Google Calendar event, then enter the
 * existing appointment lifecycle (confirmation SMS, reminders, demo suppression).
 */
export async function bookConsultation(
  input: BookConsultationInput,
): Promise<BookConsultationResult> {
  const collector = getActiveBookingStageCollector();
  if (collector) {
    collector.bookConsultationEntered = true;
  }

  const created = await createConsultationEvent(input);
  if (!created.ok) {
    if (collector && !collector.finalBookingReason) {
      collector.finalBookingReason = created.reason;
    }
    return created;
  }

  if (collector) {
    collector.lifecycleEntered = true;
    collector.lifecycleResult = "started";
  }
  let lifecycle: ProcessEventResult;
  try {
    lifecycle = await processCalendarEvent(created.normalizedEvent);
    if (collector) {
      collector.lifecycleResult = "succeeded";
    }
  } catch (error) {
    if (collector) {
      collector.lifecycleResult = "failed";
      collector.failureStage = "lifecycle_error";
      collector.failureReason =
        error instanceof Error ? error.message.slice(0, 120) : "lifecycle_failed";
      collector.finalBookingReason = "lifecycle_error";
    }
    throw error;
  }

  if (collector) {
    collector.eventIdPresent = true;
    collector.googleMeetUrlPresent = Boolean(created.googleMeetUrl);
    collector.confirmationSmsAttempted = true;
    collector.confirmationSmsResult = lifecycle.smsSent ? "succeeded" : "skipped";
    collector.finalBookingReason = "booked";
  }

  return {
    ok: true,
    eventId: created.eventId,
    selectedStart: created.normalizedEvent.appointmentStart,
    googleMeetUrl: created.googleMeetUrl,
    replayed: created.replayed,
    lifecycle,
  };
}
