import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  classifyCalendarCapability,
  probeGoogleCalendarCapability,
} from "~/server/appointmentLifecycle/calendarCapabilityProbe";
import { handleCalendarCapabilitySmokeRequest } from "~/server/appointmentLifecycle/calendarCapabilitySmoke";
import { resetGoogleTokenCacheForTests } from "~/server/appointmentLifecycle/googleCalendar";
import {
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

describe("classifyCalendarCapability", () => {
  test("CASE_A when hangoutsMeet is explicitly allowed", () => {
    expect(
      classifyCalendarCapability({
        conferenceProperties: { allowedConferenceSolutionTypes: ["hangoutsMeet"] },
      }),
    ).toBe("CASE_A");
  });

  test("CASE_B when conference properties exist without hangoutsMeet", () => {
    expect(
      classifyCalendarCapability({
        conferenceProperties: { allowedConferenceSolutionTypes: ["eventHangout"] },
      }),
    ).toBe("CASE_B");
  });

  test("CASE_C when conference properties are absent", () => {
    expect(classifyCalendarCapability({})).toBe("CASE_C");
  });

  test("CASE_C when allowedConferenceSolutionTypes is empty", () => {
    expect(
      classifyCalendarCapability({
        conferenceProperties: { allowedConferenceSolutionTypes: [] },
        allowedConferenceSolutionTypes: [],
      }),
    ).toBe("CASE_C");
  });
});

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

function installGoogleFetchMock(handlers: {
  calendarBody?: Record<string, unknown>;
  calendarListStatus?: number;
  calendarListBody?: Record<string, unknown> | "missing";
}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 }), {
        status: 200,
      });
    }
    if (url.includes("/calendar/v3/calendars/") && !url.includes("calendarList")) {
      return new Response(JSON.stringify(handlers.calendarBody ?? {}), { status: 200 });
    }
    if (url.includes("/calendar/v3/users/me/calendarList/")) {
      if (handlers.calendarListStatus === 404 || handlers.calendarListBody === "missing") {
        return new Response("not found", { status: 404 });
      }
      return new Response(JSON.stringify(handlers.calendarListBody ?? {}), {
        status: handlers.calendarListStatus ?? 200,
      });
    }
    return originalFetch(input);
  }) as typeof fetch;
  return originalFetch;
}

describe("probeGoogleCalendarCapability", () => {
  let originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.GOOGLE_CALENDAR_ID = "info@624voice.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "agent@test.iam.gserviceaccount.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = TEST_PRIVATE_KEY;
    resetGoogleTokenCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  test("parses calendars.get and calendarList.get with sanitized auth context", async () => {
    originalFetch = installGoogleFetchMock({
      calendarBody: {
        id: "info@624voice.com",
        summary: "624Voice Consultations",
        timeZone: "America/Chicago",
        conferenceProperties: { allowedConferenceSolutionTypes: ["hangoutsMeet"] },
      },
      calendarListBody: {
        id: "info@624voice.com",
        summary: "624Voice Consultations",
        accessRole: "writer",
        primary: false,
        dataOwner: "info@624voice.com",
        conferenceProperties: { allowedConferenceSolutionTypes: ["hangoutsMeet"] },
      },
    });

    const result = await probeGoogleCalendarCapability();

    expect(result.ok).toBe(true);
    expect(result.classification).toBe("CASE_A");
    expect(result.authContext).toEqual({
      serviceAccountEmail: "agent@test.iam.gserviceaccount.com",
      actingAs: "service_account_itself",
      impersonatingUser: false,
      calendarId: "info@624voice.com",
      oauthScope: "https://www.googleapis.com/auth/calendar",
      jwtClaimKeys: ["iss", "scope", "aud", "iat", "exp"],
      jwtHasSubClaim: false,
    });
    expect(result.calendarsGet).toMatchObject({
      httpStatus: 200,
      calendarId: "info@624voice.com",
      summary: "624Voice Consultations",
      timeZone: "America/Chicago",
      allowedConferenceSolutionTypes: ["hangoutsMeet"],
    });
    expect(result.calendarListGet).toMatchObject({
      httpStatus: 200,
      present: true,
      calendarId: "info@624voice.com",
      accessRole: "writer",
      primary: false,
      dataOwner: "info@624voice.com",
      allowedConferenceSolutionTypes: ["hangoutsMeet"],
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("test-token");
    expect(serialized).not.toContain("PRIVATE KEY");
    expect(serialized).not.toContain("access_token");
  });

  test("reports calendar list absence explicitly and classifies CASE_B", async () => {
    originalFetch = installGoogleFetchMock({
      calendarBody: {
        id: "info@624voice.com",
        summary: "624Voice Consultations",
        timeZone: "America/Chicago",
        conferenceProperties: { allowedConferenceSolutionTypes: ["eventHangout"] },
      },
      calendarListBody: "missing",
    });

    const result = await probeGoogleCalendarCapability();

    expect(result.classification).toBe("CASE_B");
    expect(result.calendarListGet.present).toBe(false);
    expect(result.calendarListGet.httpStatus).toBe(404);
    expect(result.calendarListGet.googleErrorMessage).toContain("not present");
  });
});

describe("handleCalendarCapabilitySmokeRequest", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalContext = process.env.CONTEXT;
  const originalNodeEnv = process.env.NODE_ENV;
  let originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.CONTEXT = "deploy-preview";
    process.env.NODE_ENV = "production";
    process.env.GOOGLE_CALENDAR_ID = "info@624voice.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "agent@test.iam.gserviceaccount.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = TEST_PRIVATE_KEY;
    resetGoogleTokenCacheForTests();
    originalFetch = installGoogleFetchMock({
      calendarBody: {
        id: "info@624voice.com",
        conferenceProperties: { allowedConferenceSolutionTypes: ["hangoutsMeet"] },
      },
      calendarListBody: {
        id: "info@624voice.com",
        accessRole: "writer",
        conferenceProperties: { allowedConferenceSolutionTypes: ["hangoutsMeet"] },
      },
    });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    process.env.CONTEXT = originalContext;
    process.env.NODE_ENV = originalNodeEnv;
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  function request(): Request {
    return new Request(
      "https://deploy-preview-61--624voice.netlify.app/api/cron/calendar-capability-smoke",
      { headers: { Authorization: "Bearer test-cron-secret" } },
    );
  }

  test("requires auth", async () => {
    const response = await handleCalendarCapabilitySmokeRequest(
      new Request("https://deploy-preview-61--624voice.netlify.app/api/cron/calendar-capability-smoke"),
    );
    expect(response.status).toBe(401);
  });

  test("returns sanitized capability probe on success", async () => {
    const response = await handleCalendarCapabilitySmokeRequest(request());
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.classification).toBe("CASE_A");
    expect(body.authContext).toMatchObject({
      actingAs: "service_account_itself",
      impersonatingUser: false,
      jwtHasSubClaim: false,
    });
    expect(JSON.stringify(body)).not.toContain("PRIVATE KEY");
    expect(JSON.stringify(body)).not.toContain("access_token");
  });

  test("returns 404 outside preview diagnostic context", async () => {
    process.env.CONTEXT = "production";
    const response = await handleCalendarCapabilitySmokeRequest(request());
    expect(response.status).toBe(404);
  });
});
