import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssessmentGate } from "~/components/assessment/AssessmentGate";
import { AssessmentProgress } from "~/components/assessment/AssessmentProgress";
import { AssessmentQuestion } from "~/components/assessment/AssessmentQuestion";
import { AssessmentResults } from "~/components/assessment/AssessmentResults";
import { RespondAssumptionsReview } from "~/components/assessment/RespondAssumptionsReview";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { ANALYTICS_EVENTS, trackEvent } from "~/lib/analytics/trackEvent";
import {
  AssessmentEngine,
  type AnswerValue,
  type VisitorRespondEdits,
} from "~/lib/assessment/engine";
import { buildAnswersPayload } from "~/lib/assessment/buildAnswersPayload";
import { runAssessment } from "~/lib/assessment/runAssessment";
import {
  buildQuestionFlow,
  flowStepBack,
  resolveBackQuestionIndex,
} from "~/lib/assessment/assessmentFlowController";
import {
  FOLLOWUP_IDS_BY_DIMENSION,
  QUESTION_BY_ID,
  SCREENING_IDS_BY_DIMENSION,
  type AssessmentDimension,
} from "~/lib/assessment/questions";
import type { FleetSizeRange } from "~/lib/lead/validateLead";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import { selectModerateScenarioValue } from "~/lib/assessment/selectModerateScenario";
import type { TradeKey } from "~/lib/roi/callVolume";
import {
  submitAssessmentLead,
  type AssessmentLeadSuccess,
} from "~/server/submitAssessmentLead";

export const Route = createFileRoute("/assessment")({
  component: AssessmentPage,
});

type FlowStep =
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

function dimensionForScreeningId(questionId: string): AssessmentDimension | null {
  for (const dimension of SCORED_DIMENSIONS) {
    if (SCREENING_IDS_BY_DIMENSION[dimension] === questionId) {
      return dimension;
    }
  }
  return null;
}

