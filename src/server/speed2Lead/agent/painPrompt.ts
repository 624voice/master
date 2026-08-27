/**
 * The two-part opener for the rebuilt Speed2Lead agent.
 *
 * Message 1 (sent immediately by startAgentConversation) is purely
 * informational: it tells the prospect their ROI report is ready and states
 * the headline number, with no question attached. Message 2 (sent a few
 * minutes later by processPendingPainPrompts, via a cron route) is the
 * actual pain-point question, giving the prospect time to actually open and
 * skim the report first instead of being asked about it in the same breath
 * it was mentioned.
 *
 * If the prospect replies before message 2 goes out, that reply is treated
 * as answering the (not-yet-asked) question — see handleAgentInboundSms,
 * which cancels the pending prompt on any inbound message. The LLM turn
 * engine doesn't need to know which path happened; it just reads whatever
 * is in session.messages.
 */
import { getActiveProfile, type AgentProfile } from "~/server/speed2Lead/agent/profile";
import {
  appendMessage,
  dequeuePainPrompt,
  enqueuePainPrompt,
  getAgentSession,
  isOptedOut,
  listPendingPainPromptPhones,
  saveAgentSession,
  type AgentSession,
} from "~/server/speed2Lead/agent/state";
import { sendSms } from "~/server/sms/twilio";

export function buildOpenerMessage1(
  profile: AgentProfile,
  input: { firstName?: string; businessName: string; annualOpportunity: string },
): string {
  const greeting = input.firstName ? `Hey ${input.firstName}, ` : "Hey, ";
  return (
    `${greeting}I just sent over your ROI Report for ${input.businessName}. Looks like there's about ` +
    `${input.annualOpportunity} in opportunity on the table.\n\n` +
    `${profile.senderFullName}\n${profile.signatureCompanyName}`
  );
}

export function buildPainPromptMessage(profile: AgentProfile): string {
  const labels = profile.headlinePainKeys
    .map((key) => profile.painOutcomes.find((p) => p.key === key)?.shortLabel)
    .filter((label): label is string => Boolean(label));

  const list =
    labels.length > 1
      ? `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`
      : labels[0] ?? "missed opportunities";

  return `Just curious, which part of the report stood out to you most? ${list}?\n\nLmk`;
}

/** Called right after message 1 sends, to schedule message 2. */
export async function schedulePainPrompt(
  session: AgentSession,
  profile: AgentProfile = getActiveProfile(),
): Promise<AgentSession> {
  const dueAt = new Date(Date.now() + profile.painPromptDelayMinutes * 60 * 1000).toISOString();
  await enqueuePainPrompt(session.phone);
  return { ...session, painPromptDueAt: dueAt, painPromptResolved: false };
}

/** Called from handleAgentInboundSms the moment any inbound message arrives
 * for a session whose pain prompt hasn't resolved yet — the prospect
 * engaged early, so the scheduled question is no longer needed. */
export async function cancelPendingPainPrompt(session: AgentSession): Promise<AgentSession> {
  if (session.painPromptResolved) {
    return session;
  }
  await dequeuePainPrompt(session.phone);
  return { ...session, painPromptDueAt: undefined, painPromptResolved: true };
}

/** Cron entrypoint: send message 2 for every session whose delay has
 * elapsed and who hasn't already replied or opted out. */
export async function processPendingPainPrompts(now = new Date()): Promise<number> {
  const profile = getActiveProfile();
  const phones = await listPendingPainPromptPhones();
  let sent = 0;

  for (const phone of phones) {
    const session = await getAgentSession(phone);
    if (!session || session.painPromptResolved) {
      await dequeuePainPrompt(phone);
      continue;
    }
    if (await isOptedOut(phone)) {
      await dequeuePainPrompt(phone);
      continue;
    }
    if (!session.painPromptDueAt || new Date(session.painPromptDueAt).getTime() > now.getTime()) {
      continue;
    }

    const message = buildPainPromptMessage(profile);
    await sendSms(phone, message);
    let updated = appendMessage(session, "assistant", message);
    updated = { ...updated, painPromptResolved: true, painPromptDueAt: undefined };
    await saveAgentSession(updated);
    await dequeuePainPrompt(phone);
    sent += 1;
  }

  return sent;
}
