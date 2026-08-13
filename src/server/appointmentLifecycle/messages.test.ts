import { describe, expect, test } from "bun:test";
import {
  bookingConfirmationMessage,
  reminder24hMessage,
  reminder2hMessage,
  rescheduleConfirmationMessage,
} from "~/server/appointmentLifecycle/messages";

describe("appointment messages", () => {
  const ctx = {
    firstName: "Jane",
    businessName: "Jane HVAC",
    source: "demo" as const,
    appointmentStart: "2026-08-15T20:00:00.000Z",
    timezone: "America/Chicago",
    meetingLink: "https://meet.google.com/abc-defg-hij",
  };

  test("confirmation includes name, date, and change instructions", () => {
    const msg = bookingConfirmationMessage(ctx);
    expect(msg).toContain("Jane");
    expect(msg).toContain("you're booked");
    expect(msg).toContain("RESCHEDULE or CANCEL");
    expect(msg).toContain("meet.google.com");
    expect(msg).toContain("Jessica");
  });

  test("confirmation omits meeting link when absent", () => {
    const msg = bookingConfirmationMessage({ ...ctx, meetingLink: undefined });
    expect(msg).not.toContain("Meeting link:");
  });

  test("24h reminder mentions tomorrow", () => {
    const msg = reminder24hMessage(ctx);
    expect(msg).toContain("624Voice");
    expect(msg).toContain("tomorrow");
  });

  test("2h reminder is short", () => {
    const msg = reminder2hMessage(ctx);
    expect(msg).toContain("looking forward");
    expect(msg).toContain("meet.google.com");
  });

  test("reschedule confirmation differs from first booking wording", () => {
    const msg = rescheduleConfirmationMessage(ctx);
    expect(msg).toContain("you're moved");
    expect(msg).not.toContain("you're booked");
  });
});