function AssessmentPage() {
  const engineRef = useRef(new AssessmentEngine());
  const startedRef = useRef(false);

  const [step, setStep] = useState<FlowStep>("bp1");
  const [trade, setTrade] = useState<TradeKey | "">("");
  const [fleetSize, setFleetSize] = useState<FleetSizeRange | "">("");
  const [respondEdits, setRespondEdits] = useState<VisitorRespondEdits>({});
  const [questionFlow, setQuestionFlow] = useState<string[]>(() =>
    buildQuestionFlow(engineRef.current),
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [teaserResult, setTeaserResult] = useState<ReturnType<
    typeof runAssessment
  > | null>(null);
  const [submitResponse, setSubmitResponse] =
    useState<AssessmentLeadSuccess | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerTick, setAnswerTick] = useState(0);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent(ANALYTICS_EVENTS.assessment_started);
  }, []);

  const currentQuestionId =
    step === "questions" ? questionFlow[questionIndex] : null;

  const currentQuestion =
    currentQuestionId != null ? QUESTION_BY_ID[currentQuestionId] : null;

  const currentAnswer =
    currentQuestionId != null
      ? step === "bp1"
        ? trade
        : step === "bp2"
          ? fleetSize
          : engineRef.current.answers.get(currentQuestionId)
      : undefined;

  const syncQuestionFlow = useCallback(() => {
    setQuestionFlow(buildQuestionFlow(engineRef.current));
  }, []);

  const runLocalAssessment = useCallback(() => {
    if (!trade || !fleetSize) return null;
    return runAssessment(
      buildAnswersPayload(trade, fleetSize, respondEdits, engineRef.current),
    );
  }, [trade, fleetSize, respondEdits]);

  const handleScreeningAnswer = (
    dimension: AssessmentDimension,
    value: AnswerValue,
    previousValue: AnswerValue | undefined,
  ) => {
    const previousFollowUpCount = FOLLOWUP_IDS_BY_DIMENSION[dimension].filter(
      (id) => engineRef.current.activeQuestionIds.has(id),
    ).length;

    if (previousValue !== undefined) {
      engineRef.current.onScreeningChanged(dimension, value);
    } else {
      engineRef.current.onScreeningAnswered(dimension, value);
    }

    const nextFollowUpCount = FOLLOWUP_IDS_BY_DIMENSION[dimension].filter(
      (id) => engineRef.current.activeQuestionIds.has(id),
    ).length;

    if (nextFollowUpCount > previousFollowUpCount) {
      trackEvent(ANALYTICS_EVENTS.assessment_branch_opened, {
        dimension,
        followUpCount: nextFollowUpCount,
      });
    }
  };

  const handleQuestionAnswer = (value: AnswerValue | string) => {
    if (step === "bp1") {
      setTrade(value as TradeKey);
      trackEvent(ANALYTICS_EVENTS.assessment_question_answered, {
        questionId: "BP1",
      });
      setAnswerTick((tick) => tick + 1);
      return;
    }

    if (step === "bp2") {
      setFleetSize(value as FleetSizeRange);
      trackEvent(ANALYTICS_EVENTS.assessment_question_answered, {
        questionId: "BP2",
      });
      setAnswerTick((tick) => tick + 1);
      return;
    }

    if (step !== "questions" || !currentQuestionId) return;

    const previousValue = engineRef.current.answers.get(currentQuestionId);
    const screeningDimension = dimensionForScreeningId(currentQuestionId);

    if (screeningDimension && isAnswerValue(value)) {
      handleScreeningAnswer(
        screeningDimension,
        value,
        previousValue as AnswerValue | undefined,
      );
    } else if (isAnswerValue(value)) {
      engineRef.current.setAnswer(currentQuestionId, value);
    }

    trackEvent(ANALYTICS_EVENTS.assessment_question_answered, {
      questionId: currentQuestionId,
    });
    syncQuestionFlow();
    setAnswerTick((tick) => tick + 1);
  };

  const canContinue = (): boolean => {
    void answerTick;
    if (step === "bp1") return trade !== "";
    if (step === "bp2") return fleetSize !== "";
    if (step === "respond") return trade !== "" && fleetSize !== "";
    if (step === "questions" && currentQuestionId) {
      const answer = engineRef.current.answers.get(currentQuestionId);
      return answer !== undefined;
    }
    return true;
  };

  const handleBack = () => {
    setError(null);
    const previous = flowStepBack(step, questionIndex);
    if (!previous) return;
    if (previous.step === "questions") {
      setQuestionFlow(buildQuestionFlow(engineRef.current));
      setQuestionIndex(
        resolveBackQuestionIndex(engineRef.current, previous.questionIndex),
      );
    }
    setStep(previous.step);
  };

  const handleContinue = () => {
    setError(null);

    if (step === "bp1") {
      setStep("bp2");
      return;
    }

    if (step === "bp2") {
      setStep("respond");
      return;
    }

    if (step === "respond") {
      setQuestionIndex(0);
      syncQuestionFlow();
      setStep("questions");
      return;
    }

    if (step === "questions") {
      const nextIndex = questionIndex + 1;
      const updatedFlow = buildQuestionFlow(engineRef.current);
      setQuestionFlow(updatedFlow);

      if (nextIndex < updatedFlow.length) {
        setQuestionIndex(nextIndex);
        return;
      }

      const preview = runLocalAssessment();
      setTeaserResult(preview);
      trackEvent(ANALYTICS_EVENTS.assessment_teaser_viewed, {
        hasEstimate: preview?.dollarEstimate ? "true" : "false",
      });
      setStep("teaser");
      return;
    }

    if (step === "teaser") {
      setStep("gate");
    }
  };

  const handleGateSubmit = async (
    lead: Parameters<typeof submitAssessmentLead>[0]["data"]["lead"],
    smsConsent: boolean,
  ) => {
    if (!trade || !fleetSize) return;

    setLoading(true);
    setError(null);

    try {
      const response = await submitAssessmentLead({
        data: {
          lead,
          smsConsent,
          idempotencyKey: crypto.randomUUID(),
          answers: buildAnswersPayload(
            trade,
            fleetSize,
            respondEdits,
            engineRef.current,
          ),
        },
      });
      setSubmitResponse(response);
      setStep("results");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not submit your assessment. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const results = submitResponse?.results ?? teaserResult;
  const progressQuestionId =
    step === "respond"
      ? "respond"
      : step === "questions" && currentQuestionId
        ? currentQuestionId
        : null;

  const teaserModerate =
    teaserResult?.dollarEstimate &&
    selectModerateScenarioValue(teaserResult.dollarEstimate);

  const topPriority = teaserResult?.priorityGroups[0];

  const bp1Question = QUESTION_BY_ID.BP1!;
  const bp2Question = QUESTION_BY_ID.BP2!;

  return (
    <main className="pt-20">
      <section className="bg-brand-secondary px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            Business Assessment
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Find Your{" "}
            <span className="text-brand-primary">Top Priorities</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-300">
            Six areas where home-service businesses leak revenue and time — ranked
            for your trade and fleet size in a few minutes.
          </p>
        </div>
      </section>

      <section className="bg-brand-accent-light px-6 py-16 sm:py-24">
        <Card className="mx-auto max-w-3xl">
          {step === "results" && results ? (
            <AssessmentResults
              results={results}
              reportUrl={submitResponse?.reportUrl}
              onReportDownload={() =>
                trackEvent(ANALYTICS_EVENTS.assessment_report_downloaded, {
                  source: "assessment",
                })
              }
            />
          ) : (
            <div className="space-y-8">
              {progressQuestionId && (
                <AssessmentProgress questionId={progressQuestionId} />
              )}

              {step === "bp1" && (
                <AssessmentQuestion
                  question={bp1Question}
                  value={trade}
                  onChange={handleQuestionAnswer}
                />
              )}

              {step === "bp2" && (
                <AssessmentQuestion
                  question={bp2Question}
                  value={fleetSize}
                  onChange={handleQuestionAnswer}
                />
              )}

              {step === "respond" && trade && fleetSize && (
                <RespondAssumptionsReview
                  trade={trade}
                  fleetSize={fleetSize}
                  edits={respondEdits}
                  onChange={setRespondEdits}
                />
              )}

              {step === "questions" && currentQuestion && (
                <AssessmentQuestion
                  question={currentQuestion}
                  value={currentAnswer}
                  onChange={handleQuestionAnswer}
                />
              )}

              {step === "teaser" && teaserResult && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-brand-primary/30 bg-emerald-50/60 p-8 text-center">
                    <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent">
                      Your top priority
                    </p>
                    {topPriority && topPriority.length > 0 ? (
                      <>
                        <p className="mt-3 text-2xl font-bold text-brand-secondary">
                          {topPriority.map((d) => d.label).join(" · ")}
                        </p>
                        {topPriority[0]?.band && (
                          <p className="mt-2 text-sm text-gray-600">
                            Severity: {topPriority[0].band}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-3 text-lg text-brand-secondary">
                        Complete the lead form to see your full ranked results.
                      </p>
                    )}
                    {teaserModerate != null && (
                      <p className="mt-4 text-sm text-gray-600">
                        Estimated annual opportunity up to{" "}
                        <span className="font-semibold text-brand-primary">
                          {formatCurrency(teaserModerate)}
                        </span>
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Unlock your full breakdown — ranked priorities, areas worth
                    clarifying, and a downloadable report.
                  </p>
                </div>
              )}

              {step === "gate" && (
                <AssessmentGate loading={loading} onSubmit={handleGateSubmit} />
              )}

              {step !== "gate" && step !== "teaser" && step !== "results" && (
                <div className="flex flex-wrap gap-3">
                  {step !== "bp1" && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleBack}
                      className="w-full sm:w-auto"
                    >
                      Back
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleContinue}
                    disabled={!canContinue()}
                    className="w-full sm:w-auto"
                  >
                    Continue
                  </Button>
                </div>
              )}

              {step === "teaser" && (
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleBack}
                    className="w-full sm:w-auto"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleContinue}
                    className="w-full sm:w-auto"
                  >
                    Unlock Full Results
                  </Button>
                </div>
              )}

              {step === "gate" && (
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleBack}
                    className="w-full sm:w-auto"
                  >
                    Back
                  </Button>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              {submitResponse?.message && step !== "results" && (
                <p className="text-sm text-amber-700" role="status">
                  {submitResponse.message}
                </p>
              )}
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}

function isAnswerValue(value: AnswerValue | string): value is AnswerValue {
  return (
    value === "not_sure" ||
    value === 0 ||
    value === 1 ||
    value === 2 ||
    value === 3
  );
}
