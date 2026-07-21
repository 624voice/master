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

export function getWebhookValidationUrls(request: Request): string[] {
  const urls = new Set<string>([new URL(request.url).toString()]);

  const configured = process.env.TWILIO_WEBHOOK_URL;
  if (configured) {
    urls.add(configured);
  }

  for (const url of [...urls]) {
    if (url.includes("://624voice.com")) {
      urls.add(url.replace("://624voice.com", "://www.624voice.com"));
    }
    if (url.includes("://www.624voice.com")) {
      urls.add(url.replace("://www.624voice.com", "://624voice.com"));
    }
  }

  return [...urls];
}

export function isValidTwilioWebhook(
  request: Request,
  signature: string | null,
  params: Record<string, string>,
): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return getWebhookValidationUrls(request).some((url) =>
    validateTwilioRequest(signature, url, params),
  );
}
