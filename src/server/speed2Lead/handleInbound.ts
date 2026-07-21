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
import { sendSms } from "~/server/sms/twilio";
import { normalizePhone } from "~/server/sms/phone";

export async function handleInboundSms(from: string, body: string): Promise<void> {
  const phone = normalizePhone(from);
  const intent = classifyIntent(body);

  if (intent === "stop") {
    await setOptedOut(phone);
    await clearSession(phone);
    await sendSms(phone, optOutConfirmationMessage());
    return;
  }

  if (await isOptedOut(phone)) {
    return;
  }

  const session = await getSession(phone);
  if (!session) {
    await sendSms(phone, unknownInboundMessage());
    return;
  }

  if (intent === "decline") {
    await saveSession({ ...session, state: "completed", updatedAt: new Date().toISOString() });
    await sendSms(phone, declineMessage());
    return;
  }

  const { context, reply } = advanceConversation(session, body);
  await saveSession(context);
  await sendSms(phone, reply);
}
