import OpenAI from "openai";
import { getSpeed2LeadLlmModel, isOpenAiConfigured } from "~/server/speed2Lead/config";
import { enforceReplyHygiene } from "~/server/speed2Lead/agent/llmTurn";
import { getActiveProfile, type AgentProfile } from "~/server/speed2Lead/agent/profile";
import { isMeetingDecline, isMeetingDeclineStage } from "~/server/speed2Lead/agent/turnGuards";
import type { AgentSession } from "~/server/speed2Lead/agent/state";

export type RoiDeclineAction =
  | { type: "none" }
  | { type: "send"; reply: string; sessionPatch: Partial<AgentSession> }
  | { type: "terminal"; reply: string; sessionPatch: Partial<AgentSession> };

export const ROI_DECLINE_EXIT =
  "Fair enough. I'll leave it there. If anything changes, just text me here.";

const REFRAME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: {
      type: "string",
      description: "One short, low-pressure SMS reframe after a meeting decline.",
    },
  },
  required: ["reply"],
} as const;

export function buildRoiDeclineReframeFallback(
  session: AgentSession,
  profile: AgentProfile = getActiveProfile(),
): string {
  const opportunity = session.annualOpportunity?.trim();
  const pain = session.primaryOpportunity?.trim() || session.primaryPain?.replace(/_/g, " ") || "those missed opportunities";
  const lead = opportunity
    ? `Totally fair. With about ${opportunity} on the table around ${pain}, 25 minutes is usually enough to see if this would pay off`
    : `Totally fair. 25 minutes is usually enough to see if this would actually help with ${pain}`;
  const guarantee = profile.resultsGuarantee?.trim();
  const withGuarantee = guarantee ? `${lead} — ${guarantee}. Worth a look?` : `${lead}. Worth a look?`;
  if (withGuarantee.length <= 320) return withGuarantee;
  return `${lead}. Worth a look?`;
}

export async function generateRoiDeclineReframe(
  session: AgentSession,
  profile: AgentProfile = getActiveProfile(),
): Promise<string> {
  if (!isOpenAiConfigured()) {
    return buildRoiDeclineReframeFallback(session, profile);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const context = {
    firstName: session.firstName,
    businessName: session.businessName,
    annualOpportunity: session.annualOpportunity,
    primaryOpportunity: session.primaryOpportunity,
    primaryPain: session.primaryPain,
    resultsGuarantee: profile.resultsGuarantee ?? null,
    recentMessages: session.messages.slice(-6),
  };

  const response = await client.responses.create({
    model: getSpeed2LeadLlmModel(),
    instructions:
      "Write ONE short SMS (max 320 chars, at most one question) as Chris with 624Voice. " +
      "The prospect just declined a 25-minute meeting after seeing their ROI report. " +
      "Give ONE relevant, low-pressure reframe using the report context (annualOpportunity, primaryOpportunity) if relevant. " +
      "You may cite the exact guarantee text provided in context verbatim if it fits naturally; " +
      "do not invent any other guarantee, number, or timeframe beyond what's given. " +
      "No hype, no fake urgency, no second pitch stack. Return only JSON with reply.",
    input: [{ role: "user", content: JSON.stringify(context, null, 2) }],
    text: {
      format: {
        type: "json_schema",
        name: "roi_decline_reframe",
        schema: REFRAME_SCHEMA,
        strict: true,
      },
    },
  });

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new Error("Empty ROI decline reframe output");
  }
  const parsed = JSON.parse(raw) as { reply: string };
  return enforceReplyHygiene(parsed.reply);
}

export async function resolveRoiDeclineAction(
  session: AgentSession,
  body: string,
  deps: { generateReframe?: typeof generateRoiDeclineReframe } = {},
): Promise<RoiDeclineAction> {
  if (session.flow && session.flow !== "roi") {
    return { type: "none" };
  }

  const declineThisTurn = isMeetingDecline(body) && isMeetingDeclineStage(session.stage);
  if (!declineThisTurn) {
    return { type: "none" };
  }

  const nextCount = (session.meetingDeclineCount ?? 0) + 1;

  if (nextCount >= 2) {
    return {
      type: "terminal",
      reply: ROI_DECLINE_EXIT,
      sessionPatch: {
        meetingDeclineCount: nextCount,
        stage: "declined",
      },
    };
  }

  const generate = deps.generateReframe ?? generateRoiDeclineReframe;
  let reply: string;
  try {
    reply = await generate(session);
  } catch (error) {
    console.error("ROI decline reframe failed, using fallback:", error);
    reply = buildRoiDeclineReframeFallback(session);
  }
  return {
    type: "send",
    reply,
    sessionPatch: {
      meetingDeclineCount: nextCount,
      stage: session.stage === "offering_slots" || session.stage === "confirming" ? session.stage : "bridge",
    },
  };
}
