import { describe, expect, test } from "bun:test";
import {
  buildGoogleCalendarConnectUrl,
  buildGoogleCalendarSetupStatusUrl,
  hasGoogleCalendarSetupToken,
  parseGoogleCalendarSetupSearch,
} from "~/server/appointmentLifecycle/googleCalendarSetupSearch";

describe("parseGoogleCalendarSetupSearch", () => {
  test("recognizes token from raw searchStr", () => {
    const parsed = parseGoogleCalendarSetupSearch({}, "?token=test-token&connected=1");
    expect(parsed.token).toBe("test-token");
    expect(parsed.connected).toBe(true);
    expect(hasGoogleCalendarSetupToken(parsed)).toBe(true);
  });

  test("missing token stays empty", () => {
    const parsed = parseGoogleCalendarSetupSearch({}, "");
    expect(parsed.token).toBe("");
    expect(hasGoogleCalendarSetupToken(parsed)).toBe(false);
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
    expect(buildGoogleCalendarSetupStatusUrl("test-token/with+special")).toBe(
      "/api/google/oauth/status?token=test-token%2Fwith%2Bspecial",
    );
  });

  test("connect OAuth URL preserves query token", () => {
    expect(buildGoogleCalendarConnectUrl("test-token/with+special")).toBe(
      "/api/google/oauth/start?token=test-token%2Fwith%2Bspecial",
    );
  });
});
