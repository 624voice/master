import { handleAppointmentLifecycleInbound } from "~/server/appointmentLifecycle/handleInbound";
import { advanceDemoConversation } from "~/server/demoSpeed2Lead/stateMachine";
import {
  declineMessage as demoDeclineMessage,
  unknownInboundMessage as demoUnknownInboundMessage,
} from "~/server/demoSpeed2Lead/messages";
import { removeDemoFollowUp } from "~/server/demoSpeed2Lead/processFollowUps";
import type { DemoConversationContext } from "~/server/demoSpeed2Lead/types";
import { classifyGlobalIntent } from "~/server/speed2Lead/globalIntents";
import {
  isGenericAcknowledgment,
  isPostBookingAcknowledgment,
  isSubstantiveReengagement,
  resolveDispositionAfterInbound,
} from "~/server/speed2Lead/inboundDisposition";
import {
  appendUserMessage,
  applyDisposition,
  clearSession,
  getSession,
  isOptedOut,
  saveSession,
  setOptedOut,
} from "~/server/speed2Lead/session";
import {
  declineMessage,
  optOutConfirmationMessage,
  softCloseAckMessage,
  unknownInboundMessage,
} from "~/server/speed2Lead/messages";
import {
  logInboundConversationSms,
  sendConversationSms,
} from "~/server/speed2Lead/conversationSms";
import { removeNurtureFollowUp } from "~/server/speed2Lead/nurtureFollowUp";
import type { AnyConversationContext } from "~/server/speed2Lead/types";
import { normalizePhone } from "~/server/sms/phone";

function isDemoSession(
  session: AnyConversationContext | null,
): session is DemoConversationContext {
  return session?.flow === "demo";
}

export async function handleInboundSms(from: string, body: string): Promise<void> {
  const phone = normalizePhone(from);
  let session = await getSession(phone);
  const intent = classifyGlobalIntent(body);

  logInboundConversationSms(phone, body, session);

  if (intent === "stop") {
    await setOptedOut(phone);
    await clearSession(phone);
    await removeDemoFollowUp(phone);
    await removeNurtureFollowUp(phone);
    await sendConversationSms(phone, optOutConfirmationMessage());
    return;
  }

  if (await isOptedOut(phone)) {
    return;
  }

  if (session) {
    session = appendUserMessage(session, body);
    const disposition = resolveDispositionAfterInbound(session, body);
    session = applyDisposition(session, disposition);
    await removeNurtureFollowUp(phone);
  }

  const lifecycle = await handleAppointmentLifecycleInbound(phone, body, session);
  if (lifecycle.handled) {
    if (session && !lifecycle.sessionPersisted) {
      await saveSession(session);
    }
    return;
  }

  if (!session) {
    await sendConversationSms(phone, unknownInboundMessage());
    return;
  }

  if (intent === "decline") {
    const completed = {
      ...session,
      state: "completed" as const,
      updatedAt: new Date().toISOString(),
    };
    const updated = await sendConversationSms(
      phone,
      isDemoSession(session) ? demoDeclineMessage() : declineMessage(),
      completed,
    );
    await saveSession(updated ?? completed);
    if (isDemoSession(session)) {
      await removeDemoFollowUp(phone);
    }
    return;
  }

  if (isDemoSession(session)) {
    await removeDemoFollowUp(phone);
  }

  if (
    session.disposition === "soft_closed" &&
    isGenericAcknowledgment(body) &&
    !isSubstantiveReengagement(body)
  ) {
    const ack = softCloseAckMessage();
    const updated = await sendConversationSms(phone, ack, session);
    await saveSession(updated ?? session);
    return;
  }

  if (
    (session.disposition === "booked" || session.scheduling?.status === "confirmed") &&
    isPostBookingAcknowledgment(body) &&
    !isSubstantiveReengagement(body)
  ) {
    await saveSession(session);
    return;
  }

  if (isDemoSession(session)) {
    const result = advanceDemoConversation(session, body);
    const updated = await sendConversationSms(phone, result.reply, result.context);
    await saveSession(updated ?? result.context);
    if (result.context.meetingBooked) {
      await removeDemoFollowUp(phone);
    }
    return;
  }

  // Legacy ROI/contact sessions in the old store are no longer serviced — v2 uses agent/state.ts.
  await saveSession(session);
  await sendConversationSms(phone, unknownInboundMessage(), session);
}

export { demoUnknownInboundMessage };
