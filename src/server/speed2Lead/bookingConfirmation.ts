import { bookingConfirmationMessage } from "~/server/appointmentLifecycle/messages";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";

export function buildBookingConfirmationMessage(
  start: string,
  firstName: string,
  options: {
    email?: string;
    sendsCalendarInvite?: boolean;
    useLifecycleCopy?: boolean;
    meetingLink?: string;
  } = {},
): string {
  if (options.useLifecycleCopy) {
    return "";
  }

  const meetingLink = options.meetingLink?.trim();

  return bookingConfirmationMessage({
    firstName,
    appointmentStart: start,
    timezone: CONSULTATION_TIMEZONE,
    meetingLink,
  });
}
