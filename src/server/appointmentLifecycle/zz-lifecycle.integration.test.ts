import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import type {
  AppointmentLifecycleRecord,
  LeadIndexEntry,
  NormalizedCalendarEvent,
} from "~/server/appointmentLifecycle/types";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { centralDateAt, parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import {
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const smsLog: Array<{ phone: string; body: string; type?: string }> = [];
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
const TZ = CONSULTATION_TIMEZONE;
const phone = "+15551234567";

mock.module("~/server/appointmentLifecycle/sms", () => ({
  sendLifecycleSms: async (phoneNumber: string, body: string, meta?: { messageType?: string }) => {
    smsLog.push({ phone: phoneNumber, body, type: meta?.messageType });
  },
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
        conferenceData?: { createRequest?: { requestId?: string } };
      };
      const created = {
        id: `agent-evt-${createAttempts}`,
        status: "confirmed",
        summary: "624Voice AI Consultation - Jane HVAC",
        description: body.description,
        start: { dateTime: body.start.dateTime, timeZone: TZ },
        end: { dateTime: body.end.dateTime, timeZone: TZ },
        updated: new Date().toISOString(),
        hangoutLink: `https://meet.google.com/agent-${createAttempts}-abc-defg-hij`,
        conferenceData: {
          entryPoints: [
            {
              entryPointType: "video",
              uri: `https://meet.google.com/agent-${createAttempts}-abc-defg-hij`,
            },
          ],
        },
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
const {
  getActiveLifecycleForPhone,
  getLifecycleRecord,
  saveLeadIndex,
} = await import("~/server/appointmentLifecycle/store");
const { setOptedOut } = await import("~/server/speed2Lead/session");

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

function calendarEvent(
  id: string,
  overrides: Partial<NormalizedCalendarEvent> = {},
): NormalizedCalendarEvent {
  const start = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 48.5 * 60 * 60 * 1000).toISOString();
  return {
    calendarEventId: id,
    status: "confirmed",
    appointmentStart: start,
    appointmentEnd: end,
    timezone: TZ,
    attendeePhone: phone,
    attendeeEmail: "jane@example.com",
    attendeeName: "Jane Doe",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function seedLead(entry: LeadIndexEntry = lead()): Promise<void> {
  await saveLeadIndex(entry);
}

describe("bookConsultation lifecycle integration", () => {
  let slotStart: Date;
  let availabilityNow: Date;

  beforeEach(async () => {
    slotStart = futureWeekdaySlot(10, 0);
    availabilityNow = new Date(slotStart.getTime() - 60 * 60 * 1000);
    resetSpeed2LeadIntegrationMocks();
    smsLog.length = 0;
    calendarEvents.length = 0;
    createAttempts = 0;
    await seedLead();
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

    const record = await getLifecycleRecord(result.eventId);
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

describe("processEvent production safety", () => {
  beforeEach(async () => {
    resetSpeed2LeadIntegrationMocks();
    smsLog.length = 0;
    await seedLead();
  });

  test("matching lead with consent sends SMS", async () => {
    const result = await processCalendarEvent(calendarEvent("evt-1"));
    expect(result.smsSent).toBe(true);
    expect(smsLog.length).toBe(1);
  });

  test("matching lead without consent sends no SMS", async () => {
    await seedLead(lead({ smsConsent: false }));
    const result = await processCalendarEvent(calendarEvent("evt-no-consent"));
    expect(result.smsSent).toBe(false);
    expect(smsLog.length).toBe(0);
  });

  test("opted-out lead sends no lifecycle SMS", async () => {
    await setOptedOut(phone);
    const result = await processCalendarEvent(calendarEvent("evt-optout"));
    expect(result.smsSent).toBe(false);
  });

  test("two different event IDs for same lead supersede old lifecycle", async () => {
    await processCalendarEvent(calendarEvent("evt-old"));
    smsLog.length = 0;
    const result = await processCalendarEvent(calendarEvent("evt-new"));
    expect(result.action).toBe("rescheduled");
    const old = await getLifecycleRecord("evt-old");
    expect(old?.lifecycleStatus).toBe("superseded");
    expect(old?.remindersSuppressed).toBe(true);
    const active = await getActiveLifecycleForPhone(phone);
    expect(active?.calendarEventId).toBe("evt-new");
  });

  test("duplicate calendar sync after booking does not duplicate confirmation", async () => {
    const event = calendarEvent("evt-1");
    await processCalendarEvent(event);
    smsLog.length = 0;
    const dup = await processCalendarEvent(event);
    expect(dup.action).toBe("duplicate_skipped");
    expect(smsLog.length).toBe(0);
  });
});

describe("smsEligibility", () => {
  test("leadHasSmsConsent requires explicit true", () => {
    const { leadHasSmsConsent } =
      require("~/server/appointmentLifecycle/smsEligibility") as typeof import("~/server/appointmentLifecycle/smsEligibility");
    expect(leadHasSmsConsent(lead())).toBe(true);
    expect(leadHasSmsConsent(lead({ smsConsent: false }))).toBe(false);
  });

  test("canSendLifecycleSms blocks missing consent", async () => {
    const { canSendLifecycleSms } =
      require("~/server/appointmentLifecycle/smsEligibility") as typeof import("~/server/appointmentLifecycle/smsEligibility");
    const result = await canSendLifecycleSms(phone, lead({ smsConsent: false }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("no_consent");
  });
});
