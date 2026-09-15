import { afterEach, describe, expect, mock, test } from "bun:test";
import { forceReinstallSpeed2LeadIntegrationMocks } from "~/server/speed2Lead/testSupport/integrationMocks";
import {
  ASSESSMENT_RATE_LIMIT_KEY_PREFIX,
  ASSESSMENT_SOURCE_RATE_LIMIT,
  ASSESSMENT_SOURCE_WINDOW_SECONDS,
} from "~/config/rateLimits";
import { RATE_LIMIT_SOURCE_LUA } from "~/server/assessment/rateLimitSourceLua.server";

const TEST_SECRET = "a".repeat(64);
const ENV_KEY = "ASSESSMENT_SECURITY_HMAC_SECRET";

function setRedisEnv(configured: boolean): void {
  if (configured) {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  } else {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
}

function mockRedisPipeline(options?: { redisConfigured?: boolean; secret?: string | null }) {
  const redisConfigured = options?.redisConfigured ?? true;
  const secret = options?.secret === undefined ? TEST_SECRET : options.secret;
  const evalMock = mock(async () => [1, 1, "allowed"]);

  if (secret === null) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = secret;
  }

  setRedisEnv(redisConfigured);

  mock.module("~/server/speed2Lead/redis", () => ({
    getRedis: () => ({ eval: evalMock }),
  }));

  return { evalMock };
}

describe("checkAssessmentSourceRateLimit supplemental", () => {
  const originalSecret = process.env[ENV_KEY];
  const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  afterEach(() => {
    mock.restore();
    forceReinstallSpeed2LeadIntegrationMocks();
    if (originalSecret === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalSecret;
    }
    if (originalRedisUrl === undefined) {
      delete process.env.UPSTASH_REDIS_REST_URL;
    } else {
      process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl;
    }
    if (originalRedisToken === undefined) {
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    } else {
      process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken;
    }
  });

  test("S-RT-01: allows request when Lua returns allowed", async () => {
    const { evalMock } = mockRedisPipeline();
    evalMock.mockResolvedValueOnce([1, 2, "allowed"]);

    const { checkAssessmentSourceRateLimit } = await import(
      "~/server/assessment/rateLimitSource"
    );

    const result = await checkAssessmentSourceRateLimit({
      clientIp: "203.0.113.1",
      userAgent: "test-agent",
      requestId: "req-allowed",
    });

    expect(result).toEqual({
      allowed: true,
      count: 2,
      status: "allowed",
    });
  });

  test("S-RT-02: blocks request when Lua returns limited", async () => {
    const { evalMock } = mockRedisPipeline();
    evalMock.mockResolvedValueOnce([0, 30, "limited"]);

    const { checkAssessmentSourceRateLimit } = await import(
      "~/server/assessment/rateLimitSource"
    );

    const result = await checkAssessmentSourceRateLimit({
      clientIp: "203.0.113.2",
      userAgent: "test-agent",
      requestId: "req-limited",
    });

    expect(result).toEqual({
      allowed: false,
      count: 30,
      status: "limited",
    });
  });

  test("S-RT-03: skips rate limit when Redis is not configured", async () => {
    mockRedisPipeline({ redisConfigured: false });

    const { checkAssessmentSourceRateLimit } = await import(
      "~/server/assessment/rateLimitSource"
    );

    const result = await checkAssessmentSourceRateLimit({
      clientIp: "203.0.113.3",
      userAgent: "test-agent",
    });

    expect(result).toEqual({
      allowed: true,
      count: 0,
      status: "skipped",
    });
  });

  test("S-RT-04: invokes source Lua with fingerprinted key and window args", async () => {
    const { evalMock } = mockRedisPipeline();

    const { checkAssessmentSourceRateLimit } = await import(
      "~/server/assessment/rateLimitSource"
    );

    await checkAssessmentSourceRateLimit({
      clientIp: "203.0.113.4",
      userAgent: "curl/8.0",
      requestId: "req-lua-args",
    });

    expect(evalMock).toHaveBeenCalledTimes(1);
    const [script, keys, args] = evalMock.mock.calls[0] as unknown as [
      string,
      string[],
      string[],
    ];
    expect(script).toBe(RATE_LIMIT_SOURCE_LUA);
    expect(keys[0]).toMatch(
      new RegExp(`^${ASSESSMENT_RATE_LIMIT_KEY_PREFIX}source:[0-9a-f]{64}$`),
    );
    expect(args[2]).toBe(String(ASSESSMENT_SOURCE_RATE_LIMIT));
    expect(args[3]).toBe("req-lua-args");
    expect(args[4]).toBe(String(ASSESSMENT_SOURCE_WINDOW_SECONDS));
  });

  test("S-RT-05: fails closed when assessment secret is absent", async () => {
    mockRedisPipeline({ secret: null });

    const { checkAssessmentSourceRateLimit } = await import(
      "~/server/assessment/rateLimitSource"
    );

    await expect(
      checkAssessmentSourceRateLimit({
        clientIp: "203.0.113.5",
        userAgent: "test-agent",
      }),
    ).rejects.toThrow("Assessment security secret is not configured");
  });

  test("S-RT-06: buildAssessmentPayloadHash returns stable hex digest", async () => {
    mockRedisPipeline();

    const { buildAssessmentPayloadHash } = await import(
      "~/server/assessment/rateLimitSource"
    );

    const hashA = buildAssessmentPayloadHash('{"phone":"+15551234567"}');
    const hashB = buildAssessmentPayloadHash('{"phone":"+15551234567"}');
    const hashC = buildAssessmentPayloadHash('{"phone":"+15559876543"}');

    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);
    expect(hashA).not.toContain("+15551234567");
  });
});

