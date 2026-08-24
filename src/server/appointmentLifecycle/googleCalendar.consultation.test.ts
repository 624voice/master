import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { centralDateAt, parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import type { GoogleCalendarApiEvent } from "~/server/appointmentLifecycle/parseCalendarEvent";
import {
  capturedRedisStore,
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

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

const TZ = CONSULTATION_TIMEZONE;
const calendarEvents: GoogleCalendarApiEvent[] = [];
let createAttempts = 0;
let listCallCount = 0;
let lastCreateUrl: string | null = null;
let lastCreateBody: Record<string, unknown> | null = null;
const originalFetch = globalThis.fetch;

function apiEvent(id: string, start: Date, end: Date, phone: string): GoogleCalendarApiEvent {
  return {
    id,
    status: "confirmed",
    summary: "624Voice AI Consultation - Test Co",
    description: `Phone: ${phone}\nSource: roi`,
    start: { dateTime: start.toISOString(), timeZone: TZ },
    end: { dateTime: end.toISOString(), timeZone: TZ },
    updated: new Date().toISOString(),
  };
}

function installFetchMock() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/calendars/") && url.includes("/events") && init?.method === "POST") {
      createAttempts += 1;
      lastCreateUrl = url;
      const body = JSON.parse(String(init.body)) as {
        start: { dateTime: string };
        end: { dateTime: string };
        description?: string;
        attendees?: Array<{ email: string }>;
        conferenceData?: { createRequest?: { requestId?: string } };
      };
      lastCreateBody = body;
      const phoneMatch = body.description?.match(/Phone:\s(\S+)/);
      const phone = phoneMatch?.[1] ?? "+15551234567";
      const created = apiEvent(
        `evt-created-${createAttempts}`,
        new Date(body.start.dateTime),
        new Date(body.end.dateTime),
        phone,
      );
      if (body.conferenceData?.createRequest) {
        created.hangoutLink = `https://meet.google.com/test-${createAttempts}-abc-defg-hij`;
        created.conferenceData = {
          entryPoints: [{ entryPointType: "video", uri: created.hangoutLink }],
        };
      }
      calendarEvents.push(created);
      return new Response(JSON.stringify(created), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/calendars/") && url.includes("/events/") && !init?.method) {
      const eventId = decodeURIComponent(url.split("/events/")[1] ?? "");
      const found = calendarEvents.find((event) => event.id === eventId);
      if (!found) {
        return new Response("not found", { status: 404 });
      }
      return new Response(JSON.stringify(found), { status: 200 });
    }

    if (url.includes("/calendars/") && url.includes("/events?")) {
      listCallCount += 1;
      return new Response(JSON.stringify({ items: calendarEvents }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return originalFetch(input, init);
  }) as typeof fetch;
}

const googleCalendar = await import("~/server/appointmentLifecycle/googleCalendar");
const {
  createConsultationEvent,
  getConsultationSlots,
  resetGoogleTokenCacheForTests,
  buildConsultationBookingKey,
  isStartAvailableAgainstBusy,
  supportsAttendeeInvites,
} = googleCalendar;

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

describe("googleCalendar consultation booking", () => {
  let slotStart: Date;
  let slotEnd: Date;
  let availabilityNow: Date;
  const phone = "+15551234567";

  beforeEach(() => {
    slotStart = futureWeekdaySlot(10, 0);
    slotEnd = new Date(slotStart.getTime() + 25 * 60_000);
    availabilityNow = new Date(slotStart.getTime() - 60 * 60 * 1000);
    resetSpeed2LeadIntegrationMocks();
    calendarEvents.length = 0;
    createAttempts = 0;
    listCallCount = 0;
    lastCreateUrl = null;
    lastCreateBody = null;
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

  test("getConsultationSlots returns ordered ISO starts from calendar conflicts", async () => {
    calendarEvents.push(
      apiEvent(
        "busy-1",
        centralDateAt(2026, 8, 19, 11, 0, TZ),
        centralDateAt(2026, 8, 19, 11, 30, TZ),
        phone,
      ),
    );

    const result = await getConsultationSlots({
      rangeStart: centralDateAt(2026, 8, 19, 9, 0, TZ),
      rangeEnd: centralDateAt(2026, 8, 19, 12, 0, TZ),
      now: centralDateAt(2026, 8, 19, 8, 0, TZ),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.slots[0]).toBe(centralDateAt(2026, 8, 19, 9, 0, TZ).toISOString());
    expect(result.slots).not.toContain(centralDateAt(2026, 8, 19, 11, 0, TZ).toISOString());
    expect(result.slots.every((slot, index, all) => index === 0 || slot > all[index - 1]!)).toBe(
      true,
    );
  });

  test("slot is re-checked immediately before booking", async () => {
    const listsBeforeCreate = listCallCount;
    const result = await createConsultationEvent({
      start: slotStart.toISOString(),
      attendeeName: "Jane Doe",
      attendeeEmail: "jane@example.com",
      phone,
      businessName: "Jane HVAC",
      source: "roi",
      now: availabilityNow,
    });

    expect(result.ok).toBe(true);
    expect(listCallCount).toBeGreaterThan(listsBeforeCreate);
  });

  test("a newly occupied slot fails safely instead of double-booking", async () => {
    calendarEvents.push(apiEvent("existing-busy", slotStart, slotEnd, phone));

    const result = await createConsultationEvent({
      start: slotStart.toISOString(),
      attendeeName: "Jane Doe",
      phone,
      source: "roi",
      now: availabilityNow,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("slot_unavailable");
    expect(createAttempts).toBe(0);
  });

  test("duplicate booking attempts are idempotent", async () => {
    const input = {
      start: slotStart.toISOString(),
      attendeeName: "Jane Doe",
      phone,
      businessName: "Jane HVAC",
      source: "roi" as const,
      now: availabilityNow,
    };

    const first = await createConsultationEvent(input);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await createConsultationEvent(input);
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.replayed).toBe(true);
    expect(second.eventId).toBe(first.eventId);
    expect(createAttempts).toBe(1);
    expect(buildConsultationBookingKey(phone, slotStart.toISOString())).toContain("+15551234567");
  });

  test("successful creation returns the Google Calendar event ID", async () => {
    const result = await createConsultationEvent({
      start: slotStart.toISOString(),
      attendeeName: "Jane Doe",
      phone,
      source: "contact",
      now: availabilityNow,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.eventId).toBe("evt-created-1");
    expect(result.normalizedEvent.calendarEventId).toBe("evt-created-1");
  });

  test("external lead email does not add Google attendees on service-account path", async () => {
    const result = await createConsultationEvent({
      start: slotStart.toISOString(),
      attendeeName: "Jane Doe",
      attendeeEmail: "jane@example.com",
      phone,
      source: "roi",
      now: availabilityNow,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(lastCreateUrl).not.toContain("sendUpdates=");
    expect(lastCreateBody?.attendees).toBeUndefined();
    expect(String(lastCreateBody?.description)).toContain("Email: jane@example.com");
    expect(lastCreateUrl).toContain("conferenceDataVersion=1");
    expect(result.googleMeetUrl).toMatch(/^https:\/\/meet\.google\.com\//);
    expect(result.normalizedEvent.meetingLink).toBe(result.googleMeetUrl);
  });

  test("supportsAttendeeInvites is false for service-account provider", () => {
    expect(googleCalendar.supportsAttendeeInvites()).toBe(false);
  });

  test("missing attendee email still books with Google Meet and without sendUpdates", async () => {
    const result = await createConsultationEvent({
      start: slotStart.toISOString(),
      attendeeName: "Jane Doe",
      phone,
      source: "roi",
      now: availabilityNow,
    });

    expect(result.ok).toBe(true);
    expect(lastCreateUrl).not.toContain("sendUpdates=");
    expect(lastCreateBody?.attendees).toBeUndefined();
    expect(result.googleMeetUrl).toMatch(/^https:\/\/meet\.google\.com\//);
  });

  test("failed calendar creation never reports success", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 }), {
          status: 200,
        });
      }
      if (init?.method === "POST" && url.includes("/events")) {
        return new Response("error", { status: 500 });
      }
      if (url.includes("/events?")) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const result = await createConsultationEvent({
      start: slotStart.toISOString(),
      attendeeName: "Jane Doe",
      phone,
      source: "demo",
      now: availabilityNow,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("calendar_api_error");
  });

  test("isStartAvailableAgainstBusy respects duration and buffer", () => {
    const busy = [
      {
        startMs: centralDateAt(2026, 8, 19, 11, 0, TZ).getTime(),
        endMs: centralDateAt(2026, 8, 19, 11, 30, TZ).getTime(),
      },
    ];

    expect(
      isStartAvailableAgainstBusy(
        centralDateAt(2026, 8, 19, 10, 30, TZ).toISOString(),
        busy,
      ),
    ).toBe(false);
    expect(
      isStartAvailableAgainstBusy(
        centralDateAt(2026, 8, 19, 11, 45, TZ).toISOString(),
        busy,
      ),
    ).toBe(true);
  });
});
