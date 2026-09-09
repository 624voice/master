/**
 * Effectively-once outbound SMS send-state.
 *
 * This is not exactly-once delivery and does not claim perfect crash
 * classification across Redis + Twilio. Redis and Twilio cannot be
 * transacted together. The product guarantee is effectively-once
 * application behavior with explicit visibility when the provider
 * boundary makes the outcome unknowable.
 *
 * Record shape follows the existing Redis JSON + TTL pattern used by
 * booking-idempotency records in googleCalendar.ts.
 *
 * Recovery rules:
 * 1. Stale `claimed` (expired lease) → never entered provider submission → safe reclaim.
 * 2. Immediately before the provider network call: durable claimed → submitting.
 * 3. submitting → sent only after provider acceptance; store the provider SID.
 * 4. submitting → failed_retryable only for a conclusively safe-to-retry failure.
 * 5. Provider timeout / connection ambiguity → submitting → indeterminate.
 * 6. Stale submitting after a crash is always indeterminate — never auto-resent.
 * 7. Twilio does not expose a reliable reconciliation query by a durable local
 *    reference we control, so indeterminate stays indeterminate and is surfaced.
 */
import { getRedis } from "~/server/speed2Lead/redis";
import { sendSms } from "~/server/sms/twilio";
import { normalizePhone } from "~/server/sms/phone";

export const SEND_STATE_PREFIX = "speed2lead:sms-send:";
const RECORD_LOCK_PREFIX = "speed2lead:sms-send-lock:";
const CRON_LOCK_PREFIX = "speed2lead:cron-overlap:";

const LEASE_MS = 30_000;
const RECORD_TTL_SECONDS = 60 * 60 * 24 * 14;
const RECORD_LOCK_SECONDS = 8;
const OUTCOME_WRITE_ATTEMPTS = 4;

export type SendStateStatus =
  | "claimed"
  | "submitting"
  | "sent"
  | "failed_retryable"
  | "failed_terminal"
  | "indeterminate";

export type SendStateRecord = {
  key: string;
  status: SendStateStatus;
  claimedAt: string;
  leaseExpiresAt: string;
  attemptCount: number;
  attemptId: string;
  submittingAttemptId?: string;
  providerSid?: string;
  lastError?: string;
  updatedAt: string;
};

export type SendSmsWithStateResult =
  | { outcome: "sent"; sid: string }
  | { outcome: "already_sent"; sid?: string }
  | { outcome: "indeterminate"; reason: string }
  | { outcome: "skipped_in_progress" }
  | { outcome: "failed_retryable"; error: string }
  | { outcome: "failed_terminal"; error: string };

export type ProviderFailureKind = "retryable" | "terminal" | "indeterminate";

export function sendStateRedisKey(logicalKey: string): string {
  return `${SEND_STATE_PREFIX}${logicalKey}`;
}

export const sendStateKeys = {
  agentOpener: (phone: string) => `agent-opener:${normalizePhone(phone)}`,
  bookingLinkInitial: (phone: string, sessionCreatedAt: string) =>
    `booking-link:${normalizePhone(phone)}:${sessionCreatedAt}:initial`,
  bookingLinkResend: (phone: string, sessionCreatedAt: string, messageSid: string) =>
    `booking-link:${normalizePhone(phone)}:${sessionCreatedAt}:resend:${messageSid}`,
  bookingLinkFollowUp: (phone: string, sessionCreatedAt: string, stageIndex: number) =>
    `booking-link:${normalizePhone(phone)}:${sessionCreatedAt}:fu:${stageIndex}`,
  noResponse: (phone: string, sessionCreatedAt: string, stageIndex: number) =>
    `no-response:${normalizePhone(phone)}:${sessionCreatedAt}:${stageIndex}`,
  painPrompt: (phone: string, sessionCreatedAt: string) =>
    `pain-prompt:${normalizePhone(phone)}:${sessionCreatedAt}`,
  abandonedDemo: (phone: string, formSubmittedAt: string, stageIndex: number) =>
    `abandoned-demo:${normalizePhone(phone)}:${formSubmittedAt}:${stageIndex}`,
  lifecycle: (eventId: string, kind: string) => `lifecycle:${eventId}:${kind}`,
  lifecycleInbound: (eventId: string, kind: string) => `lifecycle:${eventId}:inbound-${kind}`,
  meetingBookedAck: (phone: string, sessionCreatedAt: string) =>
    `lifecycle:${normalizePhone(phone)}:meeting-booked-ack:${sessionCreatedAt}`,
  agentInboundReply: (messageSid: string) => `agent-inbound-reply:${messageSid}`,
  legacyUnknown: (messageSid: string) => `legacy-unknown:${messageSid}`,
  legacyOptOut: (messageSid: string) => `legacy-opt-out:${messageSid}`,
  nurture: (phone: string, sessionCreatedAt: string, stage: number) =>
    `nurture:${normalizePhone(phone)}:${sessionCreatedAt}:${stage}`,
  demoFollowUp: (phone: string, sessionCreatedAt: string, stage: number) =>
    `demo-fu:${normalizePhone(phone)}:${sessionCreatedAt}:${stage}`,
  legacyDemoOpener: (phone: string) => `legacy-demo-opener:${normalizePhone(phone)}`,
};

