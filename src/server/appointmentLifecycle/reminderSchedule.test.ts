import { describe, expect, test } from "bun:test";
import {
  shouldSend24hReminder,
  shouldSend2hReminder,
  shouldSkip24hForLeadTime,
  shouldSkip2hForLeadTime,
} from "~/server/appointmentLifecycle/reminderSchedule";
import type { AppointmentLifecycleRecord } from "~/server/appointmentLifecycle/types";

function record(overrides: Partial<AppointmentLifecycleRecord> = {}): AppointmentLifecycleRecord {
  return {
    calendarEventId: "evt-1",
    appointmentStart: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
    appointmentEnd: new Date(Date.now() + 25.5 * 60 * 60 * 1000).toISOString(),
    timezone: "America/Chicago",
    eventStatus: "confirmed",
    lifecycleStatus: "confirmed",
    confirmationSentAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Wed Aug 26 2026 10:30am America/Chicago (CDT, UTC−5). */
const WED_1030_CT_START = "2026-08-26T15:30:00.000Z";

function wed1030Record(overrides: Partial<AppointmentLifecycleRecord> = {}): AppointmentLifecycleRecord {
  return record({
    appointmentStart: WED_1030_CT_START,
    appointmentEnd: "2026-08-26T15:55:00.000Z",
    confirmationSentAt: "2026-08-24T18:07:41.695Z",
    ...overrides,
  });
}

describe("reminderSchedule", () => {
  test("booking >24h away schedules confirmation + 24h + 2h", () => {
    const start = new Date(Date.now() + 30 * 60 * 60 * 1000);
    const r = record({
      appointmentStart: start.toISOString(),
      confirmationSentAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    expect(shouldSkip24hForLeadTime(r)).toBe(false);
    expect(shouldSkip2hForLeadTime(r)).toBe(false);
  });

  test("booking 12h away skips 24h reminder", () => {
    const start = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const confirmedAt = new Date();
    const r = record({ appointmentStart: start.toISOString() });
    expect(shouldSkip24hForLeadTime(r, confirmedAt)).toBe(true);
    expect(shouldSkip2hForLeadTime(r, confirmedAt)).toBe(false);
  });

  test("booking 90m away skips both follow-up reminders at confirm time", () => {
    const start = new Date(Date.now() + 90 * 60 * 1000);
    const confirmedAt = new Date();
    const r = record({ appointmentStart: start.toISOString() });
    expect(shouldSkip24hForLeadTime(r, confirmedAt)).toBe(true);
    expect(shouldSkip2hForLeadTime(r, confirmedAt)).toBe(true);
  });

  test("24h reminder does not send after cancellation", () => {
    const r = record({ lifecycleStatus: "cancelled" });
    expect(shouldSend24hReminder(r)).toBe(false);
  });

  test("24h reminder does not send twice", () => {
    const r = record({ reminder24hSentAt: new Date().toISOString() });
    expect(shouldSend24hReminder(r)).toBe(false);
  });

  test("24h reminder fires at exactly T−24h", () => {
    const start = new Date("2026-08-26T15:30:00.000Z");
    const now = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const r = record({
      appointmentStart: start.toISOString(),
      confirmationSentAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    });
    expect(shouldSend24hReminder(r, now)).toBe(true);
  });

  test("2h reminder fires at exactly T−2h", () => {
    const start = new Date("2026-08-26T15:30:00.000Z");
    const now = new Date(start.getTime() - 2 * 60 * 60 * 1000);
    const r = record({
      appointmentStart: start.toISOString(),
      reminder24hSentAt: new Date(start.getTime() - 25 * 60 * 60 * 1000).toISOString(),
      confirmationSentAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    });
    expect(shouldSend2hReminder(r, now)).toBe(true);
  });

  test("rescheduled event resets reminder eligibility via cleared timestamps", () => {
    const now = new Date();
    const newStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const r = record({
      appointmentStart: newStart.toISOString(),
      reminder24hSentAt: undefined,
      reminder2hSentAt: undefined,
      confirmationSentAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
    });
    expect(shouldSend24hReminder(r, now)).toBe(true);
  });
});

describe("precise reminder windows (never send early)", () => {
  const start = new Date(WED_1030_CT_START);
  const r = wed1030Record();

  test("24h reminder is false at T−24h−1 minute", () => {
    const now = new Date(start.getTime() - 24 * 60 * 60 * 1000 - 60 * 1000);
    expect(shouldSend24hReminder(r, now)).toBe(false);
  });

  test("24h reminder is true at exactly T−24h", () => {
    const now = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    expect(shouldSend24hReminder(r, now)).toBe(true);
  });

  test("24h reminder remains eligible within approved late window (T−23h)", () => {
    const now = new Date(start.getTime() - 23 * 60 * 60 * 1000);
    expect(shouldSend24hReminder(r, now)).toBe(true);
  });

  test("24h reminder is false after late window closes", () => {
    const now = new Date(start.getTime() - 23 * 60 * 60 * 1000 + 60 * 1000);
    expect(shouldSend24hReminder(r, now)).toBe(false);
  });

  test("24h reminder is not sent twice", () => {
    const now = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const sent = wed1030Record({ reminder24hSentAt: now.toISOString() });
    expect(shouldSend24hReminder(sent, now)).toBe(false);
  });

  test("2h reminder is false at T−2h−1 minute", () => {
    const now = new Date(start.getTime() - 2 * 60 * 60 * 1000 - 60 * 1000);
    expect(shouldSend2hReminder(r, now)).toBe(false);
  });

  test("2h reminder is true at exactly T−2h", () => {
    const now = new Date(start.getTime() - 2 * 60 * 60 * 1000);
    expect(shouldSend2hReminder(r, now)).toBe(true);
  });

  test("2h reminder remains eligible within approved late window (T−1h30m)", () => {
    const now = new Date(start.getTime() - 90 * 60 * 1000);
    expect(shouldSend2hReminder(r, now)).toBe(true);
  });

  test("2h reminder is false after late window closes", () => {
    const now = new Date(start.getTime() - 90 * 60 * 1000 + 60 * 1000);
    expect(shouldSend2hReminder(r, now)).toBe(false);
  });

  test("2h reminder is not sent twice", () => {
    const now = new Date(start.getTime() - 2 * 60 * 60 * 1000);
    const sent = wed1030Record({ reminder2hSentAt: now.toISOString() });
    expect(shouldSend2hReminder(sent, now)).toBe(false);
  });
});

describe("Wednesday 10:30am CT live booking timing", () => {
  const r = wed1030Record();

  test("24h cannot send Tuesday 9:30am CT", () => {
    expect(shouldSend24hReminder(r, new Date("2026-08-25T14:30:00.000Z"))).toBe(false);
  });

  test("24h can send Tuesday 10:30am CT", () => {
    expect(shouldSend24hReminder(r, new Date("2026-08-25T15:30:00.000Z"))).toBe(true);
  });

  test("2h cannot send Wednesday 8:00am CT", () => {
    expect(shouldSend2hReminder(r, new Date("2026-08-26T13:00:00.000Z"))).toBe(false);
  });

  test("2h can send Wednesday 8:30am CT", () => {
    expect(shouldSend2hReminder(r, new Date("2026-08-26T13:30:00.000Z"))).toBe(true);
  });
});

describe("timezone handling", () => {
  test("uses absolute UTC instants so America/Chicago DST is respected", () => {
    const start = "2026-08-26T15:30:00.000Z";
    const r = record({
      appointmentStart: start,
      timezone: "America/Chicago",
      confirmationSentAt: "2026-08-24T18:00:00.000Z",
    });
    expect(shouldSend24hReminder(r, new Date("2026-08-25T14:30:00.000Z"))).toBe(false);
    expect(shouldSend24hReminder(r, new Date("2026-08-25T15:30:00.000Z"))).toBe(true);
  });
});
