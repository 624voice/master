import {
  createConsultationEvent,
  type CreateConsultationEventInput,
  type CreateConsultationEventResult,
} from "~/server/appointmentLifecycle/googleCalendar";
import { processCalendarEvent } from "~/server/appointmentLifecycle/processEvent";
import type { ProcessEventResult } from "~/server/appointmentLifecycle/types";

export type BookConsultationInput = CreateConsultationEventInput;

export type BookConsultationSuccess = {
  ok: true;
  eventId: string;
  selectedStart: string;
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
  const created = await createConsultationEvent(input);
  if (!created.ok) {
    return created;
  }

  const lifecycle = await processCalendarEvent(created.normalizedEvent);

  return {
    ok: true,
    eventId: created.eventId,
    selectedStart: created.normalizedEvent.appointmentStart,
    replayed: created.replayed,
    lifecycle,
  };
}
