import { classifyGlobalIntent } from "~/server/speed2Lead/globalIntents";
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
  const session = await getSession(phone);
  const intent = classifyGlobalIntent(body);

  logInboundConversationSms(phone, body, session);

  if (intent === "stop") {
    await setOptedOut(phone);
    await clearSession(phone);
    await removeDemoFollowUp(phone);
    await sendConversationSms(phone, optOutConfirmationMessage(), session);
    return;
  }

  if (await isOptedOut(phone)) {
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
    await sendConversationSms(
      phone,
      isDemoSession(session)
        ? demoDeclineMessage()
        : isContactSession(session)
          ? contactDeclineMessage()
          : declineMessage(),
      completed,
    );
    await saveSession(completed);
    if (isDemoSession(session)) {
      await removeDemoFollowUp(phone);
    }
    return;
  }

  if (isDemoSession(session)) {
    await removeDemoFollowUp(phone);
  }

  const result = isDemoSession(session)
    ? advanceDemoConversation(session, body)
    : isContactSession(session)
      ? advanceContactConversation(session, body)
      : advanceConversation(session, body);

  await sendConversationSms(phone, result.reply, result.context);
  await saveSession(result.context);

  if (isDemoSession(result.context) && result.context.meetingBooked) {
    await removeDemoFollowUp(phone);
  }
}

export { demoUnknownInboundMessage };
