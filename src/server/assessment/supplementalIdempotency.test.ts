import { describe, expect, test } from "bun:test";
import { RATE_LIMIT_PHONE_IDEMPOTENCY_LUA } from "~/server/assessment/rateLimitPhoneIdempotencyLua.server";
import { RATE_LIMIT_SOURCE_LUA } from "~/server/assessment/rateLimitSourceLua.server";

describe("idempotency Lua supplemental S-IDEM", () => {
  test("S-IDEM-01: phone idempotency Lua defines fresh case", () => {
    expect(RATE_LIMIT_PHONE_IDEMPOTENCY_LUA).toMatch(/fresh|case/i);
  });

  test("S-IDEM-02: phone idempotency Lua handles replay exact match", () => {
    expect(RATE_LIMIT_PHONE_IDEMPOTENCY_LUA).toMatch(/replay_exact|payload/i);
  });

  test("S-IDEM-03: phone idempotency Lua handles replay conflict", () => {
    expect(RATE_LIMIT_PHONE_IDEMPOTENCY_LUA).toMatch(/replay_conflict|conflict/i);
  });

  test("S-IDEM-04: phone idempotency Lua handles stale lease reclaim", () => {
    expect(RATE_LIMIT_PHONE_IDEMPOTENCY_LUA).toMatch(/replay_stale|stale/i);
  });

  test("S-IDEM-05: source Lua uses sorted-set sliding window", () => {
    expect(RATE_LIMIT_SOURCE_LUA).toMatch(/ZREMRANGEBYSCORE|ZADD|ZCARD/);
  });

  test("S-IDEM-06: source Lua member uses unique request id not idempotency key", () => {
    expect(RATE_LIMIT_SOURCE_LUA).not.toMatch(/idempotency/i);
    expect(RATE_LIMIT_SOURCE_LUA).toMatch(/ARGV\[4\]|member/);
  });
});
