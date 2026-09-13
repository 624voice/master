import {
  ASSESSMENT_PHONE_RATE_LIMIT,
  ASSESSMENT_PHONE_WINDOW_SECONDS,
  ASSESSMENT_RATE_LIMIT_KEY_PREFIX,
  ASSESSMENT_SOURCE_RATE_LIMIT,
  ASSESSMENT_SOURCE_WINDOW_SECONDS,
} from "~/config/rateLimits";
import { FEATURE_FLAGS } from "~/config/features";
import {
  buildSourceFingerprint,
  phoneFingerprintKey,
  sourceFingerprintKey,
} from "~/server/assessment/hmacKeys.server";
import { RATE_LIMIT_PHONE_IDEMPOTENCY_LUA } from "~/server/assessment/rateLimitPhoneIdempotencyLua.server";
import { RATE_LIMIT_SOURCE_LUA } from "~/server/assessment/rateLimitSourceLua.server";
import type {
  AssessmentIdempotencyResult,
  AssessmentReplaySubstate,
} from "~/server/assessment/types";
import { isRedisConfigured } from "~/server/speed2Lead/config";
import { getRedis } from "~/server/speed2Lead/redis";

function getHmacSecret(): string {
  return (
    process.env.ASSESSMENT_RATE_LIMIT_HMAC_SECRET ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    "assessment-dev-hmac-secret"
  );
}

function sourceRateKey(fingerprint: string): string {
  return `${ASSESSMENT_RATE_LIMIT_KEY_PREFIX}source:${fingerprint}`;
}

function phoneRateKey(fingerprint: string): string {
  return `${ASSESSMENT_RATE_LIMIT_KEY_PREFIX}phone:${fingerprint}`;
}

function phoneIdempotencyKey(fingerprint: string, idempotencyKey: string): string {
  return `${ASSESSMENT_RATE_LIMIT_KEY_PREFIX}idem:${fingerprint}:${idempotencyKey}`;
}

export type SourceRateLimitResult = {
  allowed: boolean;
  count: number;
  status: "allowed" | "limited" | "skipped";
};

export async function checkAssessmentSourceRateLimit(input: {
  clientIp?: string;
  userAgent?: string;
  requestId?: string;
}): Promise<SourceRateLimitResult> {
  if (!FEATURE_FLAGS.ASSESSMENT_RATE_LIMIT_ENABLED || !isRedisConfigured()) {
    return { allowed: true, count: 0, status: "skipped" };
  }

  const secret = getHmacSecret();
  const canonical = buildSourceFingerprint(input);
  const fingerprint = sourceFingerprintKey(canonical, secret);
  const now = Date.now();
  const windowStart = now - ASSESSMENT_SOURCE_WINDOW_SECONDS * 1000;
  const member = input.requestId ?? `${now}:${Math.random().toString(36).slice(2)}`;

  const redis = getRedis();
  const result = (await redis.eval(
    RATE_LIMIT_SOURCE_LUA,
    [sourceRateKey(fingerprint)],
    [
      String(windowStart),
      String(now),
      String(ASSESSMENT_SOURCE_RATE_LIMIT),
      member,
      String(ASSESSMENT_SOURCE_WINDOW_SECONDS),
    ],
  )) as [number, number, string];

  const allowed = result[0] === 1;
  return {
    allowed,
    count: result[1] ?? 0,
    status: allowed ? "allowed" : "limited",
  };
}

export async function checkAssessmentPhoneIdempotency(input: {
  phone: string;
  idempotencyKey: string;
  payloadHash: string;
  cachedResponse: string;
  requestId?: string;
}): Promise<AssessmentIdempotencyResult> {
  if (!FEATURE_FLAGS.ASSESSMENT_RATE_LIMIT_ENABLED || !isRedisConfigured()) {
    return {
      case: "a",
      substate: "fresh",
      allowed: true,
      count: 0,
    };
  }

  const secret = getHmacSecret();
  const fingerprint = phoneFingerprintKey(input.phone, secret);
  const now = Date.now();
  const windowStart = now - ASSESSMENT_PHONE_WINDOW_SECONDS * 1000;
  const member = input.requestId ?? `${now}:${Math.random().toString(36).slice(2)}`;

  const redis = getRedis();
  const result = (await redis.eval(
    RATE_LIMIT_PHONE_IDEMPOTENCY_LUA,
    [phoneRateKey(fingerprint), phoneIdempotencyKey(fingerprint, input.idempotencyKey)],
    [
      input.idempotencyKey,
      input.payloadHash,
      String(windowStart),
      String(now),
      String(ASSESSMENT_PHONE_RATE_LIMIT),
      String(ASSESSMENT_PHONE_WINDOW_SECONDS),
      input.cachedResponse,
      member,
    ],
  )) as [string, AssessmentReplaySubstate, number, number, string | null];

  return {
    case: result[0] as AssessmentIdempotencyResult["case"],
    substate: result[1],
    allowed: result[2] === 1,
    count: result[3] ?? 0,
    cachedResponse: result[4] ?? undefined,
  };
}

export function buildAssessmentPayloadHash(payload: string): string {
  return sourceFingerprintKey(payload, getHmacSecret());
}