export function outboundWasAccepted(result: SendSmsWithStateResult): boolean {
  return result.outcome === "sent" || result.outcome === "already_sent";
}

export function classifyProviderSendError(error: unknown): ProviderFailureKind {
  const err = error as { code?: unknown; status?: unknown; message?: unknown; cause?: { code?: unknown } };
  const status = typeof err?.status === "number" ? err.status : undefined;
  const twilioCode = typeof err?.code === "number" ? err.code : undefined;
  const nodeCode = typeof err?.code === "string" ? err.code : typeof err?.cause?.code === "string" ? err.cause.code : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    message.includes("Twilio is not configured") ||
    message.includes("TWILIO_FROM_NUMBER is not configured")
  ) {
    return "retryable";
  }

  if (
    nodeCode === "ETIMEDOUT" ||
    nodeCode === "ECONNRESET" ||
    nodeCode === "ECONNREFUSED" ||
    nodeCode === "UND_ERR_CONNECT_TIMEOUT" ||
    nodeCode === "UND_ERR_HEADERS_TIMEOUT" ||
    nodeCode === "UND_ERR_BODY_TIMEOUT" ||
    lower.includes("timeout") ||
    lower.includes("socket hang up") ||
    lower.includes("network") ||
    lower.includes("aborted")
  ) {
    return "indeterminate";
  }

  if (status === 429 || status === 408 || twilioCode === 20429) {
    return "retryable";
  }
  if (typeof status === "number" && status >= 500) {
    return "retryable";
  }
  if (typeof status === "number" && status >= 400 && status < 500) {
    return "terminal";
  }

  return "indeterminate";
}

export async function getSendStateRecord(logicalKey: string): Promise<SendStateRecord | null> {
  const redis = getRedis();
  return redis.get<SendStateRecord>(sendStateRedisKey(logicalKey));
}

export async function saveSendStateRecord(record: SendStateRecord): Promise<void> {
  const redis = getRedis();
  await redis.set(sendStateRedisKey(record.key), record, { ex: RECORD_TTL_SECONDS });
}

function nowMs(): number {
  return Date.now();
}

function iso(ms: number = nowMs()): string {
  return new Date(ms).toISOString();
}

function leaseExpired(record: SendStateRecord, now: number): boolean {
  return new Date(record.leaseExpiresAt).getTime() <= now;
}

function surfaceIndeterminate(record: SendStateRecord, reason: string): void {
  console.error("sms_send_indeterminate", {
    key: record.key,
    attemptCount: record.attemptCount,
    attemptId: record.attemptId,
    submittingAttemptId: record.submittingAttemptId,
    reason,
    claimedAt: record.claimedAt,
    leaseExpiresAt: record.leaseExpiresAt,
  });
}

async function withRecordLock<T>(logicalKey: string, fn: () => Promise<T>): Promise<T | "lock_busy"> {
  const redis = getRedis();
  const lockKey = `${RECORD_LOCK_PREFIX}${logicalKey}`;
  const token = crypto.randomUUID();
  const acquired = await redis.set(lockKey, token, { nx: true, ex: RECORD_LOCK_SECONDS });
  if (!acquired) {
    return "lock_busy";
  }
  try {
    return await fn();
  } finally {
    const current = await redis.get<string>(lockKey);
    if (current === token) {
      await redis.del(lockKey);
    }
  }
}

async function withRecordLockRetry<T>(logicalKey: string, fn: () => Promise<T>): Promise<T | "lock_busy"> {
  for (let i = 0; i < OUTCOME_WRITE_ATTEMPTS; i += 1) {
    const result = await withRecordLock(logicalKey, fn);
    if (result !== "lock_busy") {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 25 * (i + 1)));
  }
  return "lock_busy";
}

