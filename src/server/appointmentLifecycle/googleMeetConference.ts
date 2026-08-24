import { randomUUID } from "node:crypto";
import type { GoogleCalendarApiEvent } from "~/server/appointmentLifecycle/parseCalendarEvent";

/** Google Calendar API conference solution type for Google Meet. */
export const GOOGLE_MEET_CONFERENCE_SOLUTION_TYPE = "hangoutsMeet" as const;

export type GoogleMeetConferenceCreateRequest = {
  requestId: string;
  conferenceSolutionKey: {
    type: typeof GOOGLE_MEET_CONFERENCE_SOLUTION_TYPE;
  };
};

/** Generate a unique client requestId for each conference create attempt. */
export function createGoogleMeetConferenceRequestId(bookingKey: string): string {
  const suffix = randomUUID().replace(/-/g, "");
  const prefix = bookingKey.replace(/[^a-zA-Z0-9:+._-]/g, "").slice(-24);
  return `${prefix}:${suffix}`.slice(0, 64);
}

export function buildGoogleMeetConferenceCreateRequest(
  bookingKey: string,
): GoogleMeetConferenceCreateRequest {
  return {
    requestId: createGoogleMeetConferenceRequestId(bookingKey),
    conferenceSolutionKey: {
      type: GOOGLE_MEET_CONFERENCE_SOLUTION_TYPE,
    },
  };
}

export function readConferenceStatus(event: GoogleCalendarApiEvent): string | undefined {
  return (
    event.conferenceData?.conferenceStatus?.statusCode ??
    event.conferenceData?.createRequest?.status?.statusCode
  );
}

/** Prefer canonical video entry point; fall back to legacy hangoutLink. */
export function extractGoogleMeetUrl(event: GoogleCalendarApiEvent): string | undefined {
  const videoEntry = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video" && entry.uri,
  );
  if (videoEntry?.uri) {
    return videoEntry.uri;
  }
  return event.hangoutLink;
}

export function isConferenceFailureStatus(status?: string): boolean {
  return status === "failure";
}

export function isConferencePendingStatus(status?: string): boolean {
  return status === "pending" || status === "pendingCreate";
}
