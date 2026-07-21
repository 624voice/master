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
import { classifyIntent } from "~/server/speed2Lead/intents";
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

export async function handleInboundSms(from: string, body: string): Promise<void> {
  const phone = normalizePhone(from);
  const session = await getSession(phone);
  const intent = classifyIntent(body, isContactSession(session) ? undefined : session?.state);

  logInboundConversationSms(phone, body, session);

  if (intent === "stop") {
    await setOptedOut(phone);
    await clearSession(phone);
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
      isContactSession(session) ? contactDeclineMessage() : declineMessage(),
      completed,
    );
    await saveSession(completed);
    return;
  }

  const result = isContactSession(session)
    ? advanceContactConversation(session, body)
    : advanceConversation(session, body);

  await sendConversationSms(phone, result.reply, result.context);
  await saveSession(result.context);
}
