import { getBookingCalendarLink, isGoogleCalendarApiConfigured } from "~/server/appointmentLifecycle/config";
import { classifyLifecycleIntent, isAmbiguousCancellation } from "~/server/appointmentLifecycle/intents";
import { cancelCalendarEvent } from "~/server/appointmentLifecycle/googleCalendar";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import {
  cancellationConfirmationMessage,
  cancellationManualMessage,
  meetingBookedAckMessage,
  rescheduleLinkMessage,
} from "~/server/appointmentLifecycle/messages";
import { markSelfReportedAndAcknowledge } from "~/server/appointmentLifecycle/handoff";
import { sendLifecycleSms } from "~/server/appointmentLifecycle/sms";
import { canSendLifecycleSms } from "~/server/appointmentLifecycle/smsEligibility";
import {
  getActiveLifecycleForPhone,
  getLeadForLifecycle,
  saveLifecycleRecord,
} from "~/server/appointmentLifecycle/store";
import { classifyGlobalIntent } from "~/server/speed2Lead/globalIntents";
import { sendConversationSms } from "~/server/speed2Lead/conversationSms";
import { saveSession } from "~/server/speed2Lead/session";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

export type LifecycleInboundResult = {
  handled: boolean;
  reply?: string;
};

export async function handleAppointmentLifecycleInbound(
  phone: string,
  body: string,
  session: AnyConversationContext | null,
): Promise<LifecycleInboundResult> {
  const globalIntent = classifyGlobalIntent(body);
  const lifecycleIntent = classifyLifecycleIntent(body);
  const active = await getActiveLifecycleForPhone(phone);
  const lead = active ? await getLeadForLifecycle(active) : null;

  if (globalIntent === "meeting_booked" && session) {
    await markSelfReportedAndAcknowledge(phone);
    const firstName = session.firstName;
    const reply = meetingBookedAckMessage(firstName);
    const now = new Date().toISOString();
    const completed =
      session.flow === "demo"
        ? {
            ...session,
            meetingBooked: true,
            state: "completed" as const,
            nextFollowUpAt: undefined,
            updatedAt: now,
          }
        : { ...session, state: "completed" as const, updatedAt: now };
    await saveSession(completed);
    await sendConversationSms(phone, reply, completed);
    return { handled: true, reply };
  }

  if (!active) {
    return { handled: false };
  }

  if (lifecycleIntent === "reschedule") {
    const updated = {
      ...active,
      lifecycleStatus: "reschedule_pending" as const,
      reschedulePendingAt: new Date().toISOString(),
      remindersSuppressed: true,
      updatedAt: new Date().toISOString(),
    };
    await saveLifecycleRecord(updated);
    logAppointmentEvent("reschedule_pending", {
      phone,
      eventId: active.calendarEventId,
    });

    const reply = rescheduleLinkMessage({
      firstName: active.firstName ?? "there",
      appointmentStart: active.appointmentStart,
      timezone: active.timezone,
      rescheduleLink: active.rescheduleLink,
      calendarLink: getBookingCalendarLink(),
    });

    const eligibility = await canSendLifecycleSms(phone, lead);
    if (eligibility.allowed) {
      await sendLifecycleSms(phone, reply, {
        messageType: "reschedule_link",
        eventId: active.calendarEventId,
      });
    }
    return { handled: true, reply };
  }

  if (lifecycleIntent === "cancel") {
    if (isAmbiguousCancellation(body)) {
      return { handled: false };
    }

    const eligibility = await canSendLifecycleSms(phone, lead);
    if (!eligibility.allowed) {
      return { handled: true };
    }

    const cancelled =
      isGoogleCalendarApiConfigured() && (await cancelCalendarEvent(active.calendarEventId));
    if (cancelled) {
      const updated = {
        ...active,
        lifecycleStatus: "cancelled" as const,
        eventStatus: "cancelled" as const,
        cancelledAt: new Date().toISOString(),
        remindersSuppressed: true,
        updatedAt: new Date().toISOString(),
      };
      await saveLifecycleRecord(updated);
      const reply = cancellationConfirmationMessage({
        firstName: active.firstName ?? "there",
        appointmentStart: active.appointmentStart,
        timezone: active.timezone,
        calendarLink: getBookingCalendarLink(),
      });
      await sendLifecycleSms(phone, reply, {
        messageType: "cancellation",
        eventId: active.calendarEventId,
      });
      logAppointmentEvent("booking_cancelled", {
        phone,
        eventId: active.calendarEventId,
        source: "sms",
      });
      return { handled: true, reply };
    }

    const reply = cancellationManualMessage({
      firstName: active.firstName ?? "there",
      appointmentStart: active.appointmentStart,
      timezone: active.timezone,
      calendarLink: getBookingCalendarLink(),
    });
    await sendLifecycleSms(phone, reply, {
      messageType: "cancellation_manual",
      eventId: active.calendarEventId,
    });
    logAppointmentEvent("cancellation_failed", {
      phone,
      eventId: active.calendarEventId,
    });
    return { handled: true, reply };
  }

  return { handled: false };
}
