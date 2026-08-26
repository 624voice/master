/**
 * The entire "brain" of the rebuilt Speed2Lead agent: one structured-output
 * LLM call per inbound SMS.
 *
 * This replaces `orchestrator.ts` (948 lines), `prompts.ts`,
 * `conversationStage.ts`, `discoveryProgress.ts`, `naturalLanguage.ts`,
 * `globalIntents.ts`, `meetingInterest.ts`, `guardrails.ts`,
 * `turnSemantics.ts`, and the regex-based intent classifiers in
 * `src/server/scheduling/`. The model is always shown the true session state
 * and the true available slots, and it reports back a structured judgment —
 * it never has to be pattern-matched after the fact.
 */
import OpenAI from "openai";
import { getSpeed2LeadLlmModel, isOpenAiConfigured } from "~/server/speed2Lead/config";
import { painOutcomeFor, type AgentProfile } from "~/server/speed2Lead/agent/profile";
import type { AgentSession, OfferedSlot } from "~/server/speed2Lead/agent/state";

export type AgentStageOutput =
  | "discovery"
  | "bridge"
  | "offering_slots"
  | "confirming"
  | "booked"
  | "declined"
  | "handoff";

export type AgentTurnOutput = {
  reply: string;
  stage: AgentStageOutput;
  primary_pain: string | null;
  wants_meeting: boolean;
  slot_choice_index: number | null;
  confirm_booking: boolean;
  opt_out: boolean;
};

const MAX_SMS_LENGTH = 320;

const TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: {
      type: "string",
      description: "The exact SMS body to send. One short message. At most one question. No markdown.",
    },
    stage: {
      type: "string",
      enum: ["discovery", "bridge", "offering_slots", "confirming", "booked", "declined", "handoff"],
    },
    primary_pain: {
      type: ["string", "null"],
      description: "One pain-outcome key from the profile if newly identified this turn, else null.",
    },
    wants_meeting: { type: "boolean", description: "True if the prospect has agreed to a meeting." },
    slot_choice_index: {
      type: ["integer", "null"],
      description: "0-based index into the offered slot list the prospect picked this turn, else null.",
    },
    confirm_booking: {
      type: "boolean",
      description: "True only if the prospect just gave a clear affirmative to book the picked slot.",
    },
    opt_out: { type: "boolean", description: "True if the prospect asked to stop texts." },
  },
  required: ["reply", "stage", "primary_pain", "wants_meeting", "slot_choice_index", "confirm_booking", "opt_out"],
} as const;

function buildInstructions(profile: AgentProfile, session: AgentSession, offered: OfferedSlot[]): string {
  const outcome = painOutcomeFor(profile, session.primaryPain ?? undefined);

  const payload = {
    persona: `${profile.senderFirstName} with ${profile.companyName}. Direct, practical SMS for home-services owners.`,
    goal:
      "Reply fast, uncover one or two real pain points, connect them to a business outcome, and get a yes to a short meeting. This is NOT a full qualification call — bias toward booking over more discovery.",
    positioning: profile.positioningSummary,
    capabilities: profile.capabilities,
    notCapabilities: profile.nonCapabilities,
    meetingLengthMinutes: profile.meetingLengthMinutes,
    rules: [
      "One short SMS. At most one question.",
      "Never invent a date, time, or availability — only offer times from offeredSlots below.",
      "Never require an exact confirmation phrase — treat any clear 'yes'/'sounds good'/'book it' as confirm_booking=true.",
      "Do not re-ask a question already answered in knownFacts or the conversation history.",
      `If you don't know their name, don't use a placeholder — just don't use a name.`,
      "If the prospect wants to reschedule to a time not in offeredSlots, set stage back to 'bridge' and ask what day/time range works instead of guessing a new slot.",
    ],
    knownFacts: {
      firstName: session.firstName,
      businessName: session.businessName,
      annualOpportunity: session.annualOpportunity,
      primaryOpportunityFromReport: session.primaryOpportunity,
      primaryPainIdentified: session.primaryPain,
      priorNotes: session.notes,
    },
    currentStage: session.stage,
    outcomeBridge: {
      painLabel: outcome.label,
      outcomes: outcome.outcomes,
      bridgePattern: `Ask ONE conditional question: if you could show them a way to ${outcome.outcomes.join(", ")}, would it be worth ${profile.meetingLengthMinutes} minutes to see how it works?`,
    },
    offeredSlots:
      offered.length > 0
        ? offered.map((slot, index) => ({ index, label: slot.label }))
        : "none offered yet this turn — do not mention specific times",
    bookedAlready: Boolean(session.bookedStartIso),
  };

  return [
    `You are ${profile.senderFirstName} with ${profile.companyName}, replying over SMS to a prospect who just downloaded their ROI report.`,
    "Follow the JSON context for this turn only. Return only the structured fields — `reply` is the exact SMS body.",
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function enforceReplyHygiene(reply: string): string {
  let text = reply.trim();
  if (text.length > MAX_SMS_LENGTH) {
    text = `${text.slice(0, MAX_SMS_LENGTH - 1).trimEnd()}…`;
  }
  return text;
}

export type RunAgentTurnDeps = {
  client?: OpenAI;
};

export async function runAgentTurn(
  profile: AgentProfile,
  session: AgentSession,
  offered: OfferedSlot[],
  deps: RunAgentTurnDeps = {},
): Promise<AgentTurnOutput> {
  if (!isOpenAiConfigured()) {
    throw new Error("OpenAI is not configured");
  }

  const client = deps.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: getSpeed2LeadLlmModel(),
    instructions: buildInstructions(profile, session, offered),
    input: session.messages.slice(-16).map((message) => ({
      role: message.role,
      content: message.content,
    })),
    text: {
      format: {
        type: "json_schema",
        name: "speed2lead_turn",
        schema: TURN_SCHEMA,
        strict: true,
      },
    },
  });

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new Error("Empty model output");
  }

  const parsed = JSON.parse(raw) as AgentTurnOutput;
  return { ...parsed, reply: enforceReplyHygiene(parsed.reply) };
}
