import { registerLeadForLifecycle } from "~/server/appointmentLifecycle/handoff";
import { cancelAbandonedDemoRecovery } from "~/server/speed2Lead/agent/demoFlow/abandonedRecovery";
import { shouldSkipAgentOpener } from "~/server/speed2Lead/agent/contactFlow/crossFlow";
import { buildDemoOpenerPart1 } from "~/server/speed2Lead/agent/demoFlow/openers";
import type { DemoCallOutcome, DemoSummary } from "~/server/speed2Lead/agent/demoFlow/types";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { scheduleNoResponseCampaign } from "~/server/speed2Lead/agent/noResponseCampaign";
import {
  acquireAgentPhoneLock,
  appendMessage,
  createAgentSession,
  isOptedOut,
  releaseAgentPhoneLock,
  saveAgentSession,
} from "~/server/speed2Lead/agent/state";
import { isSpeed2LeadEnabled } from "~/server/speed2Lead/config";
import { sendSms } from "~/server/sms/twilio";
import { normalizePhone } from "~/server/sms/phone";

export type StartDemoAgentInput = {
  phone: string;
  firstName: string;
  lastName?: string;
  businessName: string;
  email?: string;
  vapiCallId: string;
  callDurationSeconds: number;
  callOutcome: DemoCallOutcome;
  demoSummary: DemoSummary | null;
  websiteStatus?: "has" | "none";
};

export function computeDemoCallOutcome(durationSeconds: number | undefined): DemoCallOutcome {
  return (durationSeconds ?? 0) < 45 ? "short" : "full";
}

export async function startDemoAgentConversation(input: StartDemoAgentInput): Promise<void> {
  if (!isSpeed2LeadEnabled()) {
    return;
  }

  const phone = normalizePhone(input.phone);
  if (await isOptedOut(phone)) {
    return;
  }

  const skip = await shouldSkipAgentOpener(phone, "demo");
  if (skip.skip) {
    console.warn("startDemoAgentConversation skipped opener", {
      phoneSuffix: phone.slice(-4),
      reason: skip.reason,
    });
    return;
  }

  const lockToken = await acquireAgentPhoneLock(phone);
  if (!lockToken) {
    return;
  }

  try {
    const skipAgain = await shouldSkipAgentOpener(phone, "demo");
    if (skipAgain.skip) {
      return;
    }

    await cancelAbandonedDemoRecovery(phone);

    const profile = getActiveProfile();

    await registerLeadForLifecycle({
      phone,
      firstName: input.firstName,
      lastName: input.lastName,
      businessName: input.businessName,
      email: input.email,
      source: "demo",
      smsConsent: true,
    });

    let session = createAgentSession({
      tenantId: profile.tenantId,
      phone,
      flow: "demo",
      firstName: input.firstName.trim() || undefined,
      businessName: input.businessName,
      email: input.email,
      websiteStatus: input.websiteStatus,
    });

    session = {
      ...session,
      vapiCallId: input.vapiCallId,
      callDurationSeconds: input.callDurationSeconds,
      callOutcome: input.callOutcome,
      demoSummary: input.demoSummary,
      stage: "discovery",
    };

    const opener = buildDemoOpenerPart1(session);
    await sendSms(phone, opener);
    session = appendMessage(session, "assistant", opener);

    session = await scheduleNoResponseCampaign(session, profile);
    await saveAgentSession(session);
  } finally {
    await releaseAgentPhoneLock(phone, lockToken);
  }
}
