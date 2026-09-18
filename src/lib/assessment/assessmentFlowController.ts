import type { AssessmentEngine } from "./engine";
import {
  FOLLOWUP_IDS_BY_DIMENSION,
  SCREENING_IDS_BY_DIMENSION,
  type AssessmentDimension,
} from "./questions";

export type FlowStep =
  | "bp1"
  | "bp2"
  | "respond"
  | "questions"
  | "teaser"
  | "gate"
  | "results";

const SCORED_DIMENSIONS: AssessmentDimension[] = [
  "GF",
  "CV",
  "RG",
  "RM",
  "MI",
];

export function buildQuestionFlow(engine: AssessmentEngine): string[] {
  const flow: string[] = [];
  for (const dimension of SCORED_DIMENSIONS) {
    flow.push(SCREENING_IDS_BY_DIMENSION[dimension]);
    for (const followUpId of FOLLOWUP_IDS_BY_DIMENSION[dimension]) {
      if (engine.activeQuestionIds.has(followUpId)) {
        flow.push(followUpId);
      }
    }
  }
  return flow;
}

export function flowStepBack(
  step: FlowStep,
  questionIndex: number,
): { step: FlowStep; questionIndex: number } | null {
  if (step === "results") return null;
  if (step === "bp1") return null;

  if (step === "bp2") return { step: "bp1", questionIndex: 0 };
  if (step === "respond") return { step: "bp2", questionIndex: 0 };
  if (step === "questions") {
    if (questionIndex > 0) {
      return { step: "questions", questionIndex: questionIndex - 1 };
    }
    return { step: "respond", questionIndex: 0 };
  }
  if (step === "teaser") {
    return { step: "questions", questionIndex: Number.MAX_SAFE_INTEGER };
  }
  if (step === "gate") return { step: "teaser", questionIndex: 0 };
  return null;
}

export function resolveBackQuestionIndex(
  engine: AssessmentEngine,
  requestedIndex: number,
): number {
  const flow = buildQuestionFlow(engine);
  if (requestedIndex === Number.MAX_SAFE_INTEGER) {
    return Math.max(0, flow.length - 1);
  }
  return Math.min(requestedIndex, Math.max(0, flow.length - 1));
}

export const UNIVERSAL_FORWARD_STEPS: FlowStep[] = [
  "bp1",
  "bp2",
  "respond",
  "questions",
  "teaser",
  "gate",
  "results",
];
