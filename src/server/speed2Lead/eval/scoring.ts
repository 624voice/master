import { validateOutboundSms } from "~/server/speed2Lead/guardrails";
import type { ToolExecutionState } from "~/server/speed2Lead/tools";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

export type TranscriptTurn = {
  customer: string;
  agent: string;
  handled: boolean;
  fallbackReason?: string;
};

export type ScenarioExpectations = {
  mustNotAskNeedAgain?: boolean;
  mustNotRepeatPainQuestion?: boolean;
  shouldReachScheduling?: boolean;
  shouldOfferSlots?: boolean;
  shouldConfirmBooking?: boolean;
  shouldIncludeCalendarLink?: boolean;
  mustNotConfirmBooking?: boolean;
  maxQuestionsPerTurn?: number;
  mustAcknowledgeFeedback?: boolean;
  mustNotBeAggressive?: boolean;
  customerGoalKeywords?: string[];
  forbiddenPatterns?: RegExp[];
};

export type QualityScores = {
  understoodMeaning: number;
  respondedToMessage: number;
  noRepeatKnownInfo: number;
  answeredDirectQuestions: number;
  notInterrogative: number;
  oneQuestionMax: number;
  skippedUnneededDiscovery: number;
  pacedWeakInterest: number;
  efficientStrongInterest: number;
  naturalNotTemplated: number;
  smsConcise: number;
  chrisVoice: number;
  noFabricatedCapabilities: number;
  noExactPricing: number;
  noInventedRoi: number;
  schedulingDeterministic: number;
  bookingTruthful: number;
};

export type ScenarioScore = {
  technicalPass: boolean;
  conversationalPass: boolean;
  weak: boolean;
  failed: boolean;
  quality: QualityScores;
  overall: number;
  unsupportedClaims: string[];
  notes: string[];
};

const UNSUPPORTED_CLAIM_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Affirmative ServiceTitan sync claim", pattern: /\b(yes,? we (?:can|do)|we can sync|sync(?:s|ed)? appointments directly into servicetitan|integrat(?:e|es) with servicetitan)\b/i },
  { label: "Generic CRM integration promise", pattern: /\bintegrat(e|es|ed|ion)\s+(with|into)\s+(your|any|all)\s+(crm|servicetitan|housecall|jobber)/i },
  { label: "Implementation timeline promise", pattern: /\b(within|in)\s+\d+\s+(day|days|week|weeks)\b/i },
  { label: "Exact monthly pricing", pattern: /\$\s?\d{1,4}(?:,\d{3})*(?:\.\d{2})?\s*(?:\/mo|per month|monthly)/i },
  { label: "Guarantee language", pattern: /\b(guarantee|guaranteed|100%|will definitely save)\b/i },
  { label: "Unsupported production capability", pattern: /\b(can always|always answer|never miss|fully automate your entire business)\b/i },
  { label: "Invented ROI figure", pattern: /\b(save|earn|make)\s+\$\d/i },
];

const TEMPLATE_PHRASES = [
  "where do you think you're losing",
  "what prompted you to reach out today",
  "could you actually see something like that working",
];

