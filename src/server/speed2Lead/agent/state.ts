/**
 * Session state for the rebuilt Speed2Lead agent.
 *
 * Deliberately flat and small: one object, no deprecated/legacy duplicate
 * fields, no separate "scheduling state machine" object nested inside it.
 * The LLM turn engine and the scheduling wrapper are the only writers.
 */
import { getRedis } from "~/server/speed2Lead/redis";
import { isOptedOut, setOptedOut } from "~/server/speed2Lead/session";
import { normalizePhone } from "~/server/sms/phone";

export type AgentStage =
  | "discovery"
  | "bridge"
  | "offering_slots"
  | "confirming"
  | "booked"
  | "declined"
  | "handoff";

export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
  at: string;
};

/** A slot offered to the prospect in the most recent turn — the only slots a
 * `slot_choice_index` from the LLM is ever allowed to reference. */
export type OfferedSlot = {
  /** ISO start time, exactly as returned by getConsultationSlots. */
  startIso: string;
  /** Human-readable label shown to the prospect, e.g. "Thursday 2:00pm CT". */
  label: string;
};

export type AgentSession = {
  tenantId: string;
  phone: string;
  firstName?: string;
  businessName?: string;
  email?: string;
  annualOpportunity?: string;
  primaryOpportunity?: string;
  reportUrl?: string;

  stage: AgentStage;
  primaryPain?: string;
  notes: string[];

  offeredSlots: OfferedSlot[];
  bookedStartIso?: string;
  bookedEventId?: string;

  /** Twilio MessageSid of the last inbound SMS actually processed for this
   * phone, used to no-op a Twilio webhook retry/duplicate delivery of the
   * same message instead of double-processing it. */
  lastInboundMessageSid?: string;

  /** ISO time the second opener message ("which part stood out") is due to
   * send. Undefined once sent or cancelled (prospect replied early). */
  painPromptDueAt?: string;
  /** True once the second opener message has been sent OR skipped because
   * the prospect replied before the delay elapsed. */
  painPromptResolved?: boolean;

  messages: AgentMessage[];
  createdAt: string;
  updatedAt: string;
};

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const MAX_STORED_MESSAGES = 24;
const INBOUND_LOCK_SECONDS = 120;
const INBOUND_SID_TTL_SECONDS = 60 * 60 * 24;

/** Claim a Twilio MessageSid before processing (survives concurrent handlers). */
export async function claimInboundMessageSid(messageSid: string, phone: string): Promise<boolean> {
  const redis = getRedis();
  const claimed = await redis.set(`speed2lead:agent:inbound-sid:${messageSid}`, normalizePhone(phone), {
    nx: true,
    ex: INBOUND_SID_TTL_SECONDS,
  });
  return Boolean(claimed);
}

/** Serialize read-modify-write per phone so concurrent webhooks can't double-send. */
export async function acquireAgentInboundLock(phone: string): Promise<string | null> {
  const redis = getRedis();
  const token = crypto.randomUUID();
  const acquired = await redis.set(`speed2lead:agent:inbound-lock:${normalizePhone(phone)}`, token, {
    nx: true,
    ex: INBOUND_LOCK_SECONDS,
  });
  return acquired ? token : null;
}

export async function releaseAgentInboundLock(phone: string, token: string): Promise<void> {
  const redis = getRedis();
  const key = `speed2lead:agent:inbound-lock:${normalizePhone(phone)}`;
  const current = await redis.get<string>(key);
  if (current === token) {
    await redis.del(key);
  }
}

/** Redis SET of phones with a pending second-opener message, scanned by the
 * pain-prompt cron the same way speed2lead:nurture-followups is scanned. */
const PAIN_PROMPT_INDEX_KEY = "speed2lead:agent:pain-prompt-pending";

function sessionKey(phone: string): string {
  return `speed2lead:agent:session:${normalizePhone(phone)}`;
}

export async function enqueuePainPrompt(phone: string): Promise<void> {
  const redis = getRedis();
  await redis.sadd(PAIN_PROMPT_INDEX_KEY, normalizePhone(phone));
}

export async function dequeuePainPrompt(phone: string): Promise<void> {
  const redis = getRedis();
  await redis.srem(PAIN_PROMPT_INDEX_KEY, normalizePhone(phone));
}

export async function listPendingPainPromptPhones(): Promise<string[]> {
  const redis = getRedis();
  const phones = (await redis.smembers(PAIN_PROMPT_INDEX_KEY)) as string[] | null;
  return phones ?? [];
}

export async function getAgentSession(phone: string): Promise<AgentSession | null> {
  const redis = getRedis();
  const raw = await redis.get<AgentSession>(sessionKey(phone));
  return raw ?? null;
}

export async function saveAgentSession(session: AgentSession): Promise<void> {
  const redis = getRedis();
  const trimmed: AgentSession = {
    ...session,
    messages: session.messages.slice(-MAX_STORED_MESSAGES),
    updatedAt: new Date().toISOString(),
  };
  await redis.set(sessionKey(trimmed.phone), trimmed, { ex: SESSION_TTL_SECONDS });
}

export async function clearAgentSession(phone: string): Promise<void> {
  const redis = getRedis();
  await redis.del(sessionKey(phone));
  await dequeuePainPrompt(phone);
}

export function createAgentSession(input: {
  tenantId: string;
  phone: string;
  firstName?: string;
  businessName?: string;
  email?: string;
  annualOpportunity?: string;
  primaryOpportunity?: string;
  reportUrl?: string;
}): AgentSession {
  const now = new Date().toISOString();
  return {
    tenantId: input.tenantId,
    phone: normalizePhone(input.phone),
    firstName: input.firstName,
    businessName: input.businessName,
    email: input.email,
    annualOpportunity: input.annualOpportunity,
    primaryOpportunity: input.primaryOpportunity,
    reportUrl: input.reportUrl,
    stage: "discovery",
    notes: [],
    offeredSlots: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function appendMessage(
  session: AgentSession,
  role: AgentMessage["role"],
  content: string,
): AgentSession {
  return {
    ...session,
    messages: [...session.messages, { role, content, at: new Date().toISOString() }],
  };
}

// Opt-out tracking is shared infrastructure (not part of the buggy
// conversation layer) — reuse the existing Redis-backed implementation as-is
// so a prospect who already texted STOP under the old engine stays opted out.
export { isOptedOut, setOptedOut };
