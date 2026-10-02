import { afterEach, describe, expect, mock, test } from "bun:test";

describe("getTrustedClientIp pipeline", () => {
  afterEach(() => {
    mock.restore();
  });

  test("S-PL-01: returns platform-resolved client IP", async () => {
    mock.module("@tanstack/react-start/server", () => ({
      getRequestIP: () => "203.0.113.10",
    }));

    const { getTrustedClientIp } = await import("~/server/assessment/getTrustedClientIp");
    expect(getTrustedClientIp()).toBe("203.0.113.10");
  });

  test("S-PL-02: returns undefined when platform IP is unavailable", async () => {
    mock.module("@tanstack/react-start/server", () => ({
      getRequestIP: () => undefined,
    }));

    const { getTrustedClientIp } = await import("~/server/assessment/getTrustedClientIp");
    expect(getTrustedClientIp()).toBeUndefined();
  });

  test("S-PL-03: requests xForwardedFor trust from platform helper", async () => {
    const getRequestIP = mock(() => "198.51.100.5");
    mock.module("@tanstack/react-start/server", () => ({
      getRequestIP,
    }));

    const { getTrustedClientIp } = await import("~/server/assessment/getTrustedClientIp");
    getTrustedClientIp();
    expect(getRequestIP).toHaveBeenCalledWith({ xForwardedFor: true });
  });
});
