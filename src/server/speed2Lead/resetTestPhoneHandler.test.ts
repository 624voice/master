import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  handleResetTestPhoneRequest,
  resolveResetTestPhoneSecret,
} from "~/server/speed2Lead/resetTestPhoneHandler";
import { resetSpeed2LeadTestPhonesCacheForTests } from "~/server/speed2Lead/testPhoneAllowlist";
import { getRedis } from "~/server/speed2Lead/redis";
import { normalizePhone } from "~/server/sms/phone";

const TEST_PHONE = "+15551234567";
const TEST_SECRET = "test-reset-secret-value";

describe("resetTestPhoneHandler", () => {
  beforeEach(() => {
    process.env.SPEED2LEAD_TEST_RESET_SECRET = TEST_SECRET;
    process.env.SPEED2LEAD_TEST_PHONES = TEST_PHONE;
    resetSpeed2LeadTestPhonesCacheForTests();
  });

  afterEach(() => {
    delete process.env.SPEED2LEAD_TEST_RESET_SECRET;
    delete process.env.SPEED2LEAD_TEST_PHONES;
    resetSpeed2LeadTestPhonesCacheForTests();
  });

  test("resolveResetTestPhoneSecret prefers query param over header", () => {
    expect(resolveResetTestPhoneSecret("query", "header")).toBe("query");
    expect(resolveResetTestPhoneSecret(null, "header")).toBe("header");
  });

  test("rejects missing secret", async () => {
    const result = await handleResetTestPhoneRequest({
      phone: TEST_PHONE,
      secret: "wrong",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  test("rejects phone not on allowlist", async () => {
    const result = await handleResetTestPhoneRequest({
      phone: "+15559997777",
      secret: TEST_SECRET,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("allowlist");
    }
  });

  test("successful reset clears agent session key", async () => {
    const redis = getRedis();
    const normalized = normalizePhone(TEST_PHONE);
    await redis.set(`speed2lead:agent:session:${normalized}`, JSON.stringify({ stage: "discovery" }));

    const result = await handleResetTestPhoneRequest({
      phone: TEST_PHONE,
      secret: TEST_SECRET,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.phone).toBe(normalized);
      expect(result.body.clearedSession).toBe(true);
    }

    const remaining = await redis.get(`speed2lead:agent:session:${normalized}`);
    expect(remaining).toBeNull();
  });
});
