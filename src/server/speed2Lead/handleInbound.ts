import { handleAppointmentLifecycleInbound } from "~/server/appointmentLifecycle/handleInbound";
import { isSpeed2LeadLlmEnabled } from "~/server/speed2Lead/config";
import { classifyGlobalIntent } from "~/server/speed2Lead/globalIntents";
import { orchestrateInboundTurn } from "~/server/speed2Lead/orchestrator";
import { isActiveV2Scheduling } from "~/server/speed2Lead/schedulingController";
import { genericRecoveryMessage } from "~/server/speed2Lead/guardrails";
import { advanceDemoConversation } from "~/server/demoSpeed2Lead/stateMachine";
import {
  declineMessage as demoDeclineMessage,
  unknownInboundMessage as demoUnknownInboundMessage,
} from "~/server/demoSpeed2Lead/messages";
import { removeDemoFollowUp } from "~/server/demoSpeed2Lead/processFollowUps";
import type { DemoConversationContext } from "~/server/demoSpeed2Lead/types";
import { advanceContactConversation } from "~/server/contactSpeed2Lead/stateMachine";
import {
  declineMessage as contactDeclineMessage,
} from "~/server/contactSpeed2Lead/messages";
import type { ContactConversationContext } from "~/server/contactSpeed2Lead/types";
import { advanceConversation } from "~/server/speed2Lead/stateMachine";
import {
  appendUserMessage,
  clearSession,
  getSession,
  isOptedOut,
  saveSession,
  setOptedOut,
} from "~/server/speed2Lead/session";
import {
  declineMessage,
  optOutConfirmationMessage,
  unknownInboundMessage,
} from "~/server/speed2Lead/messages";
import {
  logInboundConversationSms,
  sendConversationSms,
} from "~/server/speed2Lead/conversationSms";
import type { AnyConversationContext } from "~/server/speed2Lead/types";
import { normalizePhone } from "~/server/sms/phone";

function isContactSession(
  session: AnyConversationContext | null,
): session is ContactConversationContext {
  return session?.flow === "contact";
}

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
    await sendConversationSms(phone, optOutConfirmationMessage());
    return;
  }

  if (await isOptedOut(phone)) {
    return;
  }

  if (session) {
    session = appendUserMessage(session, body);
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
      isDemoSession(session)
        ? demoDeclineMessage()
        : isContactSession(session)
          ? contactDeclineMessage()
          : declineMessage(),
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

  if (isSpeed2LeadLlmEnabled()) {
    const orchestrated = await orchestrateInboundTurn(session, body);
    if (orchestrated.handled) {
      const updated = await sendConversationSms(
        phone,
        orchestrated.reply,
        orchestrated.context,
      );
      await saveSession(updated ?? orchestrated.context);
      if (isDemoSession(orchestrated.context) && orchestrated.context.meetingBooked) {
        await removeDemoFollowUp(phone);
      }
      return;
    }

    if (isActiveV2Scheduling(orchestrated.context)) {
      const recoveryReply =
        orchestrated.recoveryReply ?? genericRecoveryMessage(orchestrated.context);
      const updated = await sendConversationSms(
        phone,
        recoveryReply,
        orchestrated.context,
      );
      await saveSession(updated ?? orchestrated.context);
      return;
    }
  }

  const result = isDemoSession(session)
    ? advanceDemoConversation(session, body)
    : isContactSession(session)
      ? advanceContactConversation(session, body)
      : advanceConversation(session, body);

  const updated = await sendConversationSms(phone, result.reply, result.context);
  await saveSession(updated ?? result.context);

  if (isDemoSession(result.context) && result.context.meetingBooked) {
    await removeDemoFollowUp(phone);
  }
}

export { demoUnknownInboundMessage };
