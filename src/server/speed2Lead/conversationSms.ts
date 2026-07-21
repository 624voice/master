import type { ConversationContext } from "~/server/speed2Lead/types";
import { logSmsTranscriptSafely } from "~/server/speed2Lead/transcript";
import { sendSms } from "~/server/sms/twilio";

export async function sendConversationSms(
  to: string,
  body: string,
  context?: ConversationContext | null,
): Promise<void> {
  await sendSms(to, body);
  logSmsTranscriptSafely({
    direction: "outbound",
    phone: to,
    body,
    context,
  });
}

export function logInboundConversationSms(
  from: string,
  body: string,
  context?: ConversationContext | null,
): void {
  logSmsTranscriptSafely({
    direction: "inbound",
    phone: from,
    body,
    context,
  });
}
