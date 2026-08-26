import type { RoiResult } from "~/lib/roi/computeRoi";
import { registerLeadForLifecycle } from "~/server/appointmentLifecycle/handoff";
import { isSpeed2LeadEnabled } from "~/server/speed2Lead/config";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { buildOpenerMessage1, schedulePainPrompt } from "~/server/speed2Lead/agent/painPrompt";
import {
  appendMessage,
  createAgentSession,
  isOptedOut,
  saveAgentSession,
} from "~/server/speed2Lead/agent/state";
import { sendSms } from "~/server/sms/twilio";
import { normalizePhone } from "~/server/sms/phone";

export type StartAgentInput = {
  phone: string;
  firstName: string;
  lastName?: string;
  businessName: string;
  email?: string;
  annualOpportunity: string;
  primaryOpportunity: string;
  reportUrl: string;
};

export function getPrimaryOpportunity(scenarios: RoiResult[]): string {
  const moderate = scenarios[1]!;
  const drivers = Object.values(moderate.drivers);
  return drivers.reduce((largest, driver) =>
    driver.annualValue > largest.annualValue ? driver : largest,
  ).label;
}

export async function startAgentConversation(input: StartAgentInput): Promise<void> {
  if (!isSpeed2LeadEnabled()) {
    return;
  }

  const phone = normalizePhone(input.phone);
  if (await isOptedOut(phone)) {
    return;
  }

  const firstName = input.firstName.trim() || undefined;

  await registerLeadForLifecycle({
    phone,
    firstName: input.firstName,
    lastName: input.lastName,
    businessName: input.businessName,
    email: input.email,
    source: "roi",
    smsConsent: true,
  });

  const profile = getActiveProfile();

  let session = createAgentSession({
    tenantId: profile.tenantId,
    phone,
    firstName,
    businessName: input.businessName,
    email: input.email,
    annualOpportunity: input.annualOpportunity,
    primaryOpportunity: input.primaryOpportunity,
    reportUrl: input.reportUrl,
  });

  const opener = buildOpenerMessage1(profile, {
    firstName,
    businessName: input.businessName,
    annualOpportunity: input.annualOpportunity,
  });

  await sendSms(phone, opener);
  session = appendMessage(session, "assistant", opener);
  session = await schedulePainPrompt(session, profile);
  await saveAgentSession(session);
}
