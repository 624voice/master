import type { S2LSource } from "~/server/appointmentLifecycle/types";
import {
  formatAppointmentParts,
  formatTimeOnly,
  formatTomorrowReference,
} from "~/server/appointmentLifecycle/formatTime";
import { getBookingCalendarLink } from "~/server/appointmentLifecycle/config";

type MessageContext = {
  firstName: string;
  businessName?: string;
  source?: S2LSource;
  appointmentStart: string;
  timezone: string;
  meetingLink?: string;
  rescheduleLink?: string;
  calendarLink?: string;
};

function tzSuffix(timezoneShort: string): string {
  return timezoneShort ? ` ${timezoneShort}` : "";
}

function changeInstructions(): string {
  return " Need to change it? Reply RESCHEDULE or CANCEL.";
}

export function bookingConfirmationMessage(ctx: MessageContext): string {
  const { weekday, month, day, time, timezoneShort } = formatAppointmentParts(
    ctx.appointmentStart,
    ctx.timezone,
  );
  const name = ctx.firstName || "there";
  let message = `Perfect, ${name} - you're booked. We're set for ${weekday}, ${month} ${day} at ${time}${tzSuffix(timezoneShort)}. I'll send you a reminder before we meet.`;

  if (ctx.meetingLink) {
    message += ` Meeting link: ${ctx.meetingLink}`;
  }

  message += changeInstructions();
  return message;
}

export function rescheduleConfirmationMessage(ctx: MessageContext): string {
  const { weekday, month, day, time, timezoneShort } = formatAppointmentParts(
    ctx.appointmentStart,
    ctx.timezone,
  );
  const name = ctx.firstName || "there";
  let message = `Got it - you're moved to ${weekday}, ${month} ${day} at ${time}${tzSuffix(timezoneShort)}. I'll send you a reminder before we meet.`;

  if (ctx.meetingLink) {
    message += ` Meeting link: ${ctx.meetingLink}`;
  }

  return message;
}

export function reminder24hMessage(ctx: MessageContext): string {
  const name = ctx.firstName || "there";
  const when = formatTomorrowReference(ctx.appointmentStart, ctx.timezone);
  let message = `Hey ${name}, Chris with 624Voice. Quick reminder that we're set for ${when}.`;

  if (ctx.meetingLink) {
    message += ` Here's the link: ${ctx.meetingLink}`;
  }

  message += " If anything changed, reply RESCHEDULE or CANCEL.";
  return message;
}

export function reminder2hMessage(ctx: MessageContext): string {
  const name = ctx.firstName || "there";
  const { time, timezoneShort } = formatTimeOnly(ctx.appointmentStart, ctx.timezone);

  if (ctx.meetingLink) {
    return `Hey ${name} - looking forward to talking at ${time}${tzSuffix(timezoneShort)}. Here's the meeting link: ${ctx.meetingLink} If you need to change it, just reply RESCHEDULE.`;
  }

  return `Hey ${name} - looking forward to talking at ${time}${tzSuffix(timezoneShort)}. Talk soon.`;
}

export function rescheduleLinkMessage(ctx: MessageContext): string {
  const link = ctx.rescheduleLink ?? ctx.calendarLink ?? getBookingCalendarLink();
  if (ctx.rescheduleLink) {
    return `No problem. You can choose a new time here: ${link}`;
  }
  return `No problem. Pick a new time here: ${link}. Once you book, I'll confirm the updated time and stop reminders for your current appointment.`;
}

export function cancellationConfirmationMessage(ctx: MessageContext): string {
  const { weekday, time, timezoneShort } = formatAppointmentParts(
    ctx.appointmentStart,
    ctx.timezone,
  );
  const name = ctx.firstName || "there";
  const calendarLink = ctx.calendarLink ?? getBookingCalendarLink();
  return `No problem, ${name} - I've cancelled our ${weekday} ${time}${tzSuffix(timezoneShort)} meeting. If you want to pick another time later, here's my calendar: ${calendarLink}`;
}

export function cancellationManualMessage(ctx: MessageContext): string {
  const calendarLink = ctx.calendarLink ?? getBookingCalendarLink();
  return `No problem. If you need to cancel or pick a new time, use this link: ${calendarLink} Or reply RESCHEDULE if you'd like a different time.`;
}

export function selfReportedBookingAckMessage(firstName: string): string {
  const name = firstName || "there";
  return `Thanks, ${name}. I'll confirm the details once your booking comes through.`;
}

export function meetingBookedAckMessage(firstName: string): string {
  return selfReportedBookingAckMessage(firstName);
}
