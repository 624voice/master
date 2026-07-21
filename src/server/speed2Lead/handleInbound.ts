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
import { normalizePhone } from "~/server/sms/phone";

export async function handleInboundSms(from: string, body: string): Promise<void> {
  const phone = normalizePhone(from);
  const intent = classifyIntent(body);
  const session = await getSession(phone);

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
    await saveSession({ ...session, state: "completed", updatedAt: new Date().toISOString() });
    await sendConversationSms(phone, declineMessage(), {
      ...session,
      state: "completed",
    });
    return;
  }

  const { context, reply } = advanceConversation(session, body);
  await saveSession(context);
  await sendConversationSms(phone, reply, context);
}
