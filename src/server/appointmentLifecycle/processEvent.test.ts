import { describe, expect, test, mock, beforeEach } from "bun:test";
import type {
  AppointmentLifecycleRecord,
  LeadIndexEntry,
  NormalizedCalendarEvent,
} from "~/server/appointmentLifecycle/types";
import { leadHasSmsConsent, canSendLifecycleSms } from "~/server/appointmentLifecycle/smsEligibility";

const lifecycleStore = new Map<string, AppointmentLifecycleRecord>();
const leadStore = new Map<string, LeadIndexEntry[]>();
const activePhone = new Map<string, string>();
const smsLog: Array<{ phone: string; body: string; type?: string }> = [];
const optOut = new Set<string>();

mock.module("~/server/appointmentLifecycle/store", () => ({
  getLifecycleRecord: async (id: string) => lifecycleStore.get(id) ?? null,
  saveLifecycleRecord: async (record: AppointmentLifecycleRecord) => {
    lifecycleStore.set(record.calendarEventId, record);
    if (record.phone) {
      if (["cancelled", "completed", "unmatched_booking", "superseded"].includes(record.lifecycleStatus)) {
        if (activePhone.get(record.phone) === record.calendarEventId) {
          activePhone.delete(record.phone);
        }
      } else {
        activePhone.set(record.phone, record.calendarEventId);
      }
    }
  },
  getLeadsByPhone: async (phone: string) => leadStore.get(phone) ?? [],
  getLeadByEmail: async (email: string) => {
    for (const leads of leadStore.values()) {
      const match = leads.find((l) => l.email?.toLowerCase() === email.toLowerCase());
      if (match) return match;
    }
    return null;
  },
  getActiveLifecycleForPhone: async (phone: string) => {
    const id = activePhone.get(phone);
    if (!id) return null;
    const record = lifecycleStore.get(id);
    if (!record || ["cancelled", "completed", "unmatched_booking", "superseded"].includes(record.lifecycleStatus)) {
      return null;
    }
    return record;
  },
  supersedeActiveLifecycle: async (old: AppointmentLifecycleRecord, newEventId: string, opts: { manualCleanupRequired?: boolean }) => {
    const superseded = {
      ...old,
      lifecycleStatus: "superseded" as const,
      rescheduledToEventId: newEventId,
      remindersSuppressed: true,
      manualCleanupRequired: opts.manualCleanupRequired,
      supersededAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    lifecycleStore.set(old.calendarEventId, superseded);
    return superseded;
  },
  getLeadForLifecycle: async (record: AppointmentLifecycleRecord) => {
    if (record.email) {
      for (const leads of leadStore.values()) {
        const match = leads.find((l) => l.email === record.email);
        if (match) return match;
      }
    }
    const leads = leadStore.get(record.phone ?? "") ?? [];
    return leads[0] ?? null;
  },
  getReminderIndexEventIds: async () => [...lifecycleStore.keys()],
  getSyncCursor: async () => null,
  setSyncCursor: async () => {},
}));

mock.module("~/server/appointmentLifecycle/sms", () => ({
  sendLifecycleSms: async (phone: string, body: string, meta?: { messageType?: string }) => {
    smsLog.push({ phone, body, type: meta?.messageType });
  },
}));

mock.module("~/server/speed2Lead/session", () => ({
  isOptedOut: async (phone: string) => optOut.has(phone),
  getSession: async () => null,
  saveSession: async () => {},
  clearSession: async () => {},
  setOptedOut: async () => {},
}));

mock.module("~/server/demoSpeed2Lead/processFollowUps", () => ({
  removeDemoFollowUp: async () => {},
}));

mock.module("~/server/appointmentLifecycle/googleCalendar", () => ({
  cancelCalendarEvent: async () => false,
  fetchCalendarEventsUpdatedSince: async () => [],
  isGoogleCalendarApiConfigured: () => false,
}));

const { processCalendarEvent } = await import("~/server/appointmentLifecycle/processEvent");

function lead(overrides: Partial<LeadIndexEntry> = {}): LeadIndexEntry {
  return {
    phone: "+15551234567",
    email: "jane@example.com",
    firstName: "Jane",
    businessName: "Jane HVAC",
    source: "roi",
    smsConsent: true,
    registeredAt: new Date().toISOString(),
    ...overrides,
  };
}

function event(id: string, overrides: Partial<NormalizedCalendarEvent> = {}): NormalizedCalendarEvent {
  return {
    calendarEventId: id,
    status: "confirmed",
    appointmentStart: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    appointmentEnd: new Date(Date.now() + 48.5 * 60 * 60 * 1000).toISOString(),
    timezone: "America/Chicago",
    attendeePhone: "+15551234567",
    attendeeEmail: "jane@example.com",
    attendeeName: "Jane Doe",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("processEvent production safety", () => {
  beforeEach(() => {
    lifecycleStore.clear();
    leadStore.clear();
    activePhone.clear();
    smsLog.length = 0;
    optOut.clear();
    leadStore.set("+15551234567", [lead()]);
  });

  test("matching lead with consent sends SMS", async () => {
    const result = await processCalendarEvent(event("evt-1"));
    expect(result.smsSent).toBe(true);
    expect(smsLog.length).toBe(1);
  });

  test("matching lead without consent sends no SMS", async () => {
    leadStore.set("+15551234567", [lead({ smsConsent: false })]);
    const result = await processCalendarEvent(event("evt-no-consent"));
    expect(result.smsSent).toBe(false);
    expect(smsLog.length).toBe(0);
  });

  test("opted-out lead sends no lifecycle SMS", async () => {
    optOut.add("+15551234567");
    const result = await processCalendarEvent(event("evt-optout"));
    expect(result.smsSent).toBe(false);
  });

  test("two different event IDs for same lead supersede old lifecycle", async () => {
    await processCalendarEvent(event("evt-old"));
    smsLog.length = 0;
    const result = await processCalendarEvent(event("evt-new"));
    expect(result.action).toBe("rescheduled");
    const old = lifecycleStore.get("evt-old");
    expect(old?.lifecycleStatus).toBe("superseded");
    expect(old?.remindersSuppressed).toBe(true);
    expect(activePhone.get("+15551234567")).toBe("evt-new");
  });

  test("duplicate calendar sync after booking does not duplicate confirmation", async () => {
    await processCalendarEvent(event("evt-1"));
    smsLog.length = 0;
    const dup = await processCalendarEvent(event("evt-1"));
    expect(dup.action).toBe("duplicate_skipped");
    expect(smsLog.length).toBe(0);
  });
});

describe("smsEligibility", () => {
  test("leadHasSmsConsent requires explicit true", () => {
    expect(leadHasSmsConsent(lead())).toBe(true);
    expect(leadHasSmsConsent(lead({ smsConsent: false }))).toBe(false);
  });

  test("canSendLifecycleSms blocks missing consent", async () => {
    const result = await canSendLifecycleSms("+15551234567", lead({ smsConsent: false }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("no_consent");
  });
});
