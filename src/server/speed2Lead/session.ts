import { SESSION_TTL_SECONDS } from "~/server/speed2Lead/config";
import {
  createInitialMemory,
  normalizeSessionMemory,
  prepareSessionForSave,
} from "~/server/speed2Lead/memory";
import { getRedis } from "~/server/speed2Lead/redis";
import type { AnyConversationContext, ConversationContext } from "~/server/speed2Lead/types";
import { normalizePhone } from "~/server/sms/phone";

function sessionKey(phone: string): string {
  return `speed2lead:session:${normalizePhone(phone)}`;
}

function optOutKey(phone: string): string {
  return `speed2lead:optout:${normalizePhone(phone)}`;
}

export async function isOptedOut(phone: string): Promise<boolean> {
  const redis = getRedis();
  const value = await redis.get<boolean>(optOutKey(phone));
  return value === true;
}

export async function setOptedOut(phone: string): Promise<void> {
  const redis = getRedis();
  await redis.set(optOutKey(phone), true);
}

export async function getSession(phone: string): Promise<AnyConversationContext | null> {
  const redis = getRedis();
  const raw = await redis.get<AnyConversationContext>(sessionKey(phone));
  if (!raw) {
    return null;
  }
  return normalizeSessionMemory(raw);
}

export async function saveSession(context: AnyConversationContext): Promise<void> {
  const redis = getRedis();
  const prepared = prepareSessionForSave(context);
  await redis.set(sessionKey(prepared.phone), prepared, {
    ex: SESSION_TTL_SECONDS,
  });
}

export async function clearSession(phone: string): Promise<void> {
  const redis = getRedis();
  await redis.del(sessionKey(phone));
}

export function createSession(input: {
  phone: string;
  firstName: string;
  businessName: string;
  email?: string;
  annualOpportunity: string;
  primaryOpportunity: string;
  reportUrl: string;
  bookingUrl: string;
}): ConversationContext {
  const base: ConversationContext = {
    flow: "roi",
    phone: normalizePhone(input.phone),
    firstName: input.firstName,
    businessName: input.businessName,
    annualOpportunity: input.annualOpportunity,
    primaryOpportunity: input.primaryOpportunity,
    reportUrl: input.reportUrl,
    bookingUrl: input.bookingUrl,
    state: "awaiting_problem",
    updatedAt: new Date().toISOString(),
  };

  const memory = createInitialMemory(base);
  if (input.email) {
    memory.knownFacts.email = input.email;
  }

  return normalizeSessionMemory({
    ...base,
    ...memory,
  });
}

export {
  appendAssistantMessage,
  appendUserMessage,
  applyConfirmedScheduling,
  applyKnownFactsUpdate,
  applyOfferedSlots,
  normalizeSessionMemory,
  prepareSessionForSave,
} from "~/server/speed2Lead/memory";
