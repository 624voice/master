import type { AssessmentEngine, VisitorRespondEdits } from "~/lib/assessment/engine";
import type { AssessmentAnswerMap } from "~/lib/assessment/runAssessment";
import type { FleetSizeRange, TradeKey } from "~/lib/lead/validateLead";

export function buildAnswersPayload(
  trade: TradeKey,
  fleetSize: FleetSizeRange,
  respondEdits: VisitorRespondEdits,
  engine: AssessmentEngine,
): AssessmentAnswerMap {
  const payload: AssessmentAnswerMap = {
    BP1: trade,
    BP2: fleetSize,
    trade,
    fleetSize,
  };

  if (respondEdits.monthlyCalls !== undefined) {
    payload.R1 = respondEdits.monthlyCalls;
  }
  if (respondEdits.missedCallRatePct !== undefined) {
    payload.R2 = respondEdits.missedCallRatePct;
  }
  if (respondEdits.avgJobValue !== undefined) {
    payload.R3 = respondEdits.avgJobValue;
  }

  for (const questionId of engine.getActiveQuestionIds()) {
    if (questionId === "BP1" || questionId === "BP2") continue;
    if (questionId === "R1" || questionId === "R2" || questionId === "R3") continue;
    const answer = engine.answers.get(questionId);
    if (answer !== undefined) {
      payload[questionId] = answer;
    }
  }

  return payload;
}
