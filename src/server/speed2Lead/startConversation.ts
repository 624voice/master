import type { RoiResult } from "~/lib/roi/computeRoi";
import { getBookingUrl, isSpeed2LeadEnabled } from "~/server/speed2Lead/config";
import { initialMessage } from "~/server/speed2Lead/messages";
import {
  createSession,
  isOptedOut,
  saveSession,
} from "~/server/speed2Lead/session";
import type { StartSpeed2LeadInput } from "~/server/speed2Lead/types";
import { sendConversationSms } from "~/server/speed2Lead/conversationSms";
import { normalizePhone } from "~/server/sms/phone";

export function getPrimaryOpportunity(scenarios: RoiResult[]): string {
  const moderate = scenarios[1]!;
  const drivers = Object.values(moderate.drivers);
  return drivers.reduce((largest, driver) =>
    driver.annualValue > largest.annualValue ? driver : largest,
  ).label;
}

export async function startSpeed2Lead(input: StartSpeed2LeadInput): Promise<void> {
  if (!isSpeed2LeadEnabled()) {
    return;
  }

  const phone = normalizePhone(input.phone);

  if (await isOptedOut(phone)) {
    return;
  }

  const context = createSession({
    ...input,
    phone,
    bookingUrl: getBookingUrl(),
  });

  await saveSession(context);
  await sendConversationSms(phone, initialMessage(context), context);
}
