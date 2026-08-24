import { describe, expect, test } from "bun:test";
import {
  bookingConfirmationMessage,
  reminder24hMessage,
  reminder2hMessage,
} from "~/server/appointmentLifecycle/messages";
import {
  shouldSend24hReminder,
  shouldSend2hReminder,
  shouldSkip24hForLeadTime,
  shouldSkip2hForLeadTime,
} from "~/server/appointmentLifecycle/reminderSchedule";
import type { AppointmentLifecycleRecord } from "~/server/appointmentLifecycle/types";
import { supportsAttendeeInvites } from "~/server/appointmentLifecycle/googleCalendar";
import { buildBookingProviderFailureCopy } from "~/server/scheduling/service";
import type { SchedulingTurnResult } from "~/server/scheduling/types";

const MEET_URL = "https://meet.google.com/abc-defg-hij";

function lifecycleRecord(
  overrides: Partial<AppointmentLifecycleRecord> = {},
): AppointmentLifecycleRecord {
  const start = new Date(Date.now() + 30 * 60 * 60 * 1000);
  return {
    calendarEventId: "evt-1",
    appointmentStart: start.toISOString(),
    appointmentEnd: new Date(start.getTime() + 25 * 60_000).toISOString(),
    timezone: "America/Chicago",
    eventStatus: "confirmed",
    lifecycleStatus: "confirmed",
    meetingLink: MEET_URL,
    confirmationSentAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Google Meet booking invariants", () => {
  test("service-account provider disables attendee invites", () => {
    expect(supportsAttendeeInvites()).toBe(false);
  });

  test("booking confirmation includes persisted Meet URL and not email-invite copy", () => {
    const msg = bookingConfirmationMessage({
      firstName: "Alex",
      appointmentStart: "2026-08-26T14:00:00.000Z",
      timezone: "America/Chicago",
      meetingLink: MEET_URL,
    });
    expect(msg).toContain(MEET_URL);
    expect(msg).toContain("Google Meet link:");
    expect(msg).not.toMatch(/email(ed)? you a calendar invite/i);
  });

  test("24-hour and 2-hour reminders share the same Meet URL", () => {
    const ctx = {
      firstName: "Alex",
      appointmentStart: "2026-08-26T14:00:00.000Z",
      timezone: "America/Chicago",
      meetingLink: MEET_URL,
    };
    expect(reminder24hMessage(ctx)).toContain(MEET_URL);
    expect(reminder2hMessage(ctx)).toContain(MEET_URL);
  });

  test("reminder schedule targets start minus 24h and 2h windows", () => {
    const now = new Date("2026-08-25T14:00:00.000Z");
    const start = new Date("2026-08-26T14:00:00.000Z");
    const record = lifecycleRecord({
      appointmentStart: start.toISOString(),
      confirmationSentAt: new Date("2026-08-24T14:00:00.000Z").toISOString(),
    });
    expect(shouldSkip24hForLeadTime(record, now)).toBe(false);
    expect(shouldSkip2hForLeadTime(record, now)).toBe(false);
    expect(shouldSend24hReminder(record, now)).toBe(true);
    expect(shouldSend2hReminder(record, new Date("2026-08-26T12:00:00.000Z"))).toBe(true);
  });

  test("cancelled bookings suppress reminders", () => {
    const record = lifecycleRecord({ lifecycleStatus: "cancelled" });
    expect(shouldSend24hReminder(record)).toBe(false);
    expect(shouldSend2hReminder(record)).toBe(false);
  });

  test("rescheduled start clears prior reminder send timestamps", () => {
    const record = lifecycleRecord({
      reminder24hSentAt: new Date().toISOString(),
      reminder2hSentAt: new Date().toISOString(),
      appointmentStart: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });
    expect(record.reminder24hSentAt).toBeDefined();
    expect(record.reminder2hSentAt).toBeDefined();
  });

  test("booking-stage provider failure uses booking-specific recovery copy", () => {
    const result = {
      outcome: "PROVIDER_ERROR",
      offeredSlots: ["2026-08-26T14:00:00.000Z"],
      trace: {
        bookingAttempted: true,
        selectionResolved: true,
        selectedStart: "2026-08-26T14:00:00.000Z",
        detailedFailureStage: "calendar_insert_error",
      },
    } as SchedulingTurnResult;

    const copy = buildBookingProviderFailureCopy(result);
    expect(copy).toContain("couldn't finish booking");
    expect(copy).not.toContain("pulling my calendar up");
  });
});