function freshClaim(logicalKey: string, attemptCount: number): SendStateRecord {
  const claimedAtMs = nowMs();
  return {
    key: logicalKey,
    status: "claimed",
    claimedAt: iso(claimedAtMs),
    leaseExpiresAt: iso(claimedAtMs + LEASE_MS),
    attemptCount,
    attemptId: crypto.randomUUID(),
    updatedAt: iso(claimedAtMs),
  };
}

type ClaimDecision =
  | { action: "proceed"; record: SendStateRecord }
  | { action: "return"; result: SendSmsWithStateResult };

async function decideClaim(logicalKey: string): Promise<ClaimDecision> {
  const now = nowMs();
  const existing = await getSendStateRecord(logicalKey);

  if (!existing) {
    const record = freshClaim(logicalKey, 1);
    await saveSendStateRecord(record);
    return { action: "proceed", record };
  }

  if (existing.status === "sent") {
    return { action: "return", result: { outcome: "already_sent", sid: existing.providerSid } };
  }

  if (existing.status === "indeterminate") {
    surfaceIndeterminate(existing, "replay_saw_indeterminate");
    return {
      action: "return",
      result: { outcome: "indeterminate", reason: existing.lastError ?? "prior_indeterminate" },
    };
  }

  if (existing.status === "failed_terminal") {
    return {
      action: "return",
      result: { outcome: "failed_terminal", error: existing.lastError ?? "prior_terminal_failure" },
    };
  }

  if (existing.status === "submitting") {
    if (leaseExpired(existing, now)) {
      const next: SendStateRecord = {
        ...existing,
        status: "indeterminate",
        lastError: "stale_submitting_unproven_provider_acceptance",
        updatedAt: iso(now),
      };
      await saveSendStateRecord(next);
      surfaceIndeterminate(next, "stale_submitting");
      return {
        action: "return",
        result: { outcome: "indeterminate", reason: "stale_submitting_unproven_provider_acceptance" },
      };
    }
    return { action: "return", result: { outcome: "skipped_in_progress" } };
  }

  if (existing.status === "claimed") {
    if (!leaseExpired(existing, now)) {
      return { action: "return", result: { outcome: "skipped_in_progress" } };
    }
    const record = freshClaim(logicalKey, existing.attemptCount + 1);
    await saveSendStateRecord(record);
    return { action: "proceed", record };
  }

  if (existing.status === "failed_retryable") {
    const record = freshClaim(logicalKey, existing.attemptCount + 1);
    await saveSendStateRecord(record);
    return { action: "proceed", record };
  }

  return { action: "return", result: { outcome: "skipped_in_progress" } };
}

async function markSubmitting(record: SendStateRecord): Promise<SendStateRecord | SendSmsWithStateResult> {
  const locked = await withRecordLock(record.key, async () => {
    const current = (await getSendStateRecord(record.key)) ?? record;
    if (current.status === "sent") {
      return { outcome: "already_sent" as const, sid: current.providerSid };
    }
    if (current.status === "indeterminate") {
      return {
        outcome: "indeterminate" as const,
        reason: current.lastError ?? "became_indeterminate",
      };
    }
    if (current.attemptId !== record.attemptId || current.status !== "claimed") {
      return { outcome: "skipped_in_progress" as const };
    }
    const now = nowMs();
    const next: SendStateRecord = {
      ...current,
      status: "submitting",
      submittingAttemptId: current.attemptId,
      leaseExpiresAt: iso(now + LEASE_MS),
      updatedAt: iso(now),
    };
    await saveSendStateRecord(next);
    return next;
  });

  if (locked === "lock_busy") {
    return { outcome: "skipped_in_progress" };
  }
  return locked;
}

async function persistOutcome(
  attempt: SendStateRecord,
  update: (current: SendStateRecord) => SendStateRecord | SendSmsWithStateResult,
): Promise<SendSmsWithStateResult> {
  const locked = await withRecordLockRetry(attempt.key, async () => {
    const current = (await getSendStateRecord(attempt.key)) ?? attempt;
    const next = update(current);
    if ("outcome" in next) {
      return next;
    }
    await saveSendStateRecord(next);
    if (next.status === "indeterminate") {
      surfaceIndeterminate(next, next.lastError ?? "provider_outcome_unknowable");
    }
    if (next.status === "sent") {
      return { outcome: "sent" as const, sid: next.providerSid ?? "" };
    }
    if (next.status === "failed_retryable") {
      return { outcome: "failed_retryable" as const, error: next.lastError ?? "retryable" };
    }
    if (next.status === "failed_terminal") {
      return { outcome: "failed_terminal" as const, error: next.lastError ?? "terminal" };
    }
    if (next.status === "indeterminate") {
      return { outcome: "indeterminate" as const, reason: next.lastError ?? "indeterminate" };
    }
    return { outcome: "skipped_in_progress" as const };
  });

  if (locked === "lock_busy") {
    console.error("sms_send_outcome_lock_busy", { key: attempt.key, attemptId: attempt.attemptId });
    return { outcome: "indeterminate", reason: "outcome_persist_lock_busy" };
  }
  return locked;
}

