import type { AnyConversationContext } from "~/server/speed2Lead/types";

export type SmsTranscriptDirection = "inbound" | "outbound";

export type SmsTranscriptPayload = {
  type: "sms_transcript";
  direction: SmsTranscriptDirection;
  phone: string;
  body: string;
  firstName?: string;
  businessName?: string;
  conversationState?: string;
  flow?: "roi" | "contact";
  shortNeedSummary?: string;
  capturedAt: string;
};

function formatCentralTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} ${get("dayPeriod")} CT`;
}

function transcriptContext(context?: AnyConversationContext | null) {
  if (!context) {
    return {};
  }

  const base = {
    firstName: context.firstName,
    businessName: context.businessName,
    conversationState: context.state,
    flow: context.flow === "contact" ? ("contact" as const) : ("roi" as const),
  };

  if (context.flow === "contact") {
    return {
      ...base,
      shortNeedSummary: context.shortNeedSummary,
    };
  }

  return base;
}

export async function logSmsTranscript(input: {
  direction: SmsTranscriptDirection;
  phone: string;
  body: string;
  context?: AnyConversationContext | null;
}): Promise<void> {
  const url = process.env.LEADS_WEBHOOK_URL;
  if (!url) {
    return;
  }

  const payload: SmsTranscriptPayload = {
    type: "sms_transcript",
    direction: input.direction,
    phone: input.phone,
    body: input.body,
    capturedAt: formatCentralTimestamp(),
    ...transcriptContext(input.context),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`SMS transcript webhook failed with status ${response.status}`);
  }
}

export function logSmsTranscriptSafely(input: {
  direction: SmsTranscriptDirection;
  phone: string;
  body: string;
  context?: AnyConversationContext | null;
}): void {
  void logSmsTranscript(input).catch((error) => {
    console.error("Failed to log SMS transcript:", error);
  });
}
