import { describe, expect, test } from "bun:test";
import {
  parseGoogleCalendarApiEvent,
  parseWebhookCalendarEvent,
} from "~/server/appointmentLifecycle/parseCalendarEvent";

describe("parseCalendarEvent", () => {
  test("parses Google API event with phone in description", () => {
    const parsed = parseGoogleCalendarApiEvent({
      id: "evt-99",
      status: "confirmed",
      summary: "624 Voice consultation",
      description: "Phone number: (555) 123-4567\nEmail: jane@example.com",
      updated: "2026-08-13T12:00:00.000Z",
      start: { dateTime: "2026-08-15T15:00:00-05:00", timeZone: "America/Chicago" },
      end: { dateTime: "2026-08-15T15:30:00-05:00", timeZone: "America/Chicago" },
      attendees: [{ email: "jane@example.com", displayName: "Jane Doe" }],
      hangoutLink: "https://meet.google.com/xyz",
    });

    expect(parsed?.calendarEventId).toBe("evt-99");
    expect(parsed?.attendeePhone).toBe("+15551234567");
    expect(parsed?.attendeeEmail).toBe("jane@example.com");
    expect(parsed?.meetingLink).toBe("https://meet.google.com/xyz");
  });

  test("parses webhook payload", () => {
    const parsed = parseWebhookCalendarEvent({
      eventId: "evt-1",
      status: "confirmed",
      start: "2026-08-15T20:00:00.000Z",
      end: "2026-08-15T20:30:00.000Z",
      attendeePhone: "+15551234567",
      attendeeEmail: "jane@example.com",
      attendeeName: "Jane Doe",
    });
    expect(parsed.attendeePhone).toBe("+15551234567");
  });

  test("returns null for incomplete API event", () => {
    expect(parseGoogleCalendarApiEvent({ id: "x" })).toBeNull();
  });
});
