import { describe, expect, test } from "bun:test";
import {
  bookingConfirmationMessage,
  reminder24hMessage,
  reminder2hMessage,
} from "~/server/appointmentLifecycle/messages";
import {
  assertLifecycleMessageEncoding,
  countSmsSegments,
  isGsm7Safe,
} from "~/server/appointmentLifecycle/smsEncoding";

const ctx = {
  firstName: "Jane",
  businessName: "Jane HVAC",
  source: "demo" as const,
  appointmentStart: "2026-08-15T20:00:00.000Z",
  timezone: "America/Chicago",
  meetingLink: "https://meet.google.com/abc-defg-hij",
};

describe("appointment messages GSM-7", () => {
  test("confirmation uses SMS-safe punctuation", () => {
    const msg = bookingConfirmationMessage(ctx);
    expect(isGsm7Safe(msg)).toBe(true);
    expect(msg).toContain("Perfect, Jane - you're booked");
    expect(msg).toContain("Reply RESCHEDULE or CANCEL");
    assertLifecycleMessageEncoding("confirmation", msg);
  });

  test("24h reminder is GSM-7 safe", () => {
    const msg = reminder24hMessage(ctx);
    expect(isGsm7Safe(msg)).toBe(true);
    assertLifecycleMessageEncoding("24h", msg);
  });

  test("2h reminder is GSM-7 safe", () => {
    const msg = reminder2hMessage(ctx);
    expect(isGsm7Safe(msg)).toBe(true);
    assertLifecycleMessageEncoding("2h", msg);
  });

  test("representative segment counts", () => {
    const confirmation = bookingConfirmationMessage(ctx);
    const reminder24 = reminder24hMessage(ctx);
    const reminder2 = reminder2hMessage(ctx);

    const c = countSmsSegments(confirmation);
    const r24 = countSmsSegments(reminder24);
    const r2 = countSmsSegments(reminder2);

    expect(c.encoding).toBe("GSM-7");
    expect(r24.encoding).toBe("GSM-7");
    expect(r2.encoding).toBe("GSM-7");
    expect(c.segments).toBeGreaterThanOrEqual(1);
    expect(r24.segments).toBeGreaterThanOrEqual(1);
    expect(r2.segments).toBeGreaterThanOrEqual(1);

    // Log-friendly assertions for report
    expect(c.segments).toBeLessThanOrEqual(3);
    expect(r24.segments).toBeLessThanOrEqual(3);
    expect(r2.segments).toBeLessThanOrEqual(2);
  });
});

describe("Twilio Smart Encoding", () => {
  test("not configured in codebase", () => {
    expect(process.env.TWILIO_MESSAGING_SERVICE_SID).toBeUndefined();
    // sendSms uses plain body without smartEncoded flag
  });
});