function countQuestions(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

function containsAny(text: string, patterns: RegExp[]): string[] {
  return patterns.filter((p) => p.test(text)).map((p) => p.source);
}

function detectUnsupportedClaims(transcript: TranscriptTurn[]): string[] {
  const claims: string[] = [];
  for (const turn of transcript) {
    const text = turn.agent;
    if (
      /\bservicetitan\b/i.test(text) &&
      /\b(depends on|mapped out|consultation|varies|scope|reviewed on a call)\b/i.test(text)
    ) {
      continue;
    }
    for (const { label, pattern } of UNSUPPORTED_CLAIM_PATTERNS) {
      if (pattern.test(text)) {
        claims.push(`${label}: "${text.slice(0, 120)}..."`);
      }
    }
  }
  return claims;
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function scoreScenario(input: {
  transcript: TranscriptTurn[];
  expectations: ScenarioExpectations;
  finalContext: AnyConversationContext;
  finalToolState: ToolExecutionState;
  toolStatesByTurn?: ToolExecutionState[];
  seededNeedSummary?: string;
}): ScenarioScore {
  const { transcript, expectations, finalContext, finalToolState, toolStatesByTurn, seededNeedSummary } = input;
  const notes: string[] = [];
  const agentTexts = transcript.map((t) => t.agent).join("\n");
  const unsupportedClaims = detectUnsupportedClaims(transcript);

  let technicalPass = transcript.every((t) => t.handled);
  if (expectations.shouldConfirmBooking && !finalToolState.bookingConfirmed) {
    technicalPass = false;
    notes.push("Expected successful booking but bookingConfirmed is false");
  }
  if (expectations.mustNotConfirmBooking && finalToolState.bookingConfirmed) {
    technicalPass = false;
    notes.push("Booking was confirmed when it should not have been");
  }
  if (expectations.shouldOfferSlots && finalToolState.offeredSlots.length === 0) {
    technicalPass = false;
    notes.push("Expected offered slots but none were recorded");
  }

  for (const [index, turn] of transcript.entries()) {
    const turnToolState = toolStatesByTurn?.[index] ?? finalToolState;
    const guard = validateOutboundSms(turn.agent, {
      session: finalContext,
      toolState: turnToolState,
    });
    if (!guard.ok) {
      technicalPass = false;
      notes.push(`Guardrail failed on turn: ${guard.reason}`);
    }
  }

  if (expectations.mustNotAskNeedAgain && seededNeedSummary) {
    const reask = /\b(what prompted you|explain your need|tell me more about your need|what made you reach out)\b/i;
    if (reask.test(agentTexts)) {
      notes.push("Re-asked contact need despite seeded summary");
    }
  }

  if (expectations.mustNotRepeatPainQuestion) {
    const painQs = (agentTexts.match(/missed calls, slow response|losing the most opportunities/gi) ?? []).length;
    if (painQs > 1) {
      notes.push("Repeated ROI pain discovery question");
    }
  }

  if (expectations.forbiddenPatterns) {
    for (const pattern of expectations.forbiddenPatterns) {
      if (pattern.test(agentTexts)) {
        notes.push(`Forbidden pattern matched: ${pattern.source}`);
        technicalPass = false;
      }
    }
  }

  const perTurnQuestions = transcript.map((t) => countQuestions(t.agent));
  const maxQ = Math.max(0, ...perTurnQuestions);
  const oneQuestionMax = expectations.maxQuestionsPerTurn
    ? maxQ <= expectations.maxQuestionsPerTurn
      ? 1
      : 0.3
    : maxQ <= 1
      ? 1
      : maxQ === 2
        ? 0.6
        : 0.2;

  const templateHits = TEMPLATE_PHRASES.filter((p) => agentTexts.toLowerCase().includes(p)).length;
  const naturalNotTemplated = Math.max(0, 1 - templateHits * 0.25);

  const avgLen = average(transcript.map((t) => t.agent.length));
  const smsConcise = avgLen <= 220 ? 1 : avgLen <= 280 ? 0.7 : avgLen <= 320 ? 0.5 : 0.2;

  const quality: QualityScores = {
    understoodMeaning: expectations.customerGoalKeywords
      ? expectations.customerGoalKeywords.some((k) => agentTexts.toLowerCase().includes(k.toLowerCase()))
        ? 1
        : 0.5
      : 0.8,
    respondedToMessage: technicalPass ? 0.85 : 0.4,
    noRepeatKnownInfo: expectations.mustNotAskNeedAgain
      ? /\b(what prompted you|explain your need)\b/i.test(agentTexts)
        ? 0.2
        : 1
      : expectations.mustNotRepeatPainQuestion
        ? (agentTexts.match(/losing the most opportunities/gi) ?? []).length > 1
          ? 0.3
          : 1
        : 0.85,
    answeredDirectQuestions: 0.8,
    notInterrogative: oneQuestionMax,
    oneQuestionMax,
    skippedUnneededDiscovery: expectations.shouldReachScheduling ? 0.85 : 0.75,
    pacedWeakInterest: expectations.mustNotBeAggressive ? (agentTexts.match(/calendar|book|schedule/gi) ?? []).length > 2 ? 0.5 : 0.9 : 0.8,
    efficientStrongInterest: expectations.shouldReachScheduling ? (finalToolState.offeredSlots.length > 0 || /calendar|time|slot|tuesday|thursday|tomorrow/i.test(agentTexts) ? 1 : 0.5) : 0.75,
    naturalNotTemplated,
    smsConcise,
    chrisVoice: /\b624voice\b/i.test(agentTexts) || /\bchris\b/i.test(agentTexts) ? 0.9 : 0.75,
    noFabricatedCapabilities: unsupportedClaims.length === 0 ? 1 : 0.2,
    noExactPricing: /\$\s?\d{1,3}(?:,\d{3})+\s*(?:per month|\/mo|monthly)/i.test(agentTexts) ? 0.2 : 1,
    noInventedRoi:
      finalContext.flow === "roi" && /\b(save|earn|make)\s+\$\d/i.test(agentTexts) && !agentTexts.includes((finalContext as { annualOpportunity?: string }).annualOpportunity ?? "")
        ? 0.2
        : 1,
    schedulingDeterministic:
      finalToolState.offeredSlots.length > 0 || !/\b\d{1,2}:\d{2}\s*(am|pm)\b/i.test(agentTexts) ? 1 : 0.4,
    bookingTruthful: finalToolState.bookingConfirmed || !/\b(booked|confirmed|you're all set|see you then)\b/i.test(agentTexts) ? 1 : 0.1,
  };

  const overall = average(Object.values(quality));
  const weak =
    overall >= 0.65 &&
    overall < 0.8 &&
    technicalPass &&
    (naturalNotTemplated < 0.8 || smsConcise < 0.7 || oneQuestionMax < 0.8);
  const conversationalPass = overall >= 0.8 && unsupportedClaims.length === 0 && oneQuestionMax >= 0.6;
  const failed = !technicalPass || overall < 0.65 || unsupportedClaims.length > 0;

  return {
    technicalPass,
    conversationalPass,
    weak,
    failed,
    quality,
    overall,
    unsupportedClaims,
    notes,
  };
}

export function categoryAverage(scores: ScenarioScore[]): number {
  if (scores.length === 0) return 0;
  return average(scores.map((s) => s.overall));
}
