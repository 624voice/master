import {
  detectExplicitSchedulingRequest,
  detectMeetingBridgeAgreement,
  meetingBridgeQuestionDelivered,
} from "~/server/speed2Lead/conversationHandoff";
import { analyzeMessage } from "~/server/speed2Lead/naturalLanguage";
import {
  classifySchedulingTimeIntent,
  resolveOfferedSlotSelectionCandidate,
} from "~/server/speed2Lead/schedulingContext";
import { isMeetingInterestConfirmed } from "~/server/speed2Lead/meetingInterest";
import type { TurnSemanticKind, TurnSemantics } from "~/server/speed2Lead/sessionMemoryTypes";
import type { AnyConversationContext } from "~/server/speed2Lead/types";
import type { ModelRunner } from "~/server/speed2Lead/orchestrator";

const GREETING_RE =
  /^(?:hey|hi|hello|yo|sup|what'?s up|howdy|good (?:morning|afternoon|evening))(?:[\s,.!]|$)/i;

export function inferTurnSemanticsDeterministic(
  message: string,
  context: AnyConversationContext,
): TurnSemantics {
  const trimmed = message.trim();
  const signals = analyzeMessage(trimmed);
  const scheduling = context.scheduling;
  const offered = scheduling?.offeredSlots ?? [];

  if (signals.stop) {
    return { kind: "opt_out", source: "deterministic", confidence: "high" };
  }
  if (signals.decline || signals.notInterested) {
    return { kind: "objection", source: "deterministic", confidence: "high" };
  }

  if (
    scheduling?.status === "slots_offered" &&
    (classifySchedulingTimeIntent(trimmed, scheduling) === "select" ||
      resolveOfferedSlotSelectionCandidate(trimmed, offered))
  ) {
    return { kind: "scheduling_selection", source: "deterministic", confidence: "high" };
  }

  if (
    detectExplicitSchedulingRequest(trimmed) ||
    (isMeetingInterestConfirmed(context.knownFacts) &&
      (scheduling?.centralDate || scheduling?.partOfDay || scheduling?.anchorTimeMinutes != null))
  ) {
    return { kind: "scheduling", source: "deterministic", confidence: "high" };
  }

  if (
    meetingBridgeQuestionDelivered(context) &&
    detectMeetingBridgeAgreement(trimmed) &&
    !detectExplicitSchedulingRequest(trimmed)
  ) {
    return { kind: "meeting_interest_yes", source: "deterministic", confidence: "high" };
  }

  if (detectExplicitSchedulingRequest(trimmed)) {
    return { kind: "scheduling", source: "deterministic", confidence: "high" };
  }

  if (signals.priceQuestion || signals.faqQuestion || signals.tellMeMore) {
    return { kind: "faq", source: "deterministic", confidence: "high" };
  }

  if (signals.objection) {
    return { kind: "objection", source: "deterministic", confidence: "medium" };
  }

  if (/\b(actually|instead|not that|wrong|meant)\b/i.test(trimmed)) {
    return { kind: "correction", source: "deterministic", confidence: "medium" };
  }

  if (signals.vague || signals.notReady || /\b(huh|what\?|what do you mean)\b/i.test(trimmed)) {
    return { kind: "clarification", source: "deterministic", confidence: "medium" };
  }

  if (GREETING_RE.test(trimmed) && !signals.hasSubstance && signals.pains.length === 0) {
    return { kind: "greeting", source: "deterministic", confidence: "high" };
  }

  if (!signals.hasSubstance && signals.pains.length === 0 && trimmed.length <= 16) {
    return { kind: "non_answer", source: "deterministic", confidence: "medium" };
  }

  if (signals.pains.length > 0 || signals.hasSubstance) {
    return { kind: "substantive_answer", source: "deterministic", confidence: "high" };
  }

  return { kind: "non_answer", source: "deterministic", confidence: "low" };
}

const VALID_KINDS: TurnSemanticKind[] = [
  "greeting",
  "non_answer",
  "substantive_answer",
  "clarification",
  "objection",
  "faq",
  "meeting_interest_yes",
  "scheduling",
  "scheduling_selection",
  "correction",
  "opt_out",
];

function parseSemanticKind(raw: unknown): TurnSemanticKind | null {
  if (typeof raw !== "string") return null;
  return VALID_KINDS.includes(raw as TurnSemanticKind) ? (raw as TurnSemanticKind) : null;
}

async function classifyTurnWithLlm(
  message: string,
  context: AnyConversationContext,
  runModel: ModelRunner,
  model: string,
): Promise<TurnSemantics | null> {
  const result = await runModel({
    model,
    tools: [],
    instructions: [
      "Classify the customer's SMS turn for a home-services ROI follow-up conversation.",
      "Return ONLY JSON: {\"kind\":\"...\"} using one of:",
      VALID_KINDS.join(", "),
      "Do not advance stages. Do not invent facts.",
    ].join("\n"),
    input: [
      {
        role: "user",
        content: JSON.stringify({
          inboundMessage: message,
          schedulingStatus: context.scheduling?.status ?? "idle",
          meetingInterestConfirmed: isMeetingInterestConfirmed(context.knownFacts),
          diagnosticQuestionsAsked: context.knownFacts?.diagnosticQuestionsAsked ?? 0,
        }),
      },
    ],
  });

  const text = result.outputText.trim();
  try {
    const parsed = JSON.parse(text) as { kind?: unknown };
    const kind = parseSemanticKind(parsed.kind);
    if (!kind) return null;
    return { kind, source: "llm", confidence: "high" };
  } catch {
    return null;
  }
}

export async function resolveTurnSemantics(
  message: string,
  context: AnyConversationContext,
  options: { runModel?: ModelRunner; model?: string } = {},
): Promise<TurnSemantics> {
  const deterministic = inferTurnSemanticsDeterministic(message, context);
  if (!options.runModel) {
    return deterministic;
  }

  const llm = await classifyTurnWithLlm(
    message,
    context,
    options.runModel,
    options.model ?? "gpt-4.1-mini",
  );
  if (!llm) {
    return deterministic;
  }

  if (deterministic.confidence === "high" && llm.confidence !== "high") {
    return deterministic;
  }
  return llm;
}

export function allowsPainPersistence(semantics: TurnSemantics): boolean {
  return semantics.kind === "substantive_answer" || semantics.kind === "correction";
}

export function allowsDiscoveryAdvancement(semantics: TurnSemantics): boolean {
  return (
    semantics.kind === "substantive_answer" ||
    semantics.kind === "correction" ||
    semantics.kind === "scheduling" ||
    semantics.kind === "meeting_interest_yes"
  );
}

export function isNonAnswerLike(semantics: TurnSemantics): boolean {
  return (
    semantics.kind === "greeting" ||
    semantics.kind === "non_answer" ||
    semantics.kind === "clarification"
  );
}

export function isMeetingInterestSemantic(semantics: TurnSemantics): boolean {
  return semantics.kind === "meeting_interest_yes" || semantics.kind === "scheduling";
}

export function shouldPreserveCustomerGoal(semantics: TurnSemantics): boolean {
  return allowsPainPersistence(semantics);
}
