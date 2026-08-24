import {
  extractEmailFromText,
  extractPhoneFromText,
} from "~/server/appointmentLifecycle/matchLead";
import type {
  CalendarEventStatus,
  NormalizedCalendarEvent,
} from "~/server/appointmentLifecycle/types";
import { DEFAULT_TIMEZONE } from "~/server/appointmentLifecycle/config";
import { extractGoogleMeetUrl } from "~/server/appointmentLifecycle/googleMeetConference";

type GoogleCalendarApiEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  updated?: string;
  start?: { dateTime?: string; timeZone?: string; date?: string };
  end?: { dateTime?: string; timeZone?: string; date?: string };
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>;
  hangoutLink?: string;
  conferenceData?: {
    createRequest?: {
      requestId?: string;
      status?: { statusCode?: string };
    };
    conferenceStatus?: { statusCode?: string };
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
  location?: string;
};

type WebhookCalendarEvent = {
  eventId: string;
  status?: string;
  summary?: string;
  description?: string;
  start: string;
  end: string;
  timezone?: string;
  attendeeEmail?: string;
  attendeeName?: string;
  attendeePhone?: string;
  meetingLink?: string;
  rescheduleLink?: string;
  updatedAt?: string;
};

function mapStatus(status?: string): CalendarEventStatus {
  if (status === "cancelled") {
    return "cancelled";
  }
  if (status === "tentative") {
    return "tentative";
  }
  return "confirmed";
}

export { extractGoogleMeetUrl } from "~/server/appointmentLifecycle/googleMeetConference";

function primaryAttendee(event: GoogleCalendarApiEvent): {
  email?: string;
  name?: string;
} {
  const attendees = event.attendees ?? [];
  const guest = attendees.find(
    (a) => a.email && !a.email.includes("calendar.google.com"),
  );
  return {
    email: guest?.email,
    name: guest?.displayName,
  };
}

export function parseGoogleCalendarApiEvent(event: GoogleCalendarApiEvent): NormalizedCalendarEvent | null {
  const startRaw = event.start?.dateTime ?? event.start?.date;
  const endRaw = event.end?.dateTime ?? event.end?.date;
  if (!startRaw || !endRaw || !event.id) {
    return null;
  }

  const attendee = primaryAttendee(event);
  const description = event.description ?? "";
  const attendeePhone =
    extractPhoneFromText(description) ?? extractPhoneFromText(event.summary ?? "");

  return {
    calendarEventId: event.id,
    status: mapStatus(event.status),
    summary: event.summary,
    description,
    attendeeEmail: attendee.email ?? extractEmailFromText(description),
    attendeeName: attendee.name,
    attendeePhone,
    appointmentStart: new Date(startRaw).toISOString(),
    appointmentEnd: new Date(endRaw).toISOString(),
    timezone: event.start?.timeZone ?? DEFAULT_TIMEZONE,
    meetingLink: extractGoogleMeetUrl(event),
    updatedAt: event.updated ? new Date(event.updated).toISOString() : new Date().toISOString(),
  };
}

export function parseWebhookCalendarEvent(event: WebhookCalendarEvent): NormalizedCalendarEvent {
  const description = event.description ?? "";
  return {
    calendarEventId: event.eventId,
    status: mapStatus(event.status),
    summary: event.summary,
    description,
    attendeeEmail: event.attendeeEmail ?? extractEmailFromText(description),
    attendeeName: event.attendeeName,
    attendeePhone:
      event.attendeePhone ??
      extractPhoneFromText(description) ??
      extractPhoneFromText(event.summary ?? ""),
    appointmentStart: new Date(event.start).toISOString(),
    appointmentEnd: new Date(event.end).toISOString(),
    timezone: event.timezone ?? DEFAULT_TIMEZONE,
    meetingLink: event.meetingLink,
    rescheduleLink: event.rescheduleLink,
    updatedAt: event.updatedAt ?? new Date().toISOString(),
  };
}

export type { GoogleCalendarApiEvent, WebhookCalendarEvent };