function extractSid(result: unknown): string {
  if (result && typeof result === "object" && "sid" in result) {
    const sid = (result as { sid?: unknown }).sid;
    if (typeof sid === "string" && sid.trim()) {
      return sid;
    }
  }
  return "";
}

export async function sendSmsWithState(args: {
  key: string;
  to: string;
  body: string;
}): Promise<SendSmsWithStateResult> {
  const logicalKey = args.key;

  const claimed = await withRecordLock(logicalKey, () => decideClaim(logicalKey));
  if (claimed === "lock_busy") {
    return { outcome: "skipped_in_progress" };
  }
  if (claimed.action === "return") {
    return claimed.result;
  }

  const submitting = await markSubmitting(claimed.record);
  if ("outcome" in submitting) {
    return submitting;
  }

  try {
    const providerResult = await sendSms(args.to, args.body);
    const sid = extractSid(providerResult);
    return persistOutcome(submitting, (current) => {
      const ownsAttempt = current.submittingAttemptId === submitting.attemptId;
      if (current.status === "sent") {
        return { outcome: "already_sent", sid: current.providerSid };
      }
      if (current.status === "indeterminate" && !sid) {
        return { outcome: "indeterminate", reason: current.lastError ?? "already_indeterminate" };
      }
      if (!ownsAttempt && current.status !== "indeterminate") {
        return { outcome: "skipped_in_progress" };
      }
      return {
        ...current,
        status: "sent",
        providerSid: sid || current.providerSid,
        lastError: undefined,
        updatedAt: iso(),
      };
    });
  } catch (error) {
    const kind = classifyProviderSendError(error);
    const message = error instanceof Error ? error.message : String(error);

    if (kind === "retryable") {
      return persistOutcome(submitting, (current) => {
        if (current.status === "sent") {
          return { outcome: "already_sent", sid: current.providerSid };
        }
        if (current.status === "indeterminate") {
          return { outcome: "indeterminate", reason: current.lastError ?? "already_indeterminate" };
        }
        if (current.submittingAttemptId !== submitting.attemptId) {
          return { outcome: "skipped_in_progress" };
        }
        return {
          ...current,
          status: "failed_retryable",
          lastError: message,
          updatedAt: iso(),
        };
      });
    }

    if (kind === "terminal") {
      return persistOutcome(submitting, (current) => {
        if (current.status === "sent") {
          return { outcome: "already_sent", sid: current.providerSid };
        }
        if (current.status === "indeterminate") {
          return { outcome: "indeterminate", reason: current.lastError ?? "already_indeterminate" };
        }
        if (current.submittingAttemptId !== submitting.attemptId) {
          return { outcome: "skipped_in_progress" };
        }
        return {
          ...current,
          status: "failed_terminal",
          lastError: message,
          updatedAt: iso(),
        };
      });
    }

    return persistOutcome(submitting, (current) => {
      if (current.status === "sent") {
        return { outcome: "already_sent", sid: current.providerSid };
      }
      if (current.submittingAttemptId !== submitting.attemptId && current.status !== "submitting") {
        return { outcome: "indeterminate", reason: current.lastError ?? "already_indeterminate" };
      }
      return {
        ...current,
        status: "indeterminate",
        lastError: message,
        updatedAt: iso(),
      };
    });
  }
}

/**
 * Defense-in-depth / operational-efficiency only — not the correctness
 * boundary. Duplicate customer-visible SMS is prevented by the per-logical-
 * event send-state record, whether or not this lock is held.
 */
export async function tryAcquireCronOverlapLock(workerName: string, ttlSeconds = 120): Promise<string | null> {
  const redis = getRedis();
  const token = crypto.randomUUID();
  const acquired = await redis.set(`${CRON_LOCK_PREFIX}${workerName}`, token, {
    nx: true,
    ex: ttlSeconds,
  });
  return acquired ? token : null;
}

export async function releaseCronOverlapLock(workerName: string, token: string): Promise<void> {
  const redis = getRedis();
  const key = `${CRON_LOCK_PREFIX}${workerName}`;
  const current = await redis.get<string>(key);
  if (current === token) {
    await redis.del(key);
  }
}
