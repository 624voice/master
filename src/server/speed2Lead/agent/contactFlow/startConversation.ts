import { resolveContactWebsite } from "~/lib/lead/validateLead";
import { registerLeadForLifecycle } from "~/server/appointmentLifecycle/handoff";
import { isSpeed2LeadEnabled } from "~/server/speed2Lead/config";
import { shouldSkipAgentOpener } from "~/server/speed2Lead/agent/contactFlow/crossFlow";
import {
  classifyInquiryClarity,
  summarizeHelpText,
} from "~/server/speed2Lead/agent/contactFlow/inquiryClarity";
import { buildContactOpener } from "~/server/speed2Lead/agent/contactFlow/openers";
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
import { establishOpenerEpisode } from "~/server/speed2Lead/openerEpisode";
import { sendSmsWithState, sendStateKeys } from "~/server/sms/sendState";
import { normalizePhone } from "~/server/sms/phone";

export type StartContactAgentInput = {
  phone: string;
  firstName: string;
  lastName?: string;
  businessName: string;
  email?: string;
  message: string;
  trade: string;
  fleetSize: string;
  websiteOption: "has" | "none" | "";
  website?: string;
};

export async function startContactAgentConversation(input: StartContactAgentInput): Promise<void> {
  if (!isSpeed2LeadEnabled()) {
    return;
  }

  const phone = normalizePhone(input.phone);
  if (await isOptedOut(phone)) {
    return;
  }

  const skip = await shouldSkipAgentOpener(phone, "contact");
  if (skip.skip) {
    console.warn("startContactAgentConversation skipped opener", {
      phoneSuffix: phone.slice(-4),
      reason: skip.reason,
    });
    return;
  }

  const episode = await establishOpenerEpisode({ phone, source: "contact" });

  const lockToken = await acquireAgentPhoneLock(phone);
  if (!lockToken) {
    return;
  }

  try {
    const skipAgain = await shouldSkipAgentOpener(phone, "contact");
    if (skipAgain.skip) {
      return;
    }

    const profile = getActiveProfile();
    const helpTextSummary = summarizeHelpText(input.message);
    const inquiryClarity = classifyInquiryClarity(input.message);
    const websiteStatus =
      input.websiteOption === "has" ? "has" : input.websiteOption === "none" ? "none" : undefined;

    const lead = await registerLeadForLifecycle({
      phone,
      firstName: input.firstName,
      lastName: input.lastName,
      businessName: input.businessName,
      email: input.email,
      source: "contact",
      smsConsent: true,
      shortNeedSummary: helpTextSummary,
      registeredAt: episode.registeredAt,
    });

    let session = createAgentSession({
      tenantId: profile.tenantId,
      phone,
      flow: "contact",
      firstName: input.firstName.trim() || undefined,
      businessName: input.businessName,
      email: input.email,
      trade: input.trade,
      fleetSize: input.fleetSize,
      websiteStatus,
      helpTextSummary,
      formMessage: input.message,
      inquiryClarity,
    });

    if (input.websiteOption) {
      void resolveContactWebsite(input.websiteOption, input.website);
    }

    session.leadRegisteredAt = lead.registeredAt;

    const opener = buildContactOpener(session);
    const sendResult = await sendSmsWithState({
      key: sendStateKeys.agentOpener(phone, "contact", lead.registeredAt),
      to: phone,
      body: opener,
    });
    if (
      sendResult.outcome === "failed_retryable" ||
      sendResult.outcome === "skipped_in_progress" ||
      sendResult.outcome === "failed_terminal"
    ) {
      return;
    }
    if (sendResult.outcome === "sent") {
      session = appendMessage(session, "assistant", opener);
    }

    if (inquiryClarity === "already_clear") {
      session = {
        ...session,
        discoveryClosed: true,
        stage: "bridge",
        bridgeDeliveredAt: new Date().toISOString(),
      };
    }

    session = await scheduleNoResponseCampaign(session, profile);
    await saveAgentSession(session);
  } finally {
    await releaseAgentPhoneLock(phone, lockToken);
  }
}
