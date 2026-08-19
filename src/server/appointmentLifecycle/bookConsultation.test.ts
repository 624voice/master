import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import type {
  AppointmentLifecycleRecord,
  LeadIndexEntry,
} from "~/server/appointmentLifecycle/types";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { centralDateAt, parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import * as realStore from "~/server/appointmentLifecycle/store";

const lifecycleStore = new Map<string, AppointmentLifecycleRecord>();
const leadStore = new Map<string, LeadIndexEntry[]>();
const activePhone = new Map<string, string>();
const smsLog: Array<{ phone: string; body: string; type?: string }> = [];
const optOut = new Set<string>();
const redisStore = new Map<string, unknown>();
const calendarEvents: Array<{
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  updated?: string;
}> = [];
let createAttempts = 0;

const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDHcXTKGarLjzE2
auPXoDIQdHDqVgHCydJvK056rzm7U3NZayDBWf/g/DBSGsYpg19BM8hn6vSj9fAM
F7YdaUt5uENlZ6OmgHjyauNkVyBVH5tVdbncenFhBSZsLNDL35pTDPN1ReWBYZa2
cO3opi6KGhwjPzOrc/YRpm5FNNc0IrQZmJIAwFZIIqp5WFN+I/j3zz+0EaC83PHC
jxye3C3IXgmU0gPPCQMrnJ02BURgt3nHAKB7qJmidj/vcQrBuExq5h6Ap/bRG+Ao
1Wn+6HEnA/LcLQD8PbgXG4thL3KlcPrDsrlFpAZ7vNigsCv3S7QPsEooIJhBYoHZ
PkY1wOxnAgMBAAECggEADzKkFapzC2Pz+hOXHR1F818MI68+HxvF/1areknT+mRX
i97P9ivnhbtx6y/DHfK21X8erFyJG91n12QPKpqVd8cEy7tkCxILJV3jygehnRr1
eUOpUBW8ggokbWXU21RErEN2Yd9bp8pJ88kTOAFB1qA6uKzeQRhrDdlC2d827u/7
lT46nVcUVTjITGrBG+LhKCVKvCHunSv3brYTNTeCQKG3H2uDVuxHMUe94W9whdbd
mBmZeWoiBSdZlZ1Sp6HhIQGciSHiJN7whatq8vteQiL8I87LHeXLjtpt3xQwRcwC
kocrU5qnqqUSb6UVEwv9qw+eI9+epcGH26gE4Um3EQKBgQDr6uBkk8eHa+x7NAvq
MD26OQqM97p7m7sD9y3ZLC5geKniC6XrgRCnKpDY2cK/vXIpJC2CB8oVKegFPFdy
oET1FbrDKlZ7NUe0tZKulUVOR84cYkbGK7NLfP1+YZX2U2SzQlBqOjXDMjiFvgYV
7Kf/XT1Xt1szngl5XlqAyPNUtQKBgQDYa7rz7q3hZsP/o3aSlpa8fQcwxBkUkQ7U
IQMMiCwI+PiMxTfYnYwxEc/Vhh/D1DSh/WTTdM/iueUhiDLnVP4ECeEnUeNpA2yM
0N4F0umBhqtQpJqFNf3kn41ASQDCcm5FvCSY7JJ9qJ7SYyaDHpOs9DPvss7mq1Xf
7C8ZHowqKwKBgF5acuJm5D86H7tqpnVEU/u9woV8sp2rPBGq8zBPZkD5IWChrftR
hDqHYKUJ+sS63QStTnIZ8W2jdANcDdFvXgTzat2RekMOnR4eHIssciqLt1hMyeeK
JMxFMhEwsExzL+wt0oGZxFTMKiT7Se3M16ffP6BsWdJ8G2fqH6IwPHmdAoGBAI0G
1pKyS9h/sOTazh+DxcIZ7x+WCYnfZLxSrrvx2FAYfU6uDVA4iexH4RkRB44CsDGG
/7bTfcwOuwL4z8LzHXvgPDn1IK2Dr66rRKKi58qhyO0J9i8sGcBrQA5OBBKxoq4K
hgao0mTUBnquZaA3wp+HmnhuGmkx6Qm7zI0f3NJ1AoGBANwJHPmhRpg2TwdZZVgm
e0qDBEWAIiEGhLOTEL+a3yexyvRdFer7frcicO6jKx7f3RZtISv05Ov4MXoVj5Sh
31FoUqWFlED7/HyfJuz66KJG9sPVcgUcTz2zvTBF0wAEKS4/r6W7m7JbPJ6EFVGM
X/nyTQPJ4bTW1iF409XT1KO/
-----END PRIVATE KEY-----`;

const originalFetch = globalThis.fetch;

mock.module("~/server/appointmentLifecycle/store", () => ({
  ...realStore,
  getLifecycleRecord: async (id: string) => lifecycleStore.get(id) ?? null,
  saveLifecycleRecord: async (record: AppointmentLifecycleRecord) => {
    lifecycleStore.set(record.calendarEventId, record);
    if (record.phone) {
      if (
        ["cancelled", "completed", "unmatched_booking", "superseded"].includes(
          record.lifecycleStatus,
        )
      ) {
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
    if (
      !record ||
      ["cancelled", "completed", "unmatched_booking", "superseded"].includes(
        record.lifecycleStatus,
      )
    ) {
      return null;
    }
    return record;
  },
  supersedeActiveLifecycle: async (
    old: AppointmentLifecycleRecord,
    newEventId: string,
    opts: { manualCleanupRequired?: boolean },
  ) => {
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

mock.module("~/server/speed2Lead/redis", () => ({
  getRedis: () => ({
    get: async <T>(key: string) => (redisStore.get(key) as T | undefined) ?? null,
    set: async (key: string, value: unknown) => {
      redisStore.set(key, value);
    },
    del: async (key: string) => {
      redisStore.delete(key);
    },
  }),
}));

function installFetchMock() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 }), {
        status: 200,
      });
    }

    if (url.includes("/events") && init?.method === "POST") {
      createAttempts += 1;
      const body = JSON.parse(String(init.body)) as {
        start: { dateTime: string };
        end: { dateTime: string };
        description?: string;
      };
      const created = {
        id: `agent-evt-${createAttempts}`,
        status: "confirmed",
        summary: "624Voice AI Consultation - Jane HVAC",
        description: body.description,
        start: { dateTime: body.start.dateTime, timeZone: CONSULTATION_TIMEZONE },
        end: { dateTime: body.end.dateTime, timeZone: CONSULTATION_TIMEZONE },
        updated: new Date().toISOString(),
      };
      calendarEvents.push(created);
      return new Response(JSON.stringify(created), { status: 200 });
    }

    if (url.includes("/events/") && !init?.method) {
      const eventId = decodeURIComponent(url.split("/events/")[1] ?? "");
      const found = calendarEvents.find((event) => event.id === eventId);
      return found
        ? new Response(JSON.stringify(found), { status: 200 })
        : new Response("missing", { status: 404 });
    }

    if (url.includes("/events?")) {
      return new Response(JSON.stringify({ items: calendarEvents }), { status: 200 });
    }

    return originalFetch(input, init);
  }) as typeof fetch;
}

const { bookConsultation } = await import("~/server/appointmentLifecycle/bookConsultation");
const { processCalendarEvent } = await import("~/server/appointmentLifecycle/processEvent");
const { resetGoogleTokenCacheForTests } = await import(
  "~/server/appointmentLifecycle/googleCalendar"
);

const TZ = CONSULTATION_TIMEZONE;
const phone = "+15551234567";

function futureWeekdaySlot(hour: number, minute: number): Date {
  let candidate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  for (let i = 0; i < 14; i++) {
    const parts = parseCentralParts(candidate, TZ);
    if (parts.weekday !== "Sat" && parts.weekday !== "Sun") {
      return centralDateAt(parts.year, parts.month, parts.day, hour, minute, TZ);
    }
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  throw new Error("No future weekday found for test slot");
}

function lead(overrides: Partial<LeadIndexEntry> = {}): LeadIndexEntry {
  return {
    phone,
    email: "jane@example.com",
    firstName: "Jane",
    businessName: "Jane HVAC",
    source: "roi",
    smsConsent: true,
    registeredAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("bookConsultation lifecycle integration", () => {
  let slotStart: Date;
  let availabilityNow: Date;

  beforeEach(() => {
    slotStart = futureWeekdaySlot(10, 0);
    availabilityNow = new Date(slotStart.getTime() - 60 * 60 * 1000);
    lifecycleStore.clear();
    leadStore.clear();
    activePhone.clear();
    smsLog.length = 0;
    optOut.clear();
    redisStore.clear();
    calendarEvents.length = 0;
    createAttempts = 0;
    leadStore.set(phone, [lead()]);
    resetGoogleTokenCacheForTests();
    installFetchMock();

    process.env.GOOGLE_CALENDAR_ID = "test-calendar";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "agent@test.iam.gserviceaccount.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = TEST_PRIVATE_KEY;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  test("successful agent-created booking enters lifecycle exactly once", async () => {
    const result = await bookConsultation({
      start: slotStart.toISOString(),
      attendeeName: "Jane Doe",
      attendeeEmail: "jane@example.com",
      phone,
      businessName: "Jane HVAC",
      source: "roi",
      now: availabilityNow,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.lifecycle.action).toBe("created");
    expect(result.lifecycle.smsSent).toBe(true);
    expect(smsLog.length).toBe(1);

    const record = lifecycleStore.get(result.eventId);
    expect(record?.confirmationSentAt).toBeTruthy();
    expect(record?.lifecycleStatus).toBe("confirmed");
  });

  test("Apps Script sync does not duplicate lifecycle confirmation", async () => {
    const booked = await bookConsultation({
      start: slotStart.toISOString(),
      attendeeName: "Jane Doe",
      attendeeEmail: "jane@example.com",
      phone,
      source: "roi",
      now: availabilityNow,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    smsLog.length = 0;

    const syncResult = await processCalendarEvent({
      calendarEventId: booked.eventId,
      status: "confirmed",
      appointmentStart: slotStart.toISOString(),
      appointmentEnd: new Date(slotStart.getTime() + 25 * 60_000).toISOString(),
      timezone: TZ,
      attendeePhone: phone,
      attendeeEmail: "jane@example.com",
      attendeeName: "Jane Doe",
      updatedAt: new Date().toISOString(),
    });

    expect(syncResult.action).toBe("duplicate_skipped");
    expect(smsLog.length).toBe(0);
  });

  test("idempotent bookConsultation replay does not duplicate lifecycle SMS", async () => {
    const input = {
      start: slotStart.toISOString(),
      attendeeName: "Jane Doe",
      phone,
      source: "demo" as const,
      now: availabilityNow,
    };

    const first = await bookConsultation(input);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    smsLog.length = 0;

    const second = await bookConsultation(input);
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.replayed).toBe(true);
    expect(second.lifecycle.action).toBe("duplicate_skipped");
    expect(smsLog.length).toBe(0);
    expect(createAttempts).toBe(1);
  });
});
