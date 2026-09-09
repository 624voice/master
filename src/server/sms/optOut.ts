/**
 * Webhook-ingress opt-out / opt-in. Authoritative when Twilio sends OptOutType;
 * application fallback only when OptOutType is absent.
 *
 * "yes" is never a START keyword — it is Path B's meeting-intent trigger.
 */
import { cancelPendingPainPrompt } from "~/server/speed2Lead/agent/painPrompt";
import { cancelPendingNoResponseCampaign } from "~/server/speed2Lead/agent/noResponseCampaign";
import { cancelBookingLinkFollowUps } from "~/server/speed2Lead/agent/bookingLinkFollowUps";
import { getAgentSession, saveAgentSession } from "~/server/speed2Lead/agent/state";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import { removeDemoFollowUp } from "~/server/demoSpeed2Lead/processFollowUps";
import { removeNurtureFollowUp } from "~/server/speed2Lead/nurtureFollowUp";
import {
  clearOptedOut,
  clearSession,
  isOptedOut,
  setOptedOut,
} from "~/server/speed2Lead/session";
import { optOutConfirmationMessage } from "~/server/speed2Lead/messages";
import { sendConversationSms } from "~/server/speed2Lead/conversationSms";
import { normalizePhone } from "~/server/sms/phone";
import { sendStateKeys } from "~/server/sms/sendState";

export type TwilioOptOutType = "STOP" | "START" | "HELP";

/** Spec §3 plus the existing agent-engine STOP set. Twilio keyword sets were not API-verifiable. */
export const STANDARD_STOP_KEYWORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "revoke",
  "optout",
]);

/**
 * Fallback START keywords when OptOutType is absent.
 * NEVER includes "yes". Twilio Advanced Opt-Out keyword set was not verifiable —
 * only the standard START keyword is used until Chris confirms extras.
 */
export const STANDARD_START_KEYWORDS = new Set(["start"]);

export function parseOptOutType(raw: string | undefined): TwilioOptOutType | undefined {
  if (raw === "STOP" || raw === "START" || raw === "HELP") {
    return raw;
  }
  return undefined;
}

export async function processGlobalOptOut(phoneRaw: string): Promise<void> {
  const phone = normalizePhone(phoneRaw);
  await setOptedOut(phone);

  const agentSession = await getAgentSession(phone);
  if (agentSession) {
    let updated = await cancelPendingPainPrompt(agentSession);
    updated = await cancelPendingNoResponseCampaign(updated);
    updated = await cancelBookingLinkFollowUps(updated);
    await saveAgentSession(updated);
  }

  await clearSession(phone);
  await removeDemoFollowUp(phone);
  await removeNurtureFollowUp(phone);

  logAppointmentEvent("global_opt_out_processed", { phone });
}

export async function processGlobalOptIn(phoneRaw: string): Promise<void> {
  const phone = normalizePhone(phoneRaw);
  await clearOptedOut(phone);
  logAppointmentEvent("global_opt_in_processed", { phone });
}

export { isOptedOut };

export type ComplianceDecision =
  | { handled: true; sendLegacyConfirmation: boolean }
  | { handled: false };

/**
 * Ingress-only compliance. Twilio-classified STOP/START/HELP send no app reply.
 * Fallback STOP preserves today's confirmation split: agent session → silent
 * (carrier confirmation); legacy-only → optOutConfirmationMessage().
 */
export async function handleIngressCompliance(args: {
  optOutType?: string;
  body: string;
  phone: string;
}): Promise<ComplianceDecision> {
  const phone = normalizePhone(args.phone);
  const optOutType = parseOptOutType(args.optOutType);
  const normalizedBody = args.body.trim().toLowerCase();

  if (optOutType === "STOP") {
    await processGlobalOptOut(phone);
    return { handled: true, sendLegacyConfirmation: false };
  }
  if (optOutType === "START") {
    await processGlobalOptIn(phone);
    return { handled: true, sendLegacyConfirmation: false };
  }
  if (optOutType === "HELP") {
    logAppointmentEvent("compliance_help_received", { phone });
    return { handled: true, sendLegacyConfirmation: false };
  }

  if (STANDARD_STOP_KEYWORDS.has(normalizedBody)) {
    const hadAgentSession = Boolean(await getAgentSession(phone));
    await processGlobalOptOut(phone);
    return { handled: true, sendLegacyConfirmation: !hadAgentSession };
  }

  if (await isOptedOut(phone)) {
    if (STANDARD_START_KEYWORDS.has(normalizedBody)) {
      await processGlobalOptIn(phone);
      return { handled: true, sendLegacyConfirmation: false };
    }
    return { handled: true, sendLegacyConfirmation: false };
  }

  return { handled: false };
}

export async function sendLegacyOptOutConfirmation(phone: string, messageSid?: string): Promise<void> {
  await sendConversationSms(
    normalizePhone(phone),
    optOutConfirmationMessage(),
    null,
    messageSid ? { sendStateKey: sendStateKeys.legacyOptOut(messageSid) } : undefined,
  );
}
