import OpenAI from "openai";
import { getSpeed2LeadLlmModel, isOpenAiConfigured } from "~/server/speed2Lead/config";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { isMeetingDecline, isMeetingDeclineStage } from "~/server/speed2Lead/agent/turnGuards";
import { buildDemoTimingDeclineExit } from "~/server/speed2Lead/agent/demoFlow/openers";
import type { AgentSession } from "~/server/speed2Lead/agent/state";

export type DemoDeclineAction =
  | { type: "none" }
  | { type: "send"; reply: string; sessionPatch: Partial<AgentSession> }
  | { type: "terminal"; reply: string; sessionPatch: Partial<AgentSession> };

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

export async function generateDemoDeclineReframe(session: AgentSession): Promise<string> {
  if (!isOpenAiConfigured()) {
    const name = session.businessName?.trim() || "your business";
    return (
      `Totally fair. If I could show you how Jessica could handle more of those calls for ${name} ` +
      "without adding another person, would it still be worth 25 minutes to take a look?"
    );
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const profile = getActiveProfile();
  const context = {
    firstName: session.firstName,
    businessName: session.businessName,
    callOutcome: session.callOutcome,
    demoSummary: session.demoSummary ?? null,
    primaryPain: session.primaryPain,
    resultsGuarantee: profile.resultsGuarantee ?? null,
    recentMessages: session.messages.slice(-6),
  };

  const response = await client.responses.create({
    model: getSpeed2LeadLlmModel(),
    instructions:
      "Write ONE short SMS (max 320 chars, at most one question) as Chris with 624Voice. " +
      "The prospect just declined a 25-minute meeting. Give ONE relevant, low-pressure reframe " +
      "using context from their Jessica demo — no hype, no fake urgency, no second pitch stack. " +
      "You may cite the exact guarantee text provided in context verbatim if it fits naturally; " +
      "do not invent any other guarantee, number, or timeframe beyond what's given. " +
      "Return only JSON with reply.",
    input: [{ role: "user", content: JSON.stringify(context, null, 2) }],
    text: {
      format: {
        type: "json_schema",
        name: "demo_decline_reframe",
        schema: REFRAME_SCHEMA,
        strict: true,
      },
    },
  });

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new Error("Empty decline reframe output");
  }
  const parsed = JSON.parse(raw) as { reply: string };
  return parsed.reply.trim().slice(0, 320);
}

export async function resolveDemoDeclineAction(
  session: AgentSession,
  body: string,
): Promise<DemoDeclineAction> {
  if (session.flow !== "demo") {
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
      reply: buildDemoTimingDeclineExit(),
      sessionPatch: {
        meetingDeclineCount: nextCount,
        stage: "declined",
      },
    };
  }

  const reply = await generateDemoDeclineReframe(session);
  return {
    type: "send",
    reply,
    sessionPatch: {
      meetingDeclineCount: nextCount,
      stage: "bridge",
    },
  };
}
