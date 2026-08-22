import { appendAssistantMessage } from "~/server/speed2Lead/memory";
import type { AnyConversationContext } from "~/server/speed2Lead/types";
import { logSmsTranscriptSafely } from "~/server/speed2Lead/transcript";
import { sendSms } from "~/server/sms/twilio";

export async function sendConversationSms(
  to: string,
  body: string,
  context?: AnyConversationContext | null,
): Promise<AnyConversationContext | null> {
  await sendSms(to, body);
  logSmsTranscriptSafely({
    direction: "outbound",
    phone: to,
    body,
    context,
  });

  if (!context) {
    return null;
  }

  return appendAssistantMessage(context, body);
}

export function logInboundConversationSms(
  from: string,
  body: string,
  context?: AnyConversationContext | null,
): void {
  logSmsTranscriptSafely({
    direction: "inbound",
    phone: from,
    body,
    context,
  });
}
