import { registerLeadForLifecycle } from "~/server/appointmentLifecycle/handoff";
import { getBookingUrl, isSpeed2LeadEnabled } from "~/server/speed2Lead/config";
import {
  createInitialMemory,
  normalizeSessionMemory,
} from "~/server/speed2Lead/memory";
import { isOptedOut, saveSession } from "~/server/speed2Lead/session";
import { sendConversationSms } from "~/server/speed2Lead/conversationSms";
import { normalizePhone } from "~/server/sms/phone";
import { initialMessage } from "~/server/demoSpeed2Lead/messages";
import { registerDemoFollowUp } from "~/server/demoSpeed2Lead/processFollowUps";
import {
  scheduleFirstFollowUp,
  MIN_DEMO_DURATION_SECONDS,
} from "~/server/demoSpeed2Lead/followUp";
import type { DemoConversationContext } from "~/server/demoSpeed2Lead/types";

export function createDemoSession(input: {
  phone: string;
  firstName: string;
  lastName: string;
  businessName?: string;
  email: string;
  hasWebsite: boolean;
  smsConsent: boolean;
  demoCompletedAt: string;
  bookingUrl: string;
}): DemoConversationContext {
  const demoCompletedAt = input.demoCompletedAt;
  const base: DemoConversationContext = {
    flow: "demo",
    phone: normalizePhone(input.phone),
    firstName: input.firstName,
    lastName: input.lastName,
    businessName: input.businessName,
    email: input.email,
    hasWebsite: input.hasWebsite,
    smsConsent: input.smsConsent,
    demoCompleted: true,
    demoCompletedAt,
    bookingUrl: input.bookingUrl,
    state: "awaiting_fit",
    followUpStage: 0,
    updatedAt: new Date().toISOString(),
  };

  const withMemory = normalizeSessionMemory({
    ...base,
    ...createInitialMemory(base),
  });

  return scheduleFirstFollowUp(withMemory, demoCompletedAt);
}

export async function startDemoSpeed2Lead(input: {
  phone: string;
  firstName: string;
  lastName: string;
  businessName?: string;
  email: string;
  hasWebsite: boolean;
  smsConsent: boolean;
  demoCompletedAt: string;
  durationSeconds?: number;
}): Promise<void> {
  if (!isSpeed2LeadEnabled()) {
    return;
  }

  if (!input.smsConsent) {
    return;
  }

  if ((input.durationSeconds ?? 0) < MIN_DEMO_DURATION_SECONDS) {
    return;
  }

  const phone = normalizePhone(input.phone);

  if (await isOptedOut(phone)) {
    return;
  }

  const context = createDemoSession({
    ...input,
    phone,
    bookingUrl: getBookingUrl(),
  });

  await registerLeadForLifecycle({
    phone,
    firstName: input.firstName,
    lastName: input.lastName,
    businessName: input.businessName,
    email: input.email,
    source: "demo",
    smsConsent: true,
  });

  const opening = initialMessage(context);
  const updated = await sendConversationSms(phone, opening, context);
  await saveSession(updated ?? context);
  await registerDemoFollowUp(updated ?? context);
}

export { MIN_DEMO_DURATION_SECONDS };
