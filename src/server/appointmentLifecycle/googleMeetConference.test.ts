import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { GoogleCalendarApiEvent } from "~/server/appointmentLifecycle/parseCalendarEvent";
import {
  GOOGLE_MEET_CONFERENCE_SOLUTION_TYPE,
  buildGoogleMeetConferenceCreateRequest,
  createGoogleMeetConferenceRequestId,
  extractGoogleMeetUrl,
  isConferenceFailureStatus,
  isConferencePendingStatus,
  readConferenceStatus,
} from "~/server/appointmentLifecycle/googleMeetConference";
import {
  buildConsultationBookingKey,
  insertCalendarEventWithDiagnostic,
  resolveCreatedEventMeetUrl,
} from "~/server/appointmentLifecycle/googleCalendar";

describe("googleMeetConference payload", () => {
  test("conference solution type is exactly hangoutsMeet", () => {
    expect(GOOGLE_MEET_CONFERENCE_SOLUTION_TYPE).toBe("hangoutsMeet");
    const request = buildGoogleMeetConferenceCreateRequest("booking-key-1");
    expect(request.conferenceSolutionKey.type).toBe("hangoutsMeet");
  });

  test("requestId is present, non-empty, and not a fixed constant", () => {
    const first = buildGoogleMeetConferenceCreateRequest("booking-a");
    const second = buildGoogleMeetConferenceCreateRequest("booking-b");
    expect(first.requestId.length).toBeGreaterThan(0);
    expect(second.requestId.length).toBeGreaterThan(0);
    expect(first.requestId).not.toBe(second.requestId);
    expect(first.requestId).not.toBe("hangoutsMeet");
  });

  test("requestId for same booking key differs across attempts", () => {
    const bookingKey = buildConsultationBookingKey("+15551234567", "2026-08-26T14:00:00.000Z");
    const first = createGoogleMeetConferenceRequestId(bookingKey);
    const second = createGoogleMeetConferenceRequestId(bookingKey);
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });
});

describe("extractGoogleMeetUrl", () => {
  test("prefers video entry point over hangoutLink", () => {
    const event: GoogleCalendarApiEvent = {
      id: "evt-1",
      hangoutLink: "https://meet.google.com/fallback-link",
      conferenceData: {
        entryPoints: [
          { entryPointType: "video", uri: "https://meet.google.com/canonical-video" },
        ],
      },
    };
    expect(extractGoogleMeetUrl(event)).toBe("https://meet.google.com/canonical-video");
  });

  test("falls back to hangoutLink when video entry point is missing", () => {
    const event: GoogleCalendarApiEvent = {
      id: "evt-2",
      hangoutLink: "https://meet.google.com/fallback-link",
    };
    expect(extractGoogleMeetUrl(event)).toBe("https://meet.google.com/fallback-link");
  });

  test("does not fabricate a Meet URL", () => {
    expect(extractGoogleMeetUrl({ id: "evt-3" })).toBeUndefined();
  });
});

describe("conference status helpers", () => {
  test("readConferenceStatus reads createRequest and conferenceStatus", () => {
    expect(
      readConferenceStatus({
        id: "evt-1",
        conferenceData: { createRequest: { status: { statusCode: "pending" } } },
      }),
    ).toBe("pending");
    expect(
      readConferenceStatus({
        id: "evt-2",
        conferenceData: { conferenceStatus: { statusCode: "failure" } },
      }),
    ).toBe("failure");
  });

  test("pending and failure status predicates", () => {
    expect(isConferencePendingStatus("pending")).toBe(true);
    expect(isConferencePendingStatus("pendingCreate")).toBe(true);
    expect(isConferenceFailureStatus("failure")).toBe(true);
    expect(isConferenceFailureStatus("success")).toBe(false);
  });
});

describe("insertCalendarEventWithDiagnostic conference wiring", () => {
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

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  test("events.insert includes conferenceDataVersion=1 and hangoutsMeet type", async () => {
    process.env.GOOGLE_CALENDAR_ID = "test-calendar";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "agent@test.iam.gserviceaccount.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = TEST_PRIVATE_KEY;

    let capturedUrl = "";
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 }), {
          status: 200,
        });
      }
      if (init?.method === "POST" && url.includes("/events")) {
        capturedUrl = url;
        capturedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            id: "evt-insert-1",
            conferenceData: {
              entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" }],
            },
          }),
          { status: 200 },
        );
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const bookingKey = buildConsultationBookingKey("+15551234567", "2026-08-26T14:00:00.000Z");
    const createRequest = buildGoogleMeetConferenceCreateRequest(bookingKey);
    const result = await insertCalendarEventWithDiagnostic({
      summary: "624Voice AI Consultation - Test",
      description: "Phone: +15551234567",
      start: { dateTime: "2026-08-26T14:00:00.000Z", timeZone: "America/Chicago" },
      end: { dateTime: "2026-08-26T14:25:00.000Z", timeZone: "America/Chicago" },
      conferenceData: { createRequest },
      extendedProperties: { private: { s2lBookingKey: bookingKey } },
    });

    expect(capturedUrl).toContain("conferenceDataVersion=1");
    expect(capturedUrl).not.toContain("sendUpdates=");
    expect(result.ok).toBe(true);
    expect(result.eventId).toBe("evt-insert-1");
    expect(result.conferenceSolutionType).toBe("hangoutsMeet");
    expect(result.googleMeetUrl).toBe("https://meet.google.com/abc-defg-hij");
    const payload = capturedBody as {
      conferenceData?: { createRequest?: { requestId?: string; conferenceSolutionKey?: { type?: string } } };
    };
    expect(payload.conferenceData?.createRequest?.conferenceSolutionKey?.type).toBe("hangoutsMeet");
    expect(payload.conferenceData?.createRequest?.requestId?.length).toBeGreaterThan(0);
  });
});

describe("resolveCreatedEventMeetUrl pending conference", () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  beforeEach(() => {
    fetchCalls = 0;
    process.env.GOOGLE_CALENDAR_ID = "test-calendar";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "agent@test.iam.gserviceaccount.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "unused-for-mock";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  test("bounded re-read resolves Meet URL after pending conference status", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 }), {
          status: 200,
        });
      }
      if (url.includes("/events/evt-pending")) {
        fetchCalls += 1;
        if (fetchCalls === 1) {
          return new Response(
            JSON.stringify({
              id: "evt-pending",
              conferenceData: { createRequest: { status: { statusCode: "pending" } } },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            id: "evt-pending",
            conferenceData: {
              entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/pending-resolved" }],
            },
          }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const result = await resolveCreatedEventMeetUrl({
      eventId: "evt-pending",
      initialEvent: {
        id: "evt-pending",
        conferenceData: { createRequest: { status: { statusCode: "pending" } } },
      },
    });

    expect(result.meetUrl).toBe("https://meet.google.com/pending-resolved");
    expect(fetchCalls).toBe(2);
  });

  test("failure conference status returns typed failure without Meet URL", async () => {
    const result = await resolveCreatedEventMeetUrl({
      eventId: "evt-failed",
      initialEvent: {
        id: "evt-failed",
        conferenceData: { conferenceStatus: { statusCode: "failure" } },
      },
    });

    expect(result.meetUrl).toBeUndefined();
    expect(result.conferenceStatus).toBe("failure");
  });
});
