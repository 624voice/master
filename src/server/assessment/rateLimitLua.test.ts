import { describe, expect, test } from "bun:test";
import { RATE_LIMIT_PHONE_IDEMPOTENCY_LUA } from "~/server/assessment/rateLimitPhoneIdempotencyLua.server";
import { RATE_LIMIT_SOURCE_LUA } from "~/server/assessment/rateLimitSourceLua.server";

describe("rate limit Lua supplemental", () => {
  test("S-LUA-01: source rate limit Lua script is non-empty", () => {
    expect(RATE_LIMIT_SOURCE_LUA.length).toBeGreaterThan(0);
    expect(RATE_LIMIT_SOURCE_LUA.trim()).toBe(RATE_LIMIT_SOURCE_LUA);
  });

  test("S-LUA-02: source rate limit Lua contains sliding-window commands", () => {
    expect(RATE_LIMIT_SOURCE_LUA).toContain("ZREMRANGEBYSCORE");
    expect(RATE_LIMIT_SOURCE_LUA).toContain("ZCARD");
    expect(RATE_LIMIT_SOURCE_LUA).toContain("ZADD");
    expect(RATE_LIMIT_SOURCE_LUA).toContain("EXPIRE");
  });

  test("S-LUA-03: phone idempotency Lua script is non-empty", () => {
    expect(RATE_LIMIT_PHONE_IDEMPOTENCY_LUA.length).toBeGreaterThan(0);
    expect(RATE_LIMIT_PHONE_IDEMPOTENCY_LUA.trim()).toBe(
      RATE_LIMIT_PHONE_IDEMPOTENCY_LUA,
    );
  });

  test("X-ADDITIONAL-LUA-01: phone idempotency Lua contains idempotency and rate-limit commands", () => {
    expect(RATE_LIMIT_PHONE_IDEMPOTENCY_LUA).toContain("GET");
    expect(RATE_LIMIT_PHONE_IDEMPOTENCY_LUA).toContain("ZREMRANGEBYSCORE");
    expect(RATE_LIMIT_PHONE_IDEMPOTENCY_LUA).toContain("ZADD");
    expect(RATE_LIMIT_PHONE_IDEMPOTENCY_LUA).toContain("SET");
    expect(RATE_LIMIT_PHONE_IDEMPOTENCY_LUA).toContain("cjson");
  });
});
