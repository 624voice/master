import twilio from "twilio";
import { normalizePhone } from "~/server/sms/phone";

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio is not configured");
  }

  return twilio(accountSid, authToken);
}

function getFromNumber(): string {
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) {
    throw new Error("TWILIO_FROM_NUMBER is not configured");
  }

  return normalizePhone(from);
}

export async function sendSms(to: string, body: string): Promise<void> {
  const client = getTwilioClient();
  await client.messages.create({
    to: normalizePhone(to),
    from: getFromNumber(),
    body,
  });
}

export function validateTwilioRequest(
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken || !signature) {
    return false;
  }

  return twilio.validateRequest(authToken, signature, url, params);
}
