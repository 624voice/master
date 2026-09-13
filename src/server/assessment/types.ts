import type { LeadInfo } from "~/lib/lead/validateLead";
import type { RoiResult } from "~/lib/roi/computeRoi";
import type { TradeKey } from "~/lib/roi/roiModel";

export type AssessmentReportSnapshot = {
  trade: TradeKey;
  truckCount: number;
  monthlyCalls: number;
  lead: LeadInfo;
  websiteOption: "has" | "none";
  website?: string;
  scenarios: RoiResult[];
  moderateAnnualBenefit: number;
  primaryOpportunity: string;
  reportGeneratedAt: string;
};

export type AssessmentIdempotencyCase = "a" | "b" | "c" | "d";

export type AssessmentReplaySubstate =
  | "fresh"
  | "replay_exact"
  | "replay_stale"
  | "replay_conflict";

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
