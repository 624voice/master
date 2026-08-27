import { getBookingCalendarLink, isGoogleCalendarApiConfigured } from "~/server/appointmentLifecycle/config";
import { cancelCalendarEvent } from "~/server/appointmentLifecycle/googleCalendar";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import {
  bookingConfirmationMessage,
  rescheduleConfirmationMessage,
} from "~/server/appointmentLifecycle/messages";
import { matchCalendarEventToLead } from "~/server/appointmentLifecycle/matchLead";
import {
  shouldSkip24hForLeadTime,
  shouldSkip2hForLeadTime,
} from "~/server/appointmentLifecycle/reminderSchedule";
import { suppressSalesFollowUps } from "~/server/appointmentLifecycle/handoff";
import { sendLifecycleSms } from "~/server/appointmentLifecycle/sms";
import { canSendLifecycleSms } from "~/server/appointmentLifecycle/smsEligibility";
import {
  getActiveLifecycleForPhone,
  getLeadForLifecycle,
  getLifecycleRecord,
  saveLifecycleRecord,
  supersedeActiveLifecycle,
} from "~/server/appointmentLifecycle/store";
import { getActiveBookingStageCollector } from "~/server/speed2Lead/agent/scheduling/bookingStageTrace";
import type {
  AppointmentLifecycleRecord,
  LeadIndexEntry,
  NormalizedCalendarEvent,
  ProcessEventResult,
} from "~/server/appointmentLifecycle/types";

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

function isReplacementBooking(
  existing: AppointmentLifecycleRecord,
  event: NormalizedCalendarEvent,
  lead: LeadIndexEntry,
): boolean {
  if (existing.lifecycleStatus === "reschedule_pending") {
    return true;
  }
  if (lead.selfReportedBookingAt || existing.selfReportedBeforeDetection) {
    return true;
  }
  if (existing.reschedulePendingAt) {
    return true;
  }
  const existingStart = new Date(existing.appointmentStart).getTime();
  const newStart = new Date(event.appointmentStart).getTime();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  return Math.abs(existingStart - newStart) <= fourteenDays;
}

async function tryCancelOldEvent(eventId: string): Promise<boolean> {
  if (!(await isGoogleCalendarApiConfigured())) {
    return false;
  }
  return cancelCalendarEvent(eventId);
}

async function handleExistingActiveLifecycle(
  existing: AppointmentLifecycleRecord,
  event: NormalizedCalendarEvent,
  lead: LeadIndexEntry,
): Promise<{ isReplacement: boolean; superseded?: AppointmentLifecycleRecord }> {
  if (existing.calendarEventId === event.calendarEventId) {
    return { isReplacement: false };
  }

  const replacement = isReplacementBooking(existing, event, lead);
  const cancelled = await tryCancelOldEvent(existing.calendarEventId);

  const superseded = await supersedeActiveLifecycle(existing, event.calendarEventId, {
    manualCleanupRequired: !cancelled,
  });

  logAppointmentEvent("lifecycle_superseded", {
    oldEventId: existing.calendarEventId,
    newEventId: event.calendarEventId,
    phone: lead.phone,
    replacement: replacement ? "yes" : "conservative",
    calendarCancelled: cancelled,
  });

  if (!cancelled) {
    logAppointmentEvent("manual_cleanup_required", {
      eventId: existing.calendarEventId,
      phone: lead.phone,
      reason: "replacement_without_api_cancel",
    });
  }

  return { isReplacement: replacement, superseded };
}

async function sendLifecycleMessageIfAllowed(
  record: AppointmentLifecycleRecord,
  lead: LeadIndexEntry,
  messageType: "confirmation" | "reschedule_confirmation",
): Promise<boolean> {
  if (!record.phone) return false;

  const eligibility = await canSendLifecycleSms(record.phone, lead);
  if (!eligibility.allowed) {
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

function applyConfirmationState(
  record: AppointmentLifecycleRecord,
  confirmedAt: Date,
): AppointmentLifecycleRecord {
  const updated = {
    ...record,
    confirmationSentAt: confirmedAt.toISOString(),
    lifecycleStatus: "confirmed" as const,
    remindersSuppressed: false,
    updatedAt: confirmedAt.toISOString(),
  };
  if (shouldSkip24hForLeadTime(updated, confirmedAt)) {
    updated.reminder24hSentAt = "skipped_short_lead_time";
  }
  if (shouldSkip2hForLeadTime(updated, confirmedAt)) {
    updated.reminder2hSentAt = "skipped_short_lead_time";
  }
  return updated;
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

  let messageType: "confirmation" | "reschedule_confirmation" = "confirmation";
  let rescheduledFromEventId: string | undefined;

  const activeLifecycle = await getActiveLifecycleForPhone(match.lead.phone);
  if (activeLifecycle && activeLifecycle.calendarEventId !== event.calendarEventId) {
    const { isReplacement, superseded } = await handleExistingActiveLifecycle(
      activeLifecycle,
      event,
      match.lead,
    );
    if (superseded) {
      rescheduledFromEventId = superseded.calendarEventId;
      if (isReplacement) {
        messageType = "reschedule_confirmation";
      }
    }
  }

  const record = buildRecordFromEvent(event, match.lead, match.method, {
    lifecycleStatus: "booking_detected",
    rescheduledFromEventId,
    remindersSuppressed: false,
  });

  const confirmedAt = new Date();
  const smsSent = await sendLifecycleMessageIfAllowed(record, match.lead, messageType);

  let finalRecord = record;
  if (smsSent) {
    finalRecord = applyConfirmationState(record, confirmedAt);
    const collector = getActiveBookingStageCollector();
    if (collector) {
      collector.reminder24Scheduled = !shouldSkip24hForLeadTime(finalRecord, confirmedAt);
      collector.reminder2Scheduled = !shouldSkip2hForLeadTime(finalRecord, confirmedAt);
    }
  } else {
    finalRecord = {
      ...record,
      lifecycleStatus: "booking_detected",
      updatedAt: confirmedAt.toISOString(),
    };
  }

  await saveLifecycleRecord(finalRecord);
  await suppressSalesFollowUps(finalRecord.phone!);

  logAppointmentEvent("booking_detected", {
    eventId: event.calendarEventId,
    phone: finalRecord.phone,
    source: finalRecord.source,
    messageType,
  });

  return {
    eventId: event.calendarEventId,
    action: rescheduledFromEventId ? "rescheduled" : "created",
    smsSent,
    messageType,
  };
}

async function processRescheduledEvent(
  event: NormalizedCalendarEvent,
  existing: AppointmentLifecycleRecord,
): Promise<ProcessEventResult> {
  if (!existing.phone) {
    return { eventId: event.calendarEventId, action: "updated" };
  }

  const lead = await getLeadForLifecycle(existing);
  if (!lead) {
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
    remindersSuppressed: false,
    reschedulePendingAt: undefined,
    updatedAt: new Date().toISOString(),
  };

  const smsSent = await sendLifecycleMessageIfAllowed(
    updated,
    lead,
    "reschedule_confirmation",
  );
  let finalRecord = updated;
  if (smsSent) {
    finalRecord = applyConfirmationState(updated, new Date());
  }

  await saveLifecycleRecord(finalRecord);
  logAppointmentEvent("booking_rescheduled", {
    eventId: event.calendarEventId,
    phone: finalRecord.phone,
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
    remindersSuppressed: true,
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
