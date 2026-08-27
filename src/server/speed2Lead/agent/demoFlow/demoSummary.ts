import OpenAI from "openai";
import { getSpeed2LeadLlmModel, isOpenAiConfigured } from "~/server/speed2Lead/config";
import type { DemoSummary } from "~/server/speed2Lead/agent/demoFlow/types";

export const DEMO_SUMMARY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    serviceAreaChecked: { type: "boolean" },
    schedulingFlowCompleted: { type: "boolean" },
    appointmentBookedInDemo: { type: "boolean" },
    objectionsRaised: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
    upsellPresented: { type: "boolean" },
    topPositiveMoment: { type: ["string", "null"] },
    topConcern: { type: ["string", "null"] },
    prospectSentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
  },
  required: [
    "serviceAreaChecked",
    "schedulingFlowCompleted",
    "appointmentBookedInDemo",
    "objectionsRaised",
    "upsellPresented",
    "topPositiveMoment",
    "topConcern",
    "prospectSentiment",
  ],
} as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeStringArray(value: unknown, max = 3): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeSentiment(value: unknown): DemoSummary["prospectSentiment"] {
  if (value === "positive" || value === "negative") return value;
  return "neutral";
}

export function normalizeDemoSummary(raw: unknown): DemoSummary | null {
  const record = asRecord(raw);
  if (!record) return null;

  return {
    serviceAreaChecked: record.serviceAreaChecked === true,
    schedulingFlowCompleted: record.schedulingFlowCompleted === true,
    appointmentBookedInDemo: record.appointmentBookedInDemo === true,
    objectionsRaised: normalizeStringArray(record.objectionsRaised),
    upsellPresented: record.upsellPresented === true,
    topPositiveMoment:
      typeof record.topPositiveMoment === "string" && record.topPositiveMoment.trim()
        ? record.topPositiveMoment.trim()
        : null,
    topConcern:
      typeof record.topConcern === "string" && record.topConcern.trim()
        ? record.topConcern.trim()
        : null,
    prospectSentiment: normalizeSentiment(record.prospectSentiment),
  };
}

/** Read Vapi analysis.structuredData or artifact structuredOutputs (first object result). */
export function parseDemoSummaryFromVapiPayload(input: {
  structuredData?: unknown;
  structuredOutputs?: unknown;
}): DemoSummary | null {
  const fromAnalysis = normalizeDemoSummary(input.structuredData);
  if (fromAnalysis) return fromAnalysis;

  const outputs = asRecord(input.structuredOutputs);
  if (!outputs) return null;

  for (const value of Object.values(outputs)) {
    const entry = asRecord(value);
    if (!entry) continue;
    const parsed = normalizeDemoSummary(entry.result ?? entry);
    if (parsed) return parsed;
  }

  return null;
}

export async function extractDemoSummaryFromTranscript(
  transcript: string,
  endedReason?: string,
): Promise<DemoSummary | null> {
  if (!transcript.trim() || !isOpenAiConfigured()) {
    return null;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: getSpeed2LeadLlmModel(),
    instructions:
      "Extract structured facts from a Jessica voice-demo call transcript. " +
      "appointmentBookedInDemo is true only if the prospect completed Jessica's simulated in-call booking flow — " +
      "that is NOT a real sales meeting. objectionsRaised: max 3 short phrases. " +
      "Return only JSON matching the schema.",
    input: [
      {
        role: "user",
        content: `Ended reason: ${endedReason ?? "unknown"}\n\nTranscript:\n${transcript.slice(0, 12000)}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "demo_summary",
        schema: DEMO_SUMMARY_JSON_SCHEMA,
        strict: true,
      },
    },
  });

  const raw = response.output_text?.trim();
  if (!raw) return null;
  return normalizeDemoSummary(JSON.parse(raw));
}

export async function resolveDemoSummary(input: {
  structuredData?: unknown;
  structuredOutputs?: unknown;
  transcript: string;
  endedReason?: string;
}): Promise<DemoSummary | null> {
  const fromVapi = parseDemoSummaryFromVapiPayload({
    structuredData: input.structuredData,
    structuredOutputs: input.structuredOutputs,
  });
  if (fromVapi) return fromVapi;

  try {
    return await extractDemoSummaryFromTranscript(input.transcript, input.endedReason);
  } catch (error) {
    console.error("Demo summary fallback extraction failed:", error);
    return null;
  }
}

export const VAPI_DEMO_SUMMARY_SCHEMA_FOR_ASSISTANT = DEMO_SUMMARY_JSON_SCHEMA;
