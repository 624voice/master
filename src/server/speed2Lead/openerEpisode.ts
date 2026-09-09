/**
 * Atomically establish one opener episode identity before the opener is
 * send-eligible. The send-state key then scopes to that episode — not to
 * the phone for the full TTL.
 *
 * Does not invent a per-invocation timestamp as the send key. Concurrent
 * retries of the same trigger share one `registeredAt`. A later legitimate
 * episode (terminal prior session, or a durable trigger id such as
 * `vapiCallId`) gets a new identity.
 */
import type { S2LSource } from "~/server/appointmentLifecycle/types";
import { isTerminalAgentSession } from "~/server/speed2Lead/agent/contactFlow/crossFlow";
import { getAgentSession } from "~/server/speed2Lead/agent/state";
import { getRedis } from "~/server/speed2Lead/redis";
import { normalizePhone } from "~/server/sms/phone";
import { getSendStateRecord, sendStateKeys } from "~/server/sms/sendState";

const OPENER_EPISODE_TTL_SECONDS = 60 * 60 * 24 * 14;

function nextRegisteredAt(previous: string | null): string {
  const now = new Date().toISOString();
  if (!previous) {
    return now;
  }
  const previousMs = Date.parse(previous);
  const nowMs = Date.parse(now);
  if (Number.isFinite(previousMs) && nowMs <= previousMs) {
    return new Date(previousMs + 1).toISOString();
  }
  return now;
}

export function openerEpisodeRedisKey(
  phone: string,
  source: string,
  triggerId?: string,
): string {
  const normalized = normalizePhone(phone);
  const trimmedTrigger = triggerId?.trim();
  if (trimmedTrigger) {
    return `speed2lead:opener-episode:${normalized}:${source}:${trimmedTrigger}`;
  }
  return `speed2lead:opener-episode:${normalized}:${source}`;
}

async function getOrCreateRegisteredAt(openKey: string): Promise<string> {
  const redis = getRedis();
  const existing = (await redis.get<string>(openKey)) as string | null;
  if (existing) {
    return existing;
  }

  const registeredAt = nextRegisteredAt(null);
  const claimed = await redis.set(openKey, registeredAt, {
    nx: true,
    ex: OPENER_EPISODE_TTL_SECONDS,
  });
  if (!claimed) {
    const winner = (await redis.get<string>(openKey)) as string | null;
    if (winner) {
      return winner;
    }
  }
  return registeredAt;
}

function isInFlightOrRetryable(status: string | undefined): boolean {
  return (
    status === undefined ||
    status === "claimed" ||
    status === "submitting" ||
    status === "failed_retryable"
  );
}

export async function establishOpenerEpisode(input: {
  phone: string;
  source: S2LSource;
  /** Durable upstream trigger id when the webhook supplies one (e.g. Vapi call id). */
  triggerId?: string;
}): Promise<{ registeredAt: string }> {
  const phone = normalizePhone(input.phone);
  const openKey = openerEpisodeRedisKey(phone, input.source, input.triggerId);

  if (input.triggerId?.trim()) {
    return { registeredAt: await getOrCreateRegisteredAt(openKey) };
  }

  const session = await getAgentSession(phone);
  const existing = (await getRedis().get<string>(openKey)) as string | null;

  if (session && isTerminalAgentSession(session)) {
    const registeredAt = nextRegisteredAt(existing);
    await getRedis().set(openKey, registeredAt, { ex: OPENER_EPISODE_TTL_SECONDS });
    return { registeredAt };
  }

  if (session && existing) {
    return { registeredAt: existing };
  }

  if (existing) {
    const sendKey = sendStateKeys.agentOpener(phone, input.source, existing);
    const sendState = await getSendStateRecord(sendKey);
    if (isInFlightOrRetryable(sendState?.status)) {
      return { registeredAt: existing };
    }
    // sent / indeterminate / failed_terminal with no live session: reuse so a
    // crash after send and before session persist cannot mint a second episode.
    return { registeredAt: existing };
  }

  return { registeredAt: await getOrCreateRegisteredAt(openKey) };
}

export async function establishLegacyDemoEpisode(
  phone: string,
  vapiCallId?: string,
): Promise<string> {
  const openKey = openerEpisodeRedisKey(phone, "legacy-demo", vapiCallId);
  return getOrCreateRegisteredAt(openKey);
}
