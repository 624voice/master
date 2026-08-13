import { describe, expect, test } from "bun:test";
import {
  shouldExpireReschedulePending,
  shouldSendReminders,
  isActiveLifecycle,
} from "~/server/appointmentLifecycle/store";
import type { AppointmentLifecycleRecord } from "~/server/appointmentLifecycle/types";

function record(overrides: Partial<AppointmentLifecycleRecord> = {}): AppointmentLifecycleRecord {
  return {
    calendarEventId: "evt-1",
    appointmentStart: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    appointmentEnd: new Date(Date.now() + 73 * 60 * 60 * 1000).toISOString(),
    timezone: "America/Chicago",
    eventStatus: "confirmed",
    lifecycleStatus: "confirmed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("store lifecycle invariants", () => {
  test("superseded lifecycle is not active", () => {
    expect(isActiveLifecycle(record({ lifecycleStatus: "superseded" }))).toBe(false);
  });

  test("reschedule_pending suppresses reminders", () => {
    expect(
      shouldSendReminders(
        record({
          lifecycleStatus: "reschedule_pending",
          remindersSuppressed: true,
          confirmationSentAt: new Date().toISOString(),
        }),
      ),
    ).toBe(false);
  });

  test("stale reschedule_pending expires after 48h", () => {
    expect(
      shouldExpireReschedulePending(
        record({
          lifecycleStatus: "reschedule_pending",
          reschedulePendingAt: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString(),
        }),
      ),
    ).toBe(true);
  });

  test("incomplete reschedule within 48h stays pending", () => {
    expect(
      shouldExpireReschedulePending(
        record({
          lifecycleStatus: "reschedule_pending",
          reschedulePendingAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        }),
      ),
    ).toBe(false);
  });
});
