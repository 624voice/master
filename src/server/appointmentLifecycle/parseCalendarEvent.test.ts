import { describe, expect, test } from "bun:test";
import {
  parseGoogleCalendarApiEvent,
  parseWebhookCalendarEvent,
  type GoogleCalendarApiEvent,
} from "~/server/appointmentLifecycle/parseCalendarEvent";
import {
  CALENDAR_OWNER_EMAIL,
  FALSE_PHONE_FROM_EMAIL_LOCAL_PART,
  PRODUCTION_APPOINTMENT_SCHEDULE_EVENT,
  PRODUCTION_GUEST_EMAIL,
  PRODUCTION_GUEST_NAME,
  PRODUCTION_GUEST_PHONE,
} from "~/server/appointmentLifecycle/testSupport/fixtures/event_2prb1u0_appointment_schedule";

function baseEvent(overrides: Partial<GoogleCalendarApiEvent> = {}): GoogleCalendarApiEvent {
  return {
    id: "evt-test",
    status: "confirmed",
    summary: "624 Voice consultation",
    updated: "2026-08-13T12:00:00.000Z",
    start: { dateTime: "2026-08-15T15:00:00-05:00", timeZone: "America/Chicago" },
    end: { dateTime: "2026-08-15T15:30:00-05:00", timeZone: "America/Chicago" },
    ...overrides,
  };
}

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
    expect(parsed?.attendeeName).toBe("Jane Doe");
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

  test("normal non-Appointment-Schedule invite still selects the single external attendee", () => {
    const parsed = parseGoogleCalendarApiEvent(
      baseEvent({
        description: "Looking forward to connecting.",
        attendees: [{ email: "jane@example.com", displayName: "Jane Doe" }],
      }),
    );
    expect(parsed?.attendeeEmail).toBe("jane@example.com");
    expect(parsed?.attendeeName).toBe("Jane Doe");
    expect(parsed?.attendeePhone).toBeUndefined();
  });
});

