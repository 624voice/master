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

  test("24h reminder fires in window", () => {
    const now = new Date();
    const start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const r = record({
      appointmentStart: start.toISOString(),
      confirmationSentAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    });
    expect(shouldSend24hReminder(r, now)).toBe(true);
  });

  test("2h reminder fires in window", () => {
    const now = new Date();
    const start = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const r = record({
      appointmentStart: start.toISOString(),
      reminder24hSentAt: new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString(),
      confirmationSentAt: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
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
