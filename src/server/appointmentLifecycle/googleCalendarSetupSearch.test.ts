import { describe, expect, test } from "bun:test";
import {
  buildGoogleCalendarConnectUrl,
  buildGoogleCalendarSetupPageUrl,
  buildGoogleCalendarSetupStatusUrl,
  hasGoogleCalendarSetupAuth,
  parseGoogleCalendarSetupSearch,
} from "~/server/appointmentLifecycle/googleCalendarSetupSearch";

describe("parseGoogleCalendarSetupSearch", () => {
  test("recognizes token from raw searchStr", () => {
    const parsed = parseGoogleCalendarSetupSearch({}, "?token=test-token&connected=1");
    expect(parsed.token).toBe("test-token");
    expect(parsed.connected).toBe(true);
    expect(hasGoogleCalendarSetupAuth(parsed)).toBe(true);
  });

  test("recognizes setup session from callback redirect", () => {
    const parsed = parseGoogleCalendarSetupSearch({}, "?setup=opaque-setup-session&connected=1");
    expect(parsed.setupSession).toBe("opaque-setup-session");
    expect(parsed.token).toBe("");
    expect(hasGoogleCalendarSetupAuth(parsed)).toBe(true);
  });

  test("missing auth stays empty", () => {
    const parsed = parseGoogleCalendarSetupSearch({}, "");
    expect(parsed.token).toBe("");
    expect(parsed.setupSession).toBe("");
    expect(hasGoogleCalendarSetupAuth(parsed)).toBe(false);
  });

  test("coerces JSON-parsed numeric token values from router search", () => {
    const parsed = parseGoogleCalendarSetupSearch({ token: 1234567890 });
    expect(parsed.token).toBe("1234567890");
  });

  test("prefers raw searchStr over router search object", () => {
    const parsed = parseGoogleCalendarSetupSearch({ token: "wrong-token" }, "?token=test-token");
    expect(parsed.token).toBe("test-token");
  });
});

describe("Google Calendar setup URLs", () => {
  test("status request preserves query token", () => {
    expect(buildGoogleCalendarSetupStatusUrl({ token: "test-token/with+special" })).toBe(
      "/api/google/oauth/status?token=test-token%2Fwith%2Bspecial",
    );
  });

  test("status request preserves setup session", () => {
    expect(buildGoogleCalendarSetupStatusUrl({ setupSession: "opaque-session" })).toBe(
      "/api/google/oauth/status?setup=opaque-session",
    );
  });

  test("connect OAuth URL preserves setup session", () => {
    expect(buildGoogleCalendarConnectUrl({ setupSession: "opaque-session" })).toBe(
      "/api/google/oauth/start?setup=opaque-session",
    );
  });

  test("callback setup page URL preserves setup session and connected flag", () => {
    expect(
      buildGoogleCalendarSetupPageUrl({
        origin: "https://deploy-preview-61--624voice.netlify.app",
        auth: { setupSession: "opaque-session" },
        connected: true,
      }),
    ).toBe(
      "https://deploy-preview-61--624voice.netlify.app/setup/google-calendar?setup=opaque-session&connected=1",
    );
  });
});
