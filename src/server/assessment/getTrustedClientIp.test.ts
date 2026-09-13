import { afterEach, describe, expect, mock, test } from "bun:test";

describe("getTrustedClientIp supplemental", () => {
  afterEach(() => {
    mock.restore();
  });

  test("S-IP-01: returns platform-resolved client IP", async () => {
    mock.module("@tanstack/react-start/server", () => ({
      getRequestIP: (options: { xForwardedFor?: boolean }) => {
        expect(options).toEqual({ xForwardedFor: true });
        return "203.0.113.10";
      },
    }));

    const { getTrustedClientIp } = await import(
      "~/server/assessment/getTrustedClientIp"
    );

    expect(getTrustedClientIp()).toBe("203.0.113.10");
  });

  test("S-IP-02: returns undefined when platform IP is unavailable", async () => {
    mock.module("@tanstack/react-start/server", () => ({
      getRequestIP: () => undefined,
    }));

    const { getTrustedClientIp } = await import(
      "~/server/assessment/getTrustedClientIp"
    );

    expect(getTrustedClientIp()).toBeUndefined();
  });

  test("S-IP-03: always requests xForwardedFor trust from platform helper", async () => {
    const getRequestIP = mock(() => "198.51.100.5");
    mock.module("@tanstack/react-start/server", () => ({
      getRequestIP,
    }));

    const { getTrustedClientIp } = await import(
      "~/server/assessment/getTrustedClientIp"
    );

    expect(getTrustedClientIp()).toBe("198.51.100.5");
    expect(getRequestIP).toHaveBeenCalledWith({ xForwardedFor: true });
  });
});