describe("checkAssessmentPhoneIdempotency supplemental", () => {
  const originalSecret = process.env[ENV_KEY];
  const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  afterEach(() => {
    mock.restore();
    forceReinstallSpeed2LeadIntegrationMocks();
    if (originalSecret === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalSecret;
    }
    if (originalRedisUrl === undefined) {
      delete process.env.UPSTASH_REDIS_REST_URL;
    } else {
      process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl;
    }
    if (originalRedisToken === undefined) {
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    } else {
      process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken;
    }
  });

  test("S-IDEM-07: case a fresh allows first submission", async () => {
    const { evalMock } = mockRedisPipeline();
    evalMock.mockResolvedValueOnce(["a", "fresh", 1, 1, '{"ok":true}']);

    const { checkAssessmentPhoneIdempotency } = await import(
      "~/server/assessment/rateLimitSource"
    );

    const result = await checkAssessmentPhoneIdempotency({
      phone: "(555) 123-4567",
      idempotencyKey: "idem-fresh",
      payloadHash: "hash-a",
      cachedResponse: '{"ok":true}',
      requestId: "req-fresh",
    });

    expect(result).toEqual({
      case: "a",
      substate: "fresh",
      allowed: true,
      count: 1,
      cachedResponse: '{"ok":true}',
    });
  });

  test("S-IDEM-08: case b replay_exact returns cached response", async () => {
    const { evalMock } = mockRedisPipeline();
    evalMock.mockResolvedValueOnce(["b", "replay_exact", 1, 2, '{"report":"cached"}']);

    const { checkAssessmentPhoneIdempotency } = await import(
      "~/server/assessment/rateLimitSource"
    );

    const result = await checkAssessmentPhoneIdempotency({
      phone: "+15551234567",
      idempotencyKey: "idem-exact",
      payloadHash: "hash-b",
      cachedResponse: '{"report":"cached"}',
    });

    expect(result).toEqual({
      case: "b",
      substate: "replay_exact",
      allowed: true,
      count: 2,
      cachedResponse: '{"report":"cached"}',
    });
  });

  test("S-IDEM-09: case c replay_conflict on payload mismatch", async () => {
    const { evalMock } = mockRedisPipeline();
    evalMock.mockResolvedValueOnce([
      "c",
      "replay_conflict",
      0,
      1,
      '{"report":"old"}',
    ]);

    const { checkAssessmentPhoneIdempotency } = await import(
      "~/server/assessment/rateLimitSource"
    );

    const result = await checkAssessmentPhoneIdempotency({
      phone: "+15551234567",
      idempotencyKey: "idem-conflict",
      payloadHash: "hash-new",
      cachedResponse: '{"report":"new"}',
    });

    expect(result).toEqual({
      case: "c",
      substate: "replay_conflict",
      allowed: false,
      count: 1,
      cachedResponse: '{"report":"old"}',
    });
  });

  test("S-IDEM-10: case c replay_conflict when phone limit exceeded", async () => {
    const { evalMock } = mockRedisPipeline();
    evalMock.mockResolvedValueOnce(["c", "replay_conflict", 0, 5, ""] as (
      | string
      | number
    )[]);

    const { checkAssessmentPhoneIdempotency } = await import(
      "~/server/assessment/rateLimitSource"
    );

    const result = await checkAssessmentPhoneIdempotency({
      phone: "+15551234567",
      idempotencyKey: "idem-limit",
      payloadHash: "hash-limit",
      cachedResponse: '{"report":"blocked"}',
    });

    expect(result).toEqual({
      case: "c",
      substate: "replay_conflict",
      allowed: false,
      count: 5,
      cachedResponse: undefined,
    });
  });

  test("S-IDEM-11: case d replay_stale allows resubmission", async () => {
    const { evalMock } = mockRedisPipeline();
    evalMock.mockResolvedValueOnce(["d", "replay_stale", 1, 3, '{"report":"stale"}']);

    const { checkAssessmentPhoneIdempotency } = await import(
      "~/server/assessment/rateLimitSource"
    );

    const result = await checkAssessmentPhoneIdempotency({
      phone: "+15551234567",
      idempotencyKey: "idem-stale",
      payloadHash: "hash-stale",
      cachedResponse: '{"report":"stale"}',
    });

    expect(result).toEqual({
      case: "d",
      substate: "replay_stale",
      allowed: true,
      count: 3,
      cachedResponse: '{"report":"stale"}',
    });
  });

  test("S-IDEM-12: skips idempotency when Redis is not configured", async () => {
    mockRedisPipeline({ redisConfigured: false });

    const { checkAssessmentPhoneIdempotency } = await import(
      "~/server/assessment/rateLimitSource"
    );

    const result = await checkAssessmentPhoneIdempotency({
      phone: "+15551234567",
      idempotencyKey: "idem-skipped",
      payloadHash: "hash-skipped",
      cachedResponse: '{"report":"skipped"}',
    });

    expect(result).toEqual({
      case: "a",
      substate: "fresh",
      allowed: true,
      count: 0,
    });
  });
});
