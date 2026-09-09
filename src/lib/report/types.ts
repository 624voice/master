import type { TradeKey } from "~/lib/roi/roiModel";

export type ReportScenarioView = {
  name: string;
  captureRange: string;
  total: number;
  totalFormatted: string;
  slippingAway: number;
  slippingAwayFormatted: string;
  upside: number;
  upsideFormatted: string;
};

export type ReportDriverView = {
  key: string;
  label: string;
  monthlyUnits: number;
  monthlyVolume: string;
  annualValue: number;
  annualValueFormatted: string;
  barPercent: number;
};

export type ScenarioAssumptionView = {
  name: string;
  recoveredBookingRate: string;
  noShowReduction: string;
  upsellRate: string;
  adminHoursSaved: string;
  campaignJobsPerMonth: string;
};

export type TradeDiagnosticBlock = {
  title: string;
  problem: string;
  consequence: string;
  response: string;
};

export type TradeReportContent = {
  blocks: TradeDiagnosticBlock[];
};

export type ReportViewModel = {
  metadata: {
    reportId: string;
    reportDate: string;
    footerEmail: string;
    footerSite: string;
  };
  prospect: {
    firstName: string;
    lastName: string;
    businessName: string;
    email: string;
    phone: string;
    preparedForLine: string;
  };
  operation: {
    trade: TradeKey;
    tradeLabel: string;
    truckCount: number;
    monthlyCalls: number;
    contextLine: string;
  };
  scenarios: [ReportScenarioView, ReportScenarioView, ReportScenarioView];
  moderateHeroTotal: number;
  moderateHeroTotalFormatted: string;
  drivers: [
    ReportDriverView,
    ReportDriverView,
    ReportDriverView,
    ReportDriverView,
    ReportDriverView,
  ];
  largestDriver: {
    label: string;
    annualValue: number;
    annualValueFormatted: string;
  };
  scenarioAssumptions: [
    ScenarioAssumptionView,
    ScenarioAssumptionView,
    ScenarioAssumptionView,
  ];
  tradeAssumptions: string[];
  noDoubleCountingNotes: readonly string[];
  tradeContent: TradeReportContent;
  guarantee: {
    body: string;
    footnote: string;
  };
  cta: {
    headline: string;
    body: string;
    url: string;
  };
};
