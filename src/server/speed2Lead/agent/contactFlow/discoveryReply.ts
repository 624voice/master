import { isConsequenceQuestion } from "~/server/speed2Lead/agent/discoveryGuard";
import type { AgentSession } from "~/server/speed2Lead/agent/state";

const CONSEQUENCE_QUESTION_VARIANTS = [
  "What's that been costing you, would you say?",
  "Roughly what kind of impact has that had on revenue or jobs?",
  "Any sense what that's adding up to over a month or so?",
] as const;

export function countConsequenceQuestionsAsked(session: AgentSession): number {
  return session.messages.filter(
    (message) => message.role === "assistant" && isConsequenceQuestion(message.content),
  ).length;
}

export function buildConsequenceQuestionVariant(alreadyAsked: number): string {
  const index = Math.min(Math.max(alreadyAsked, 0), CONSEQUENCE_QUESTION_VARIANTS.length - 1);
  return CONSEQUENCE_QUESTION_VARIANTS[index]!;
}

/** Graceful bridge when a second cost answer still isn't numeric enough for the model. */
export function buildDiscoveryProceedFallback(session: AgentSession): string {
  const topic = session.helpTextSummary ?? "those missed opportunities";
  return (
    `Got it — sounds like ${topic} is costing you real business. ` +
    "Would a quick 25-minute chat be worth seeing if we can help?"
  );
}

export function avoidDuplicateAssistantReply(session: AgentSession, reply: string): string {
  const lastAssistant = [...session.messages].reverse().find((message) => message.role === "assistant");
  if (!lastAssistant || lastAssistant.content !== reply) {
    return reply;
  }
  if (isConsequenceQuestion(reply)) {
    const asked = countConsequenceQuestionsAsked(session);
    const variant = buildConsequenceQuestionVariant(asked);
    return variant === reply && asked + 1 < CONSEQUENCE_QUESTION_VARIANTS.length
      ? buildConsequenceQuestionVariant(asked + 1)
      : variant;
  }
  return reply.endsWith("?") ? `${reply.replace(/\?$/, "")} — even a rough sense helps.` : reply;
}

export function shouldProceedAfterRepeatedCostAsk(session: AgentSession, reply: string): boolean {
  return isConsequenceQuestion(reply) && countConsequenceQuestionsAsked(session) >= 1;
}
