export type VoiceTranscriptPayload = {
  type: "voice_transcript";
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  website?: string;
  durationSeconds?: number;
  endedReason?: string;
  transcript?: string;
  recordingUrl?: string;
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

export async function logVoiceTranscript(
  input: Omit<VoiceTranscriptPayload, "type" | "capturedAt">,
): Promise<void> {
  const url = process.env.LEADS_WEBHOOK_URL;
  if (!url) {
    return;
  }

  const payload: VoiceTranscriptPayload = {
    type: "voice_transcript",
    capturedAt: formatCentralTimestamp(),
    ...input,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Voice transcript webhook failed with status ${response.status}`,
    );
  }
}

export function logVoiceTranscriptSafely(
  input: Omit<VoiceTranscriptPayload, "type" | "capturedAt">,
): void {
  void logVoiceTranscript(input).catch((error) => {
    console.error("Failed to log voice transcript:", error);
  });
}
