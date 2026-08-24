import { detectExplicitSchedulingRequest } from "~/server/speed2Lead/conversationHandoff";
import {
  analyzeMessage,
  primaryPainLabel,
  type PainCategory,
} from "~/server/speed2Lead/naturalLanguage";
import { painMapsToCapability } from "~/server/speed2Lead/businessContext";
import { isMeetingInterestConfirmed } from "~/server/speed2Lead/meetingInterest";
import {
  allowsDiscoveryAdvancement,
  allowsPainPersistence,
  isNonAnswerLike,
  isMeetingInterestSemantic,
} from "~/server/speed2Lead/turnSemantics";
import type { DiscoveryPhase, KnownFacts, TurnSemantics } from "~/server/speed2Lead/sessionMemoryTypes";
import type { LlmTurnTask } from "~/server/speed2Lead/conversationStage";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

export const MAX_DIAGNOSTIC_QUESTIONS = 2;

const REPORT_REACTION_OPENING_RE = /which part stood out most/i;

const DISCOVERY_PHASE_ORDER: DiscoveryPhase[] = [
  "awaiting_report_reaction",
  "diagnostic",
  "discovery_complete",
  "bridge",
  "scheduling",
  "booked",
];

function maxDiscoveryPhase(...phases: Array<DiscoveryPhase | undefined>): DiscoveryPhase {
  return phases.reduce<DiscoveryPhase>((peak, phase) => {
    if (!phase) return peak;
    return DISCOVERY_PHASE_ORDER.indexOf(phase) > DISCOVERY_PHASE_ORDER.indexOf(peak)
      ? phase
      : peak;
  }, "awaiting_report_reaction");
}

export function defaultDiscoveryPhase(context: AnyConversationContext): DiscoveryPhase {
  const userMessages = (context.messages ?? []).filter((message) => message.role === "user").length;
  if (userMessages === 0) return "awaiting_report_reaction";
  return "diagnostic";
}

function computeMinimumDiscoveryPhase(facts: KnownFacts): DiscoveryPhase {
  if (isMeetingInterestConfirmed(facts)) return "scheduling";
  if (
    (facts.diagnosticQuestionsAsked ?? 0) >= MAX_DIAGNOSTIC_QUESTIONS ||
    ((facts.diagnosticQuestionsAsked ?? 0) >= 1 && facts.primaryPain)
  ) {
    return "discovery_complete";
  }
  if ((facts.diagnosticQuestionsAsked ?? 0) >= 1 || facts.primaryPain) {
    return "diagnostic";
  }
  return "awaiting_report_reaction";
}

export function normalizeDiscoveryFacts(facts: KnownFacts): KnownFacts {
  const legacyCount = Math.max(
    0,
    Math.min(MAX_DIAGNOSTIC_QUESTIONS, facts.questionsAsked ?? 0),
  );
  const explicitCount =
    facts.diagnosticQuestionsAsked != null
      ? Math.max(0, Math.min(MAX_DIAGNOSTIC_QUESTIONS, facts.diagnosticQuestionsAsked))
      : legacyCount;
  const diagnosticQuestionsAsked = Math.max(explicitCount, legacyCount);

  const floorPhase = computeMinimumDiscoveryPhase({
    ...facts,
    diagnosticQuestionsAsked,
  });
  const peakDiscoveryPhase = maxDiscoveryPhase(
    floorPhase,
    facts.peakDiscoveryPhase,
    facts.discoveryPhase,
  );

  return {
    ...facts,
    diagnosticQuestionsAsked,
    discoveryPhase: peakDiscoveryPhase,
    peakDiscoveryPhase,
    questionsAsked: diagnosticQuestionsAsked,
  };
}

function advancePhase(current: DiscoveryPhase, next: DiscoveryPhase): DiscoveryPhase {
  return maxDiscoveryPhase(current, next);
}

function userMessageCount(context: AnyConversationContext): number {
  return (context.messages ?? []).filter((message) => message.role === "user").length;
}

export function simplePainLabel(pains: PainCategory[]): string {
  if (pains.length === 0) return primaryPainLabel(pains);
  const first = pains[0]!;
  const labels: Partial<Record<PainCategory, string>> = {
    missed_calls: "missed calls",
    slow_response: "slow response",
    follow_up: "follow-up gaps",
    after_hours: "after-hours coverage",
    workload: "office workload",
    website: "website leads",
    scheduling: "scheduling gaps",
    multiple: "missed opportunities",
  };
  return labels[first] ?? primaryPainLabel(pains);
}

function persistInboundPain(
  facts: KnownFacts,
  pains: PainCategory[],
  inboundMessage: string,
): KnownFacts {
  if (pains.length === 0) {
    return facts;
  }
  return {
    ...facts,
    primaryPain: simplePainLabel(pains),
    fit: facts.fit ?? "maybe",
  };
}

export function shouldCompleteDiscovery(facts: KnownFacts, pains: PainCategory[]): boolean {
  if ((facts.diagnosticQuestionsAsked ?? 0) >= MAX_DIAGNOSTIC_QUESTIONS) {
    return true;
  }
  if ((facts.diagnosticQuestionsAsked ?? 0) >= 1 && facts.primaryPain) {
    return true;
  }
  if ((facts.diagnosticQuestionsAsked ?? 0) >= 1 && painMapsToCapability(pains) && pains.length > 0) {
    return true;
  }
  if (facts.primaryPain && facts.fit === "yes") {
    return true;
  }
  return false;
}

