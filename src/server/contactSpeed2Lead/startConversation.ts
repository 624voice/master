import { registerLeadForLifecycle } from "~/server/appointmentLifecycle/handoff";
import { buildContactResources, buildShortNeedSummary } from "~/server/contactSpeed2Lead/needSummary";
import { initialMessage } from "~/server/contactSpeed2Lead/messages";
import type { ContactConversationContext } from "~/server/contactSpeed2Lead/types";
import { getBookingUrl, isSpeed2LeadEnabled } from "~/server/speed2Lead/config";
import {
  createInitialMemory,
  normalizeSessionMemory,
} from "~/server/speed2Lead/memory";
import { isOptedOut, saveSession } from "~/server/speed2Lead/session";
import { sendConversationSms } from "~/server/speed2Lead/conversationSms";
import { normalizePhone } from "~/server/sms/phone";

export function createContactSession(input: {
  phone: string;
  firstName: string;
  businessName: string;
  message: string;
  bookingUrl: string;
  email?: string;
}): ContactConversationContext {
  const resources = buildContactResources(input.message);

  const base: ContactConversationContext = {
    flow: "contact",
    phone: normalizePhone(input.phone),
    firstName: input.firstName,
    businessName: input.businessName,
    shortNeedSummary: buildShortNeedSummary(input.message),
    relevantSolution: resources.relevantSolution,
    relevantLink: resources.relevantLink,
    relevantExample: resources.relevantExample,
    bookingUrl: input.bookingUrl,
    state: "awaiting_prompt",
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

export async function startContactSpeed2Lead(input: {
  phone: string;
  firstName: string;
  lastName?: string;
  businessName: string;
  email?: string;
  message: string;
}): Promise<void> {
  if (!isSpeed2LeadEnabled()) {
    return;
  }

  const phone = normalizePhone(input.phone);

  if (await isOptedOut(phone)) {
    return;
  }

  const context = createContactSession({
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
    source: "contact",
    smsConsent: true,
    shortNeedSummary: context.shortNeedSummary,
  });

  const opening = initialMessage(context);
  const updated = await sendConversationSms(phone, opening, context);
  await saveSession(updated ?? context);
}
