import {
  followUp1Message,
  followUp2Message,
  followUp3Message,
} from "~/server/demoSpeed2Lead/messages";
import {
  computeNextFollowUpAt,
  getNextFollowUpStage,
  shouldSendFollowUp,
} from "~/server/demoSpeed2Lead/followUp";
import type { DemoConversationContext } from "~/server/demoSpeed2Lead/types";
import { getRedis } from "~/server/speed2Lead/redis";
import { getSession, isOptedOut, saveSession } from "~/server/speed2Lead/session";
import { sendConversationSms } from "~/server/speed2Lead/conversationSms";
import type { AnyConversationContext } from "~/server/speed2Lead/types";
import { normalizePhone } from "~/server/sms/phone";

const FOLLOW_UP_INDEX_KEY = "speed2lead:demo-followups";

function isDemoSession(
  session: AnyConversationContext | null,
): session is DemoConversationContext {
  return session?.flow === "demo";
}

function followUpMessage(context: DemoConversationContext, stage: 1 | 2 | 3): string {
  if (stage === 1) return followUp1Message(context);
  if (stage === 2) return followUp2Message(context);
  return followUp3Message(context);
}

export async function enqueueDemoFollowUp(phone: string): Promise<void> {
  const redis = getRedis();
  await redis.sadd(FOLLOW_UP_INDEX_KEY, normalizePhone(phone));
}

export async function removeDemoFollowUp(phone: string): Promise<void> {
  const redis = getRedis();
  await redis.srem(FOLLOW_UP_INDEX_KEY, normalizePhone(phone));
}

export async function processDemoFollowUps(now = new Date()): Promise<number> {
  const redis = getRedis();
  const phones = (await redis.smembers(FOLLOW_UP_INDEX_KEY)) as string[] | null;
  let sent = 0;

  for (const phone of phones ?? []) {
    const session = await getSession(phone);

    if (!isDemoSession(session)) {
      await removeDemoFollowUp(phone);
      continue;
    }

    if (await isOptedOut(phone)) {
      await removeDemoFollowUp(phone);
      continue;
    }

    if (!shouldSendFollowUp(session, now)) {
      continue;
    }

    const nextStage = getNextFollowUpStage(session.followUpStage ?? 0);
    if (!nextStage) {
      await removeDemoFollowUp(phone);
      continue;
    }

    const message = followUpMessage(session, nextStage);
    const nextFollowUpAt =
      nextStage === 3 ? undefined : computeNextFollowUpAt(session, nextStage);

    const updated: DemoConversationContext = {
      ...session,
      followUpStage: nextStage,
      nextFollowUpAt,
      bookingLinkSent: session.bookingLinkSent || message.includes(session.bookingUrl),
      lastAgentMessage: message,
      updatedAt: now.toISOString(),
    };

    await sendConversationSms(phone, message, updated);
    await saveSession(updated);

    if (nextStage === 3) {
      await removeDemoFollowUp(phone);
    }

    sent += 1;
  }

  return sent;
}

export async function registerDemoFollowUp(context: DemoConversationContext): Promise<void> {
  if (context.nextFollowUpAt) {
    await enqueueDemoFollowUp(context.phone);
  }
}
