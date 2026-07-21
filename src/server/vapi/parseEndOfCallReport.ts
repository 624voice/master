export type DemoCallMetadata = {
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  website?: string;
  smsConsent?: boolean | string;
  source?: string;
};

export type ParsedEndOfCallReport = {
  metadata: DemoCallMetadata;
  transcript: string;
  recordingUrl: string;
  durationSeconds: number | undefined;
  endedReason: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function extractMetadata(body: Record<string, unknown>): DemoCallMetadata {
  const message = asRecord(body.message) ?? body;
  const call = asRecord(message.call);
  const assistant = asRecord(message.assistant) ?? asRecord(call?.assistant);

  const candidates = [
    asRecord(message.metadata),
    asRecord(call?.metadata),
    asRecord(assistant?.metadata),
    asRecord(message.assistantOverrides)?.metadata
      ? asRecord(asRecord(message.assistantOverrides)?.metadata)
      : null,
  ].filter(Boolean) as Record<string, unknown>[];

  const merged: DemoCallMetadata = {};
  for (const record of candidates) {
    if (record.firstName) merged.firstName = readString(record, "firstName");
    if (record.lastName) merged.lastName = readString(record, "lastName");
    if (record.businessName) {
      merged.businessName = readString(record, "businessName");
    }
    if (record.email) merged.email = readString(record, "email");
    if (record.phone) merged.phone = readString(record, "phone");
    if (record.website) merged.website = readString(record, "website");
    if (record.smsConsent !== undefined) {
      merged.smsConsent = record.smsConsent as boolean | string;
    }
    if (record.source) merged.source = readString(record, "source");
  }

  return merged;
}

function extractTranscript(message: Record<string, unknown>): string {
  const artifact = asRecord(message.artifact);
  const fromArtifact = artifact ? readString(artifact, "transcript") : "";
  if (fromArtifact) {
    return fromArtifact;
  }
  return readString(message, "transcript");
}

function extractRecordingUrl(message: Record<string, unknown>): string {
  const artifact = asRecord(message.artifact);
  const recording = artifact ? asRecord(artifact.recording) : null;
  if (recording) {
    const url =
      readString(recording, "url") ||
      readString(recording, "stereoUrl") ||
      readString(recording, "monoUrl");
    if (url) {
      return url;
    }
  }
  return readString(message, "recordingUrl");
}

export function parseEndOfCallReport(body: unknown): ParsedEndOfCallReport | null {
  const root = asRecord(body);
  if (!root) {
    return null;
  }

  const message = asRecord(root.message) ?? root;
  if (readString(message, "type") !== "end-of-call-report") {
    return null;
  }

  const durationValue = message.durationSeconds ?? message.duration;
  const durationSeconds =
    typeof durationValue === "number" ? durationValue : undefined;

  return {
    metadata: extractMetadata(root),
    transcript: extractTranscript(message),
    recordingUrl: extractRecordingUrl(message),
    durationSeconds,
    endedReason:
      readString(message, "endedReason") || readString(message, "endReason"),
  };
}