export function advanceDiscoveryOnInbound<T extends AnyConversationContext>(
  context: T,
  inboundMessage: string,
  semantics?: TurnSemantics,
): T {
  const normalized = {
    ...context,
    knownFacts: normalizeDiscoveryFacts(context.knownFacts ?? ({} as KnownFacts)),
  };
  const facts = normalized.knownFacts;
  const signals = analyzeMessage(inboundMessage);
  let updatedFacts =
    semantics && !allowsPainPersistence(semantics)
      ? facts
      : persistInboundPain(facts, signals.pains, inboundMessage);
  let phase = updatedFacts.discoveryPhase ?? defaultDiscoveryPhase(normalized);

  if (normalized.scheduling?.status === "confirmed" || normalized.disposition === "booked") {
    phase = "booked";
  } else if (
    detectExplicitSchedulingRequest(inboundMessage) ||
    isMeetingInterestConfirmed(updatedFacts) ||
    isMeetingInterestSemantic(semantics ?? { kind: "non_answer", source: "deterministic", confidence: "low" }) ||
    normalized.scheduling?.centralDate ||
    normalized.scheduling?.status === "slots_offered"
  ) {
    phase = advancePhase(phase, "scheduling");
  } else if (
    userMessageCount(normalized) >= 1 &&
    phase === "awaiting_report_reaction" &&
    (!semantics || (allowsDiscoveryAdvancement(semantics) && !isNonAnswerLike(semantics)))
  ) {
    phase = "diagnostic";
  }

  if (shouldCompleteDiscovery(updatedFacts, signals.pains) && (!semantics || allowsDiscoveryAdvancement(semantics))) {
    phase = advancePhase(phase, "discovery_complete");
  }

  if (isMeetingInterestConfirmed(updatedFacts) && phase !== "booked") {
    phase = advancePhase(phase, "scheduling");
  } else if (phase === "discovery_complete" && !isMeetingInterestConfirmed(updatedFacts)) {
    phase = "bridge";
  }

  updatedFacts = {
    ...updatedFacts,
    discoveryPhase: phase,
    peakDiscoveryPhase: maxDiscoveryPhase(updatedFacts.peakDiscoveryPhase, phase),
  };

  return {
    ...normalized,
    knownFacts: normalizeDiscoveryFacts(updatedFacts),
  } as T;
}

export function recordDiagnosticQuestionAsked<T extends AnyConversationContext>(context: T): T {
  const facts = normalizeDiscoveryFacts(context.knownFacts);
  const nextCount = Math.min(MAX_DIAGNOSTIC_QUESTIONS, (facts.diagnosticQuestionsAsked ?? 0) + 1);
  let phase = facts.discoveryPhase ?? "diagnostic";
  if (nextCount >= MAX_DIAGNOSTIC_QUESTIONS) {
    phase = advancePhase(phase, "discovery_complete");
  }
  return {
    ...context,
    knownFacts: normalizeDiscoveryFacts({
      ...facts,
      diagnosticQuestionsAsked: nextCount,
      questionsAsked: nextCount,
      discoveryPhase: phase,
      peakDiscoveryPhase: maxDiscoveryPhase(facts.peakDiscoveryPhase, phase),
    }),
  } as T;
}

export function recordDiscoveryAssistantTurn<T extends AnyConversationContext>(
  context: T,
  task: LlmTurnTask,
  assistantReply: string,
): T {
  let updated = context;
  if (
    task === "ask_one_operational_followup" ||
    task === "acknowledge_report_reaction_and_ask_one_operational_question"
  ) {
    if (!REPORT_REACTION_OPENING_RE.test(assistantReply)) {
      updated = recordDiagnosticQuestionAsked(updated);
    }
  }

  const facts = normalizeDiscoveryFacts(updated.knownFacts);
  let phase = facts.discoveryPhase ?? "diagnostic";
  if (facts.primaryPain && (facts.diagnosticQuestionsAsked ?? 0) >= 1) {
    phase = advancePhase(phase, "discovery_complete");
  }
  if (facts.meetingInterestConfirmed || facts.meetingBridgeComplete) {
    phase = advancePhase(phase, "scheduling");
  } else if (phase === "discovery_complete") {
    phase = "bridge";
  }

  return {
    ...updated,
    knownFacts: normalizeDiscoveryFacts({
      ...facts,
      discoveryPhase: phase,
      peakDiscoveryPhase: maxDiscoveryPhase(facts.peakDiscoveryPhase, phase),
    }),
  } as T;
}

export function isReportReactionComplete(context: AnyConversationContext): boolean {
  const phase = normalizeDiscoveryFacts(context.knownFacts ?? ({} as KnownFacts)).discoveryPhase;
  return phase !== "awaiting_report_reaction";
}

export function isDiscoveryComplete(context: AnyConversationContext): boolean {
  const phase = normalizeDiscoveryFacts(context.knownFacts ?? ({} as KnownFacts)).discoveryPhase;
  return (
    phase === "discovery_complete" ||
    phase === "bridge" ||
    phase === "scheduling" ||
    phase === "booked"
  );
}

export function diagnosticQuestionsRemaining(context: AnyConversationContext): number {
  const facts = normalizeDiscoveryFacts(context.knownFacts ?? ({} as KnownFacts));
  return Math.max(0, MAX_DIAGNOSTIC_QUESTIONS - (facts.diagnosticQuestionsAsked ?? 0));
}

export function shouldAskAnotherDiagnosticQuestion(context: AnyConversationContext): boolean {
  if (isDiscoveryComplete(context)) return false;
  return diagnosticQuestionsRemaining(context) > 0;
}
