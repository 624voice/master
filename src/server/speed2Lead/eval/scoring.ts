import { validateOutboundSms } from "~/server/speed2Lead/guardrails";
import { isGenericAcknowledgment } from "~/server/speed2Lead/conversationDisposition";
import {
  hasKnownSchedulingDay,
  hasKnownSchedulingPartOfDay,
} from "~/server/speed2Lead/schedulingContext";
import {
  collectSchedulingEvidence,
  schedulingOfferEvidenceMet,
  type SchedulingEvidence,
} from "~/server/speed2Lead/eval/authoritativeState";
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
  mustNotReopenAfterSoftClose?: boolean;
  mustPreserveSchedulingConstraints?: boolean;
  maxDiscoveryTurns?: number;
  maxQuestionsPerTurn?: number;
  mustAcknowledgeFeedback?: boolean;
  mustNotBeAggressive?: boolean;
  customerGoalKeywords?: string[];
  forbiddenPatterns?: RegExp[];
  /** Scheduling scenarios must persist normalized date + daypart in session state. */
  requireNormalizedSchedulingFacts?: boolean;
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

export type EvalFailureClass =
  | "model_judgment"
  | "deterministic_orchestration"
  | "eval_harness"
  | "scoring_expectation"
  | "expected_clarification";

export type ScenarioScore = {
  technicalPass: boolean;
  conversationalPass: boolean;
  weak: boolean;
  failed: boolean;
  failureClass?: EvalFailureClass;
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
  let failureClass: EvalFailureClass | undefined;
  const agentTexts = transcript.map((t) => t.agent).join("\n");
  const unsupportedClaims = detectUnsupportedClaims(transcript);
  const schedulingEvidence = collectSchedulingEvidence(
    finalContext,
    toolStatesByTurn ?? [finalToolState],
  );
  const authoritativeState = schedulingEvidence.finalState;

  let technicalPass = transcript.every((t) => t.handled);
  if (expectations.shouldConfirmBooking && !authoritativeState.bookingConfirmed) {
    technicalPass = false;
    failureClass = "deterministic_orchestration";
    notes.push("Expected successful booking but bookingConfirmed is false");
  }
  if (expectations.mustNotConfirmBooking && authoritativeState.bookingConfirmed) {
    technicalPass = false;
    failureClass = "deterministic_orchestration";
    notes.push("Booking was confirmed when it should not have been");
  }
  if (expectations.shouldOfferSlots && !schedulingOfferEvidenceMet(schedulingEvidence)) {
    technicalPass = false;
    failureClass = "deterministic_orchestration";
    notes.push("Expected offered slots but none were recorded in authoritative session state");
  }

  if (expectations.mustNotReopenAfterSoftClose) {
    const schedulingAfterSoftClose =
      /\b(what day works|morning or afternoon|grab a time|schedule a call|set up a quick call|find a time)\b/i;
    const softCloseIndex = transcript.findIndex((t) =>
      /\b(busy|not right now|not now|not ready)\b/i.test(t.customer),
    );
    if (softCloseIndex >= 0) {
      const after = transcript.slice(softCloseIndex + 1);
      const genericAck = after.find((t) => isGenericAcknowledgment(t.customer));
      if (genericAck && schedulingAfterSoftClose.test(genericAck.agent)) {
        technicalPass = false;
        failureClass = "deterministic_orchestration";
        notes.push("Reopened scheduling after soft close on generic acknowledgment");
      }
    }
  }

  if (expectations.maxDiscoveryTurns !== undefined) {
    const discoveryQuestions = transcript.filter((t) =>
      /\?\s*$/.test(t.agent) && !/\b(morning or afternoon|what day|which works|does that work)\b/i.test(t.agent),
    ).length;
    if (discoveryQuestions > expectations.maxDiscoveryTurns) {
      notes.push(`Too many discovery questions: ${discoveryQuestions} > ${expectations.maxDiscoveryTurns}`);
    }
  }

  for (const [index, turn] of transcript.entries()) {
    const turnToolState = toolStatesByTurn?.[index] ?? finalToolState;
    const explicitCalendarLinkRequest =
      /\b(calendar link|scheduling link|send (?:me )?(?:the )?link)\b/i.test(turn.customer);
    const calendarLinkAllowed =
      explicitCalendarLinkRequest ||
      (expectations.shouldIncludeCalendarLink === true &&
        Boolean(finalContext.bookingUrl) &&
        turn.agent.includes(finalContext.bookingUrl!));
    const guard = validateOutboundSms(turn.agent, {
      session: finalContext,
      toolState: turnToolState,
      calendarLinkAllowed,
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

  if (expectations.requireNormalizedSchedulingFacts) {
    const hasFacts =
      hasKnownSchedulingDay(finalContext.scheduling) &&
      (hasKnownSchedulingPartOfDay(finalContext.scheduling) ||
        finalContext.scheduling?.anchorTimeMinutes != null);
    if (!hasFacts) {
      technicalPass = false;
      failureClass = "deterministic_orchestration";
      notes.push(
        `Missing normalized scheduling facts: centralDate=${finalContext.scheduling?.centralDate ?? "none"} partOfDay=${finalContext.scheduling?.partOfDay ?? "none"} anchor=${finalContext.scheduling?.anchorTimeMinutes ?? "none"}`,
      );
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
    skippedUnneededDiscovery: expectations.maxDiscoveryTurns
      ? transcript.filter((t) => t.agent.includes("?")).length <= expectations.maxDiscoveryTurns + 1
        ? 1
        : 0.4
      : expectations.shouldReachScheduling
        ? 0.85
        : 0.75,
    pacedWeakInterest: expectations.mustNotBeAggressive ? (agentTexts.match(/calendar|book|schedule/gi) ?? []).length > 2 ? 0.5 : 0.9 : 0.8,
    efficientStrongInterest: expectations.shouldReachScheduling
      ? schedulingOfferEvidenceMet(schedulingEvidence) ||
        /calendar|time|slot|tuesday|thursday|tomorrow/i.test(agentTexts)
        ? 1
        : 0.5
      : 0.75,
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
      schedulingOfferEvidenceMet(schedulingEvidence) ||
      !/\b\d{1,2}:\d{2}\s*(am|pm)\b/i.test(agentTexts)
        ? 1
        : 0.4,
    bookingTruthful:
      authoritativeState.bookingConfirmed ||
      !/\b(booked|confirmed|you're all set|see you then)\b/i.test(agentTexts)
        ? 1
        : 0.1,
  };

  const overall = average(Object.values(quality));
  const weak =
    overall >= 0.65 &&
    overall < 0.8 &&
    technicalPass &&
    (naturalNotTemplated < 0.8 || smsConcise < 0.7 || oneQuestionMax < 0.8);
  if (expectations.mustAcknowledgeFeedback && !/\b(got it|understand|fair|helpful|feedback|custom|demo|jessica|configured)\b/i.test(agentTexts.toLowerCase())) {
    // handled in liveEval.test.ts as weak conversational signal
  }

  const conversationalPass = overall >= 0.8 && unsupportedClaims.length === 0 && oneQuestionMax >= 0.6;
  const failed = !technicalPass || overall < 0.65 || unsupportedClaims.length > 0;
  if (failed && !failureClass) {
    if (!technicalPass && unsupportedClaims.length > 0) {
      failureClass = "model_judgment";
    } else if (!technicalPass) {
      failureClass = "model_judgment";
    } else if (overall < 0.65) {
      failureClass = "model_judgment";
    }
  }

  return {
    technicalPass,
    conversationalPass,
    weak,
    failed,
    failureClass,
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
