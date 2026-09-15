import type { RunAssessmentResult } from "~/lib/assessment/runAssessment";
import type { LeadInfo } from "~/lib/lead/validateLead";

export type AssessmentReportSnapshot = RunAssessmentResult & {
  lead: LeadInfo;
  reportGeneratedAt: string;
};

export type AssessmentIdempotencyCase = "a" | "b" | "c" | "d";

export type AssessmentReplaySubstate =
  | "fresh"
  | "replay_exact"
  | "replay_stale"
  | "replay_conflict"
  | "in_progress"
  | "completed"
  | "retryable_failure"
  | "stale_lease";

export type AssessmentIdempotencyResult = {
  case: AssessmentIdempotencyCase;
  substate: AssessmentReplaySubstate;
  allowed: boolean;
  count: number;
  cachedResponse?: string;
};

export type AssessmentReportTokenData = {
  snapshot: AssessmentReportSnapshot;
};
