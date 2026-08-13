import { getBookingCalendarLink } from "~/server/appointmentLifecycle/config";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import {
  bookingConfirmationMessage,
  cancellationConfirmationMessage,
  cancellationManualMessage,
  reminder24hMessage,
  reminder2hMessage,
  rescheduleConfirmationMessage,
} from "~/server/appointmentLifecycle/messages";
import { matchCalendarEventToLead } from "~/server/appointmentLifecycle/matchLead";
import {
  shouldSkip24hForLeadTime,
  shouldSkip2hForLeadTime,
} from "~/server/appointmentLifecycle/reminderSchedule";
import { suppressSalesFollowUps } from "~/server/appointmentLifecycle/handoff";
import { sendLifecycleSms } from "~/server/appointmentLifecycle/sms";
import {
  getLifecycleRecord,
  saveLifecycleRecord,
} from "~/server/appointmentLifecycle/store";
import type {
  AppointmentLifecycleRecord,
  LeadIndexEntry,
  NormalizedCalendarEvent,
  ProcessEventResult,
} from "~/server/appointmentLifecycle/types";
import { isOptedOut } from "~/server/speed2Lead/session";

function messageContext(record: AppointmentLifecycleRecord) {
  return {
    firstName: record.firstName ?? "there",
    businessName: record.businessName,
    source: record.source,
    appointmentStart: record.appointmentStart,
    timezone: record.timezone,
    meetingLink: record.meetingLink,
    rescheduleLink: record.rescheduleLink,
    calendarLink: getBookingCalendarLink(),
  };
}

