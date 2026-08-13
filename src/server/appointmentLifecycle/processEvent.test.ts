import { describe, expect, test, mock, beforeEach } from "bun:test";
import type { LeadIndexEntry, NormalizedCalendarEvent } from "~/server/appointmentLifecycle/types";

const lifecycleStore = new Map<string, unknown>();
const leadStore = new Map<string, LeadIndexEntry>();
const emailIndex = new Map<string, string>();
const smsLog: Array<{ phone: string; body: string; type?: string }> = [];

mock.module("~/server/appointmentLifecycle/store", () => ({
  getLifecycleRecord: async (id: string) => lifecycleStore.get(`lifecycle:${id}`) ?? null,
  saveLifecycleRecord: async (record: { calendarEventId: string }) => {
    lifecycleStore.set(`lifecycle:${record.calendarEventId}`, record);
  },
  getLeadByPhone: async (phone: string) => leadStore.get(phone) ?? null,
  getLeadByEmail: async (email: string) => {
    const phone = emailIndex.get(email.toLowerCase());
    return phone ? leadStore.get(phone) ?? null : null;
  },
  findRecentLeadsByName: async (firstName: string, lastName?: string) => {
    return [...leadStore.values()].filter((l) => {
      if (l.firstName.toLowerCase() !== firstName.toLowerCase()) return false;
      if (lastName && l.lastName && l.lastName.toLowerCase() !== lastName.toLowerCase()) return false;
      return true;
    });
  },
  saveLeadIndex: async (entry: LeadIndexEntry) => {
    leadStore.set(entry.phone, entry);
    if (entry.email) emailIndex.set(entry.email.toLowerCase(), entry.phone);
  },
  getActiveLifecycleForPhone: async () => null,
  getReminderIndexEventIds: async () => [],
  getSyncCursor: async () => null,
  setSyncCursor: async () => {},
  markSelfReportedBooking: async () => {},
}));

mock.module("~/server/appointmentLifecycle/sms", () => ({
  sendLifecycleSms: async (phone: string, body: string, meta?: { messageType?: string }) => {
    smsLog.push({ phone, body, type: meta?.messageType });
  },
}));

mock.module("~/server/speed2Lead/session", () => ({
  isOptedOut: async () => false,
  getSession: async () => null,
  saveSession: async () => {},
  clearSession: async () => {},
  setOptedOut: async () => {},
}));

mock.module("~/server/demoSpeed2Lead/processFollowUps", () => ({
  removeDemoFollowUp: async () => {},
  registerDemoFollowUp: async () => {},
}));

const { processCalendarEvent } = await import("~/server/appointmentLifecycle/processEvent");

function event(overrides: Partial<NormalizedCalendarEvent> = {}): NormalizedCalendarEvent {
  return {
    calendarEventId: "evt-test-1",
    status: "confirmed",
    appointmentStart: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    appointmentEnd: new Date(Date.now() + 48.5 * 60 * 60 * 1000).toISOString(),
    timezone: "America/Chicago",
    attendeePhone: "+15551234567",
    attendeeEmail: "jane@example.com",
    attendeeName: "Jane Doe",
    meetingLink: "https://meet.google.com/test",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function seedLead() {
  leadStore.set("+15551234567", {
    phone: "+15551234567",
    email: "jane@example.com",
    firstName: "Jane",
    businessName: "Jane HVAC",
    source: "roi",
    registeredAt: new Date().toISOString(),
  });
  emailIndex.set("jane@example.com", "+15551234567");
}

describe("processEvent", () => {
  beforeEach(() => {
    lifecycleStore.clear();
    leadStore.clear();
    emailIndex.clear();
    smsLog.length = 0;
  });

  test("new booking sends one confirmation", async () => {
    seedLead();
    const result = await processCalendarEvent(event());
    expect(result.action).toBe("created");
    expect(result.smsSent).toBe(true);
    expect(smsLog.length).toBe(1);
    expect(smsLog[0]?.body).toContain("you're booked");
  });

  test("duplicate event notification does not duplicate confirmation", async () => {
    seedLead();
    await processCalendarEvent(event());
    const second = await processCalendarEvent(event());
    expect(second.action).toBe("duplicate_skipped");
    expect(smsLog.length).toBe(1);
  });

  test("unmatched event sends no SMS", async () => {
    const result = await processCalendarEvent(
      event({ attendeePhone: "+15559999999", attendeeEmail: "unknown@test.com" }),
    );
    expect(result.action).toBe("unmatched");
    expect(smsLog.length).toBe(0);
  });

  test("reschedule sends one reschedule confirmation not a new booking tone", async () => {
    seedLead();
    await processCalendarEvent(event());
    smsLog.length = 0;
    const rescheduled = event({
      appointmentStart: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      appointmentEnd: new Date(Date.now() + 72.5 * 60 * 60 * 1000).toISOString(),
    });
    const result = await processCalendarEvent(rescheduled);
    expect(result.action).toBe("rescheduled");
    expect(smsLog.length).toBe(1);
    expect(smsLog[0]?.body).toContain("you're moved");
  });

  test("source metadata retained in lifecycle record", async () => {
    seedLead();
    await processCalendarEvent(event());
    const stored = lifecycleStore.get("lifecycle:evt-test-1") as { source?: string };
    expect(stored?.source).toBe("roi");
  });
});