describe("guest attendee selection", () => {
  test("A: Appointment Schedule production shape selects the external prospect, not self/organizer", () => {
    const parsed = parseGoogleCalendarApiEvent(PRODUCTION_APPOINTMENT_SCHEDULE_EVENT);
    expect(parsed?.attendeeEmail).toBe(PRODUCTION_GUEST_EMAIL);
    expect(parsed?.attendeeEmail).not.toBe(CALENDAR_OWNER_EMAIL);
    expect(parsed?.attendeePhone).toBe(PRODUCTION_GUEST_PHONE);
    expect(parsed?.attendeePhone).not.toBe(FALSE_PHONE_FROM_EMAIL_LOCAL_PART);
    expect(parsed?.attendeeName).toBe(PRODUCTION_GUEST_NAME);
  });

  test("B: reordered Appointment Schedule attendees still select the prospect", () => {
    const reordered: GoogleCalendarApiEvent = {
      ...PRODUCTION_APPOINTMENT_SCHEDULE_EVENT,
      attendees: [
        {
          email: PRODUCTION_GUEST_EMAIL,
          responseStatus: "needsAction",
        },
        {
          email: CALENDAR_OWNER_EMAIL,
          organizer: true,
          self: true,
          responseStatus: "accepted",
        },
      ],
    };
    const parsed = parseGoogleCalendarApiEvent(reordered);
    expect(parsed?.attendeeEmail).toBe(PRODUCTION_GUEST_EMAIL);
    expect(parsed?.attendeePhone).toBe(PRODUCTION_GUEST_PHONE);
    expect(parsed?.attendeeName).toBe(PRODUCTION_GUEST_NAME);
  });

  test("C: external prospect organizer is selected when calendar owner is self", () => {
    const parsed = parseGoogleCalendarApiEvent(
      baseEvent({
        description: "Prospect created this invite.",
        creator: { email: "prospect.organizer@example.com" },
        organizer: { email: "prospect.organizer@example.com" },
        attendees: [
          {
            email: CALENDAR_OWNER_EMAIL,
            self: true,
            responseStatus: "accepted",
          },
          {
            email: "prospect.organizer@example.com",
            displayName: "Pat Prospect",
            organizer: true,
            responseStatus: "accepted",
          },
        ],
      }),
    );
    expect(parsed?.attendeeEmail).toBe("prospect.organizer@example.com");
    expect(parsed?.attendeeEmail).not.toBe(CALENDAR_OWNER_EMAIL);
    expect(parsed?.attendeeName).toBe("Pat Prospect");
  });

  test("D: one external attendee with no self/organizer duplication is selected", () => {
    const parsed = parseGoogleCalendarApiEvent(
      baseEvent({
        attendees: [{ email: "only.guest@example.com", displayName: "Only Guest" }],
      }),
    );
    expect(parsed?.attendeeEmail).toBe("only.guest@example.com");
    expect(parsed?.attendeeName).toBe("Only Guest");
  });

  test("E: only self/owner attendee falls through to description extraction", () => {
    const description = PRODUCTION_APPOINTMENT_SCHEDULE_EVENT.description;
    const onlySelf = parseGoogleCalendarApiEvent(
      baseEvent({
        description,
        organizer: { email: CALENDAR_OWNER_EMAIL, self: true },
        attendees: [
          {
            email: CALENDAR_OWNER_EMAIL,
            organizer: true,
            self: true,
            responseStatus: "accepted",
          },
        ],
      }),
    );
    const emptyAttendees = parseGoogleCalendarApiEvent(
      baseEvent({
        description,
        organizer: { email: CALENDAR_OWNER_EMAIL, self: true },
        attendees: [],
      }),
    );
    expect(onlySelf?.attendeeEmail).toBe(PRODUCTION_GUEST_EMAIL);
    expect(onlySelf?.attendeeEmail).not.toBe(CALENDAR_OWNER_EMAIL);
    expect(onlySelf?.attendeePhone).toBe(PRODUCTION_GUEST_PHONE);
    expect(onlySelf?.attendeeName).toBe(PRODUCTION_GUEST_NAME);
    expect(onlySelf?.attendeeEmail).toBe(emptyAttendees?.attendeeEmail);
    expect(onlySelf?.attendeePhone).toBe(emptyAttendees?.attendeePhone);
    expect(onlySelf?.attendeeName).toBe(emptyAttendees?.attendeeName);
  });

  test("F: resource attendee is never selected as the guest", () => {
    const parsed = parseGoogleCalendarApiEvent(
      baseEvent({
        attendees: [
          {
            email: CALENDAR_OWNER_EMAIL,
            self: true,
            responseStatus: "accepted",
          },
          {
            email: "room-chicago@resource.calendar.google.com",
            displayName: "Chicago Conference Room",
            resource: true,
            responseStatus: "accepted",
          },
          {
            email: "resource.guest@example.com",
            displayName: "Riley Guest",
            responseStatus: "needsAction",
          },
        ],
      }),
    );
    expect(parsed?.attendeeEmail).toBe("resource.guest@example.com");
    expect(parsed?.attendeeName).toBe("Riley Guest");
    expect(parsed?.attendeeEmail).not.toBe("room-chicago@resource.calendar.google.com");
  });

  test("F-resource-without-google-domain: resource=true is excluded even with a normal email", () => {
    const parsed = parseGoogleCalendarApiEvent(
      baseEvent({
        attendees: [
          { email: CALENDAR_OWNER_EMAIL, self: true },
          {
            email: "projector@624voice.com",
            displayName: "Projector",
            resource: true,
          },
          { email: "human.guest@example.com", displayName: "Human Guest" },
        ],
      }),
    );
    expect(parsed?.attendeeEmail).toBe("human.guest@example.com");
    expect(parsed?.attendeeEmail).not.toBe("projector@624voice.com");
  });

  test("G: multiple external humans — structured Booked-by email selects that candidate", () => {
    const parsed = parseGoogleCalendarApiEvent(
      baseEvent({
        description:
          "<b>Booked by</b>\nProspect Bee\nprospectB@example.com\n2145559999\n<br><b>Business Name</b>\nBee HVAC",
        attendees: [
          { email: CALENDAR_OWNER_EMAIL, self: true, organizer: true },
          { email: "prospectA@example.com", displayName: "Prospect A" },
          { email: "prospectB@example.com", displayName: "Prospect B" },
        ],
      }),
    );
    expect(parsed?.attendeeEmail).toBe("prospectB@example.com");
    expect(parsed?.attendeeName).toBe("Prospect B");
    expect(parsed?.attendeeEmail).not.toBe("prospectA@example.com");
  });

  test("H: multiple external humans with no reliable identity do not pick by array order", () => {
    const forward = parseGoogleCalendarApiEvent(
      baseEvent({
        description: "Quarterly planning session.",
        attendees: [
          { email: CALENDAR_OWNER_EMAIL, self: true },
          { email: "prospectA@example.com", displayName: "Prospect A" },
          { email: "prospectB@example.com", displayName: "Prospect B" },
        ],
      }),
    );
    const reversed = parseGoogleCalendarApiEvent(
      baseEvent({
        description: "Quarterly planning session.",
        attendees: [
          { email: CALENDAR_OWNER_EMAIL, self: true },
          { email: "prospectB@example.com", displayName: "Prospect B" },
          { email: "prospectA@example.com", displayName: "Prospect A" },
        ],
      }),
    );
    expect(forward?.attendeeEmail).toBeUndefined();
    expect(reversed?.attendeeEmail).toBeUndefined();
    expect(forward?.attendeeEmail).not.toBe("prospectA@example.com");
    expect(forward?.attendeeEmail).not.toBe("prospectB@example.com");
    expect(forward?.attendeeName).toBeUndefined();
  });

  test("attendee order does not change a unique external guest", () => {
    const attendees = [
      { email: CALENDAR_OWNER_EMAIL, self: true, organizer: true },
      { email: "order.guest@example.com", displayName: "Order Guest" },
    ];
    const a = parseGoogleCalendarApiEvent(baseEvent({ attendees }));
    const b = parseGoogleCalendarApiEvent(baseEvent({ attendees: [...attendees].reverse() }));
    expect(a?.attendeeEmail).toBe("order.guest@example.com");
    expect(b?.attendeeEmail).toBe("order.guest@example.com");
    expect(a?.attendeeName).toBe("Order Guest");
    expect(b?.attendeeName).toBe("Order Guest");
  });

  test("self/owner is never selected when a valid external guest exists", () => {
    const parsed = parseGoogleCalendarApiEvent(
      baseEvent({
        creator: { email: CALENDAR_OWNER_EMAIL, self: true },
        organizer: { email: CALENDAR_OWNER_EMAIL, self: true },
        attendees: [
          { email: CALENDAR_OWNER_EMAIL, organizer: true, self: true },
          { email: "external.human@example.com" },
        ],
      }),
    );
    expect(parsed?.attendeeEmail).toBe("external.human@example.com");
    expect(parsed?.attendeeEmail).not.toBe(CALENDAR_OWNER_EMAIL);
  });

  test("creator.email alone does not exclude an external creator who is the prospect", () => {
    const parsed = parseGoogleCalendarApiEvent(
      baseEvent({
        creator: { email: "creator.prospect@example.com" },
        organizer: { email: CALENDAR_OWNER_EMAIL, self: true },
        attendees: [
          { email: CALENDAR_OWNER_EMAIL, self: true },
          { email: "creator.prospect@example.com", displayName: "Creator Prospect" },
        ],
      }),
    );
    expect(parsed?.attendeeEmail).toBe("creator.prospect@example.com");
  });

  test("tel: URI in description wins over a numeric-local-part email", () => {
    const parsed = parseGoogleCalendarApiEvent(
      baseEvent({
        description:
          "Guest 1788905100222@example.com booked via form.\nCall tel:+12145559876",
        attendees: [
          { email: CALENDAR_OWNER_EMAIL, self: true, organizer: true },
          { email: "tel.guest@example.com" },
        ],
      }),
    );
    expect(parsed?.attendeeEmail).toBe("tel.guest@example.com");
    expect(parsed?.attendeePhone).toBe("+12145559876");
    expect(parsed?.attendeePhone).not.toBe(FALSE_PHONE_FROM_EMAIL_LOCAL_PART);
  });

  test("unreliable parenthetical summary is not used as a guest name", () => {
    const parsed = parseGoogleCalendarApiEvent(
      baseEvent({
        summary: "Team sync (Q3 planning)",
        description: "Internal notes only.",
        attendees: [{ email: "nameless.guest@example.com" }],
      }),
    );
    expect(parsed?.attendeeEmail).toBe("nameless.guest@example.com");
    expect(parsed?.attendeeName).toBeUndefined();
  });
});
