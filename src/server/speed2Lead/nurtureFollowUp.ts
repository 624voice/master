import { addBusinessDays } from "~/server/demoSpeed2Lead/followUp";
import { getRedis } from "~/server/speed2Lead/redis";
import { getSession, isOptedOut, saveSession } from "~/server/speed2Lead/session";
import { sendConversationSms } from "~/server/speed2Lead/conversationSms";
import { isSpeed2LeadTestPhone } from "~/server/speed2Lead/testPhoneAllowlist";
import type { AnyConversationContext } from "~/server/speed2Lead/types";
import type { ContactConversationContext } from "~/server/contactSpeed2Lead/types";
import type { ConversationContext } from "~/server/speed2Lead/types";
import { normalizePhone } from "~/server/sms/phone";

const NURTURE_INDEX_KEY = "speed2lead:nurture-followups";
const FIRST_DELAY_MS = 45 * 60 * 1000;

export type NurtureStage = 0 | 1 | 2 | 3;

type NurtureSession = AnyConversationContext & {
  nurtureStage?: NurtureStage;
  nurtureNextAt?: string;
  nurtureStartedAt?: string;
};

function isNurtureEligible(session: AnyConversationContext | null): session is NurtureSession {
  if (!session) return false;
  if (session.flow !== "roi" && session.flow !== "contact") return false;
  if (session.disposition === "declined" || session.disposition === "soft_closed") return false;
  if (session.scheduling?.status === "confirmed") return false;
  if (session.flow === "roi" && session.state === "completed") return false;
  if (session.flow === "contact" && session.state === "completed") return false;
  return true;
}

function hasCustomerReplied(session: NurtureSession): boolean {
  return (session.messages ?? []).some((message) => message.role === "user");
}

function painLabel(session: NurtureSession): string {
  if (session.flow === "contact") {
    return session.shortNeedSummary;
  }
  return session.knownFacts?.primaryPain ?? session.primaryOpportunity ?? "missed opportunities";
}

function nurtureMessage(session: NurtureSession, stage: 1 | 2 | 3): string {
  const name = session.firstName;
  const pain = painLabel(session);
  if (stage === 1) {
    return `Hey ${name} — Chris with 624Voice. Still thinking about ${pain.toLowerCase()}? Happy to answer a quick question or find a short time to talk.`;
  }
  if (stage === 2) {
    return `${name}, wanted to follow up on your ${session.flow === "roi" ? "ROI" : "inquiry"}. If a quick call would help, I can find a time that works.`;
  }
  return `${name}, last note from me — if timing's better later, just reply whenever. Otherwise reply STOP anytime.`;
}

export function scheduleNurtureFollowUp(
  session: NurtureSession,
  startedAt = new Date().toISOString(),
): NurtureSession {
  return {
    ...session,
    nurtureStage: 0,
    nurtureStartedAt: startedAt,
    nurtureNextAt: new Date(new Date(startedAt).getTime() + FIRST_DELAY_MS).toISOString(),
  };
}

export function getNextNurtureStage(stage: NurtureStage | undefined): 1 | 2 | 3 | null {
  if (stage === 0 || stage == null) return 1;
  if (stage === 1) return 2;
  if (stage === 2) return 3;
  return null;
}

export function computeNextNurtureAt(session: NurtureSession, stage: 1 | 2 | 3): string | undefined {
  const started = new Date(session.nurtureStartedAt ?? session.updatedAt);
  if (stage === 1) {
    return new Date(started.getTime() + FIRST_DELAY_MS).toISOString();
  }
  if (stage === 2) {
    return addBusinessDays(started, 1).toISOString();
  }
  return addBusinessDays(addBusinessDays(started, 1), 3).toISOString();
}

export function shouldSendNurtureFollowUp(session: NurtureSession, now = new Date()): boolean {
  if (isSpeed2LeadTestPhone(session.phone)) return false;
  if (!session.nurtureNextAt) return false;
  if (!isNurtureEligible(session)) return false;
  if (hasCustomerReplied(session)) return false;
  return new Date(session.nurtureNextAt).getTime() <= now.getTime();
}

export async function enqueueNurtureFollowUp(phone: string): Promise<void> {
  if (isSpeed2LeadTestPhone(phone)) return;
  const redis = getRedis();
  await redis.sadd(NURTURE_INDEX_KEY, normalizePhone(phone));
}

export async function removeNurtureFollowUp(phone: string): Promise<void> {
  const redis = getRedis();
  await redis.srem(NURTURE_INDEX_KEY, normalizePhone(phone));
}

export async function processNurtureFollowUps(now = new Date()): Promise<number> {
  const redis = getRedis();
  const phones = (await redis.smembers(NURTURE_INDEX_KEY)) as string[] | null;
  let sent = 0;

  for (const phone of phones ?? []) {
    const session = await getSession(phone);
    if (!isNurtureEligible(session)) {
      await removeNurtureFollowUp(phone);
      continue;
    }
    if (await isOptedOut(phone)) {
      await removeNurtureFollowUp(phone);
      continue;
    }
    if (!shouldSendNurtureFollowUp(session, now)) {
      continue;
    }

    const nextStage = getNextNurtureStage(session.nurtureStage ?? 0);
    if (!nextStage) {
      await removeNurtureFollowUp(phone);
      continue;
    }

    const message = nurtureMessage(session, nextStage);
    const followingStage = getNextNurtureStage(nextStage);
    const updated: NurtureSession = {
      ...session,
      nurtureStage: nextStage,
      nurtureNextAt:
        followingStage == null
          ? undefined
          : computeNextNurtureAt({ ...session, nurtureStage: nextStage }, followingStage),
      updatedAt: now.toISOString(),
    };
    await sendConversationSms(phone, message, updated);
    await saveSession(updated);
    sent += 1;

    if (nextStage === 3) {
      await removeNurtureFollowUp(phone);
    }
  }

  return sent;
}

export function registerNurtureOnSession<T extends ConversationContext | ContactConversationContext>(
  session: T,
): T {
  if (isSpeed2LeadTestPhone(session.phone)) return session;
  return scheduleNurtureFollowUp(session) as T;
}
