import { afterEach, describe, expect, mock, test } from "bun:test";
import { forceReinstallSpeed2LeadIntegrationMocks } from "~/server/speed2Lead/testSupport/integrationMocks";

const TEST_SECRET = "a".repeat(64);
const ENV_KEY = "ASSESSMENT_SECURITY_HMAC_SECRET";

describe("assessment abuse supplemental S-ABUSE", () => {
  afterEach(() => {
    mock.restore();
    forceReinstallSpeed2LeadIntegrationMocks();
    delete process.env[ENV_KEY];
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  test("S-ABUSE-13: source rate limit blocks when Lua returns limited", async () => {
    process.env[ENV_KEY] = TEST_SECRET;
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const evalMock = mock(async () => [0, 30, "limited"]);
    mock.module("~/server/speed2Lead/redis", () => ({
      getRedis: () => ({ eval: evalMock }),
    }));

    const { checkAssessmentSourceRateLimit } = await import(
      "~/server/assessment/rateLimitSource"
    );
    const result = await checkAssessmentSourceRateLimit({
      clientIp: "203.0.113.99",
      requestId: `${Date.now()}:uuid-abuse-13`,
    });
    expect(result.allowed).toBe(false);
    expect(result.status).toBe("limited");
  });

  test("S-ABUSE-14: phone idempotency conflict rejects replay with different payload", async () => {
    process.env[ENV_KEY] = TEST_SECRET;
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const evalMock = mock(async () => ["c", "replay_conflict", 0, 1, '{"old":true}']);
    mock.module("~/server/speed2Lead/redis", () => ({
      getRedis: () => ({ eval: evalMock }),
    }));

    const { checkAssessmentPhoneIdempotency } = await import(
      "~/server/assessment/rateLimitSource"
    );
    const result = await checkAssessmentPhoneIdempotency({
      phone: "+15551234567",
      idempotencyKey: "abuse-14",
      payloadHash: "hash-new",
      cachedResponse: '{"new":true}',
    });
    expect(result.allowed).toBe(false);
    expect(result.substate).toBe("replay_conflict");
  });

  test("S-ABUSE-15: missing secret causes source check to throw (fail closed)", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    delete process.env[ENV_KEY];

    const evalMock = mock(async () => [1, 1, "allowed"]);
    mock.module("~/server/speed2Lead/redis", () => ({
      getRedis: () => ({ eval: evalMock }),
    }));

    const { checkAssessmentSourceRateLimit } = await import(
      "~/server/assessment/rateLimitSource"
    );
    await expect(
      checkAssessmentSourceRateLimit({ clientIp: "203.0.113.1" }),
    ).rejects.toThrow(/secret|configured/i);
  });
});
