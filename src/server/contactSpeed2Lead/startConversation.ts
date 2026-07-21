import { buildContactResources, buildShortNeedSummary } from "~/server/contactSpeed2Lead/needSummary";
import { initialMessage } from "~/server/contactSpeed2Lead/messages";
import type { ContactConversationContext } from "~/server/contactSpeed2Lead/types";
import { getBookingUrl, isSpeed2LeadEnabled } from "~/server/speed2Lead/config";
import { isOptedOut, saveSession } from "~/server/speed2Lead/session";
import { sendConversationSms } from "~/server/speed2Lead/conversationSms";
import { normalizePhone } from "~/server/sms/phone";

export function createContactSession(input: {
  phone: string;
  firstName: string;
  businessName: string;
  message: string;
  bookingUrl: string;
}): ContactConversationContext {
  const resources = buildContactResources(input.message);

  return {
    flow: "contact",
    phone: normalizePhone(input.phone),
    firstName: input.firstName,
    businessName: input.businessName,
    shortNeedSummary: buildShortNeedSummary(input.message),
    relevantSolution: resources.relevantSolution,
    relevantLink: resources.relevantLink,
    relevantExample: resources.relevantExample,
    bookingUrl: input.bookingUrl,
    state: "awaiting_contact_goal",
    updatedAt: new Date().toISOString(),
  };
}

export async function startContactSpeed2Lead(input: {
  phone: string;
  firstName: string;
  businessName: string;
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

  await saveSession(context);
  await sendConversationSms(phone, initialMessage(context), context);
}