function buildRecordFromEvent(
  event: NormalizedCalendarEvent,
  lead: LeadIndexEntry,
  matchMethod: AppointmentLifecycleRecord["matchMethod"],
  extra: Partial<AppointmentLifecycleRecord> = {},
): AppointmentLifecycleRecord {
  const now = new Date().toISOString();
  return {
    calendarEventId: event.calendarEventId,
    phone: lead.phone,
    email: lead.email ?? event.attendeeEmail,
    firstName: lead.firstName,
    businessName: lead.businessName,
    source: lead.source,
    appointmentStart: event.appointmentStart,
    appointmentEnd: event.appointmentEnd,
    timezone: event.timezone,
    eventStatus: event.status,
    lifecycleStatus: "booking_detected",
    meetingLink: event.meetingLink,
    rescheduleLink: event.rescheduleLink,
    matchMethod,
    selfReportedBeforeDetection: Boolean(lead.selfReportedBookingAt),
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

async function sendConfirmationIfAllowed(
  record: AppointmentLifecycleRecord,
  messageType: "confirmation" | "reschedule_confirmation",
): Promise<boolean> {
  if (!record.phone) return false;
  if (await isOptedOut(record.phone)) {
    logAppointmentEvent("sms_suppressed_opt_out", {
      phone: record.phone,
      eventId: record.calendarEventId,
      messageType,
    });
    return false;
  }

  const ctx = messageContext(record);
  const body =
    messageType === "reschedule_confirmation"
      ? rescheduleConfirmationMessage(ctx)
      : bookingConfirmationMessage(ctx);

  await sendLifecycleSms(record.phone, body, {
    messageType,
    eventId: record.calendarEventId,
  });
  return true;
}

export async function processCalendarEvent(
  event: NormalizedCalendarEvent,
): Promise<ProcessEventResult> {
  const existing = await getLifecycleRecord(event.calendarEventId);

  if (event.status === "cancelled") {
    return processCancelledEvent(event, existing);
  }

  if (existing?.confirmationSentAt && existing.appointmentStart === event.appointmentStart) {
    logAppointmentEvent("duplicate_prevented", {
      eventId: event.calendarEventId,
      action: "confirmation",
    });
    return { eventId: event.calendarEventId, action: "duplicate_skipped" };
  }

  if (existing && existing.appointmentStart !== event.appointmentStart) {
    return processRescheduledEvent(event, existing);
  }

  if (existing?.lifecycleStatus === "confirmed") {
    return { eventId: event.calendarEventId, action: "no_action" };
  }

  const match = await matchCalendarEventToLead(event);
  if (!match.matched) {
    const now = new Date().toISOString();
    const unmatched: AppointmentLifecycleRecord = {
      calendarEventId: event.calendarEventId,
      appointmentStart: event.appointmentStart,
      appointmentEnd: event.appointmentEnd,
      timezone: event.timezone,
      eventStatus: event.status,
      lifecycleStatus: "unmatched_booking",
      email: event.attendeeEmail,
      meetingLink: event.meetingLink,
      createdAt: now,
      updatedAt: now,
    };
    await saveLifecycleRecord(unmatched);
    logAppointmentEvent("unmatched_booking", {
      eventId: event.calendarEventId,
      reason: match.reason,
      ...match.diagnostic,
    });
    return { eventId: event.calendarEventId, action: "unmatched" };
  }

  logAppointmentEvent("booking_matched", {
    eventId: event.calendarEventId,
    phone: match.lead.phone,
    method: match.method,
  });

  const record = buildRecordFromEvent(event, match.lead, match.method, {
    lifecycleStatus: "booking_detected",
  });

  const confirmedAt = new Date();
  const smsSent = await sendConfirmationIfAllowed(record, "confirmation");

  if (smsSent) {
    record.confirmationSentAt = confirmedAt.toISOString();
    record.lifecycleStatus = "confirmed";
    if (shouldSkip24hForLeadTime(record, confirmedAt)) {
      record.reminder24hSentAt = "skipped_short_lead_time";
    }
    if (shouldSkip2hForLeadTime(record, confirmedAt)) {
      record.reminder2hSentAt = "skipped_short_lead_time";
    }
  }

  await saveLifecycleRecord(record);
  await suppressSalesFollowUps(record.phone!);

  logAppointmentEvent("booking_detected", {
    eventId: event.calendarEventId,
    phone: record.phone,
    source: record.source,
  });

  return {
    eventId: event.calendarEventId,
    action: "created",
    smsSent,
    messageType: "confirmation",
  };
}

async function processRescheduledEvent(
  event: NormalizedCalendarEvent,
  existing: AppointmentLifecycleRecord,
): Promise<ProcessEventResult> {
  if (!existing.phone) {
    return { eventId: event.calendarEventId, action: "updated" };
  }

  const updated: AppointmentLifecycleRecord = {
    ...existing,
    appointmentStart: event.appointmentStart,
    appointmentEnd: event.appointmentEnd,
    timezone: event.timezone,
    eventStatus: event.status,
    meetingLink: event.meetingLink ?? existing.meetingLink,
    rescheduleLink: event.rescheduleLink ?? existing.rescheduleLink,
    lifecycleStatus: "rescheduled",
    reminder24hSentAt: undefined,
    reminder2hSentAt: undefined,
    updatedAt: new Date().toISOString(),
  };

  const smsSent = await sendConfirmationIfAllowed(updated, "reschedule_confirmation");
  if (smsSent) {
    updated.confirmationSentAt = new Date().toISOString();
    updated.lifecycleStatus = "confirmed";
    const confirmedAt = new Date();
    if (shouldSkip24hForLeadTime(updated, confirmedAt)) {
      updated.reminder24hSentAt = "skipped_short_lead_time";
    }
    if (shouldSkip2hForLeadTime(updated, confirmedAt)) {
      updated.reminder2hSentAt = "skipped_short_lead_time";
    }
  }

  await saveLifecycleRecord(updated);
  logAppointmentEvent("booking_rescheduled", {
    eventId: event.calendarEventId,
    phone: updated.phone,
  });

  return {
    eventId: event.calendarEventId,
    action: "rescheduled",
    smsSent,
    messageType: "reschedule_confirmation",
  };
}

async function processCancelledEvent(
  event: NormalizedCalendarEvent,
  existing: AppointmentLifecycleRecord | null,
): Promise<ProcessEventResult> {
  if (!existing) {
    return { eventId: event.calendarEventId, action: "cancelled" };
  }

  const updated: AppointmentLifecycleRecord = {
    ...existing,
    eventStatus: "cancelled",
    lifecycleStatus: "cancelled",
    cancelledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveLifecycleRecord(updated);
  logAppointmentEvent("booking_cancelled", {
    eventId: event.calendarEventId,
    phone: existing.phone,
    source: "calendar",
  });

  return { eventId: event.calendarEventId, action: "cancelled" };
}

export async function processCalendarEvents(
  events: NormalizedCalendarEvent[],
): Promise<ProcessEventResult[]> {
  const results: ProcessEventResult[] = [];
  for (const event of events) {
    results.push(await processCalendarEvent(event));
  }
  return results;
}
