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

type GoogleCalendarApiAttendee = {
  email?: string;
  displayName?: string;
  responseStatus?: string;
  self?: boolean;
  organizer?: boolean;
  resource?: boolean;
};

type GoogleCalendarApiEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  updated?: string;
  created?: string;
  start?: { dateTime?: string; timeZone?: string; date?: string };
  end?: { dateTime?: string; timeZone?: string; date?: string };
  attendees?: Array<GoogleCalendarApiAttendee>;
  organizer?: { email?: string; displayName?: string; self?: boolean };
  creator?: { email?: string; displayName?: string; self?: boolean };
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
  createdAt?: string;
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hasUsableEmail(email?: string): email is string {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
}

function isGoogleCalendarResourceAddress(email: string): boolean {
  return email.toLowerCase().includes("calendar.google.com");
}

/** Calendar owner identity only — never "organizer" as a concept. */
function calendarOwnerEmails(event: GoogleCalendarApiEvent): Set<string> {
  const emails = new Set<string>();
  if (event.organizer?.self === true && hasUsableEmail(event.organizer.email)) {
    emails.add(normalizeEmail(event.organizer.email));
  }
  if (event.creator?.self === true && hasUsableEmail(event.creator.email)) {
    emails.add(normalizeEmail(event.creator.email));
  }
  for (const attendee of event.attendees ?? []) {
    if (attendee.self === true && hasUsableEmail(attendee.email)) {
      emails.add(normalizeEmail(attendee.email));
    }
  }
  return emails;
}

function isExternalHumanCandidate(
  attendee: GoogleCalendarApiAttendee,
  ownerEmails: Set<string>,
): boolean {
  if (!hasUsableEmail(attendee.email)) {
    return false;
  }
  if (attendee.self === true) {
    return false;
  }
  if (isGoogleCalendarResourceAddress(attendee.email)) {
    return false;
  }
  if (attendee.resource === true) {
    return false;
  }
  if (ownerEmails.has(normalizeEmail(attendee.email))) {
    return false;
  }
  return true;
}

function decodeCalendarText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r\n/g, "\n");
}

const APPOINTMENT_SCHEDULE_FIELD_LABEL =
  /^(business\s+name|trade|how many|do you have|website|company|phone|mobile|cell|email)\b/i;

/**
 * Lines in the Appointment Schedule "Booked by" form-answer block, if present.
 * This is structured guest data, not an arbitrary text guess.
 */
function appointmentScheduleBookedByLines(description: string): string[] {
  const lines = decodeCalendarText(description)
    .split("\n")
    .map((line) => line.trim());
  const start = lines.findIndex((line) => /^booked\s+by\b/i.test(line));
  if (start < 0) {
    return [];
  }

  const block: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line) {
      if (block.length > 0) {
        break;
      }
      continue;
    }
    if (APPOINTMENT_SCHEDULE_FIELD_LABEL.test(line)) {
      break;
    }
    block.push(line);
  }
  return block;
}

function extractAppointmentScheduleGuestEmail(description: string): string | undefined {
  const block = appointmentScheduleBookedByLines(description).join("\n");
  if (!block) {
    return undefined;
  }
  return extractEmailFromText(block);
}

function isEmailLikeLine(line: string): boolean {
  return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(line);
}

function isPhoneLikeLine(line: string): boolean {
  const digits = line.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
}

function extractAppointmentScheduleBookedByName(description: string): string | undefined {
  for (const line of appointmentScheduleBookedByLines(description)) {
    if (isEmailLikeLine(line) || isPhoneLikeLine(line)) {
      continue;
    }
    if (/^https?:\/\//i.test(line)) {
      continue;
    }
    if (!/[A-Za-z]/.test(line) || line.length > 80) {
      return undefined;
    }
    return line;
  }
  return undefined;
}

function primaryAttendee(event: GoogleCalendarApiEvent): {
  email?: string;
  name?: string;
} {
  const ownerEmails = calendarOwnerEmails(event);
  const candidates = (event.attendees ?? []).filter((attendee) =>
    isExternalHumanCandidate(attendee, ownerEmails),
  );

  if (candidates.length === 1) {
    const guest = candidates[0]!;
    return {
      email: guest.email,
      name: guest.displayName?.trim() || undefined,
    };
  }

  if (candidates.length > 1) {
    const scheduledEmail = extractAppointmentScheduleGuestEmail(event.description ?? "");
    if (scheduledEmail) {
      const scheduled = normalizeEmail(scheduledEmail);
      const matches = candidates.filter(
        (candidate) => candidate.email && normalizeEmail(candidate.email) === scheduled,
      );
      if (matches.length === 1) {
        const guest = matches[0]!;
        return {
          email: guest.email,
          name: guest.displayName?.trim() || undefined,
        };
      }
    }
    // Multiple external humans and no unique structured identity — do not
    // use attendee array order as a tiebreaker.
    return {};
  }

  return {};
}

function resolveAttendeeName(
  selectedDisplayName: string | undefined,
  description: string,
): string | undefined {
  if (selectedDisplayName?.trim()) {
    return selectedDisplayName.trim();
  }
  return extractAppointmentScheduleBookedByName(description);
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
  const attendeeEmail =
    attendee.email ??
    extractAppointmentScheduleGuestEmail(description) ??
    extractEmailFromText(description);

  return {
    calendarEventId: event.id,
    status: mapStatus(event.status),
    summary: event.summary,
    description,
    attendeeEmail,
    attendeeName: resolveAttendeeName(attendee.name, description),
    attendeePhone,
    appointmentStart: new Date(startRaw).toISOString(),
    appointmentEnd: new Date(endRaw).toISOString(),
    timezone: event.start?.timeZone ?? DEFAULT_TIMEZONE,
    meetingLink: extractGoogleMeetUrl(event),
    createdAt: event.created ? new Date(event.created).toISOString() : undefined,
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
    createdAt: event.createdAt,
    updatedAt: event.updatedAt ?? new Date().toISOString(),
  };
}

export type { GoogleCalendarApiEvent, GoogleCalendarApiAttendee, WebhookCalendarEvent };
