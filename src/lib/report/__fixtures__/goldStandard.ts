import type { LeadInfo } from "~/lib/lead/validateLead";
import { computeAllScenarios } from "~/lib/roi/computeRoi";
import { buildReportViewModel } from "~/lib/report/buildReportViewModel";
import { formatReportDate, formatReportId } from "~/lib/report/formatReportMeta";

export const GOLD_STANDARD_LEAD: LeadInfo = {
  firstName: "Chris",
  lastName: "Hutson",
  businessName: "624 Plumbing",
  email: "chris.hutson@624plumbing.example",
  phone: "(555) 555-0199",
};

export const GOLD_STANDARD_TRADE = "Plumbers" as const;
export const GOLD_STANDARD_TRUCK_COUNT = 15;
export const GOLD_STANDARD_MONTHLY_CALLS = 900;
export const GOLD_STANDARD_REPORT_DATE = new Date("2026-09-09T15:00:00.000Z");
export const GOLD_STANDARD_REPORT_ID = formatReportId(
  GOLD_STANDARD_TRADE,
  GOLD_STANDARD_MONTHLY_CALLS,
  GOLD_STANDARD_REPORT_DATE,
);

export function buildGoldStandardReportViewModel() {
  const scenarios = computeAllScenarios(
    GOLD_STANDARD_TRADE,
    GOLD_STANDARD_MONTHLY_CALLS,
  );
  return buildReportViewModel({
    trade: GOLD_STANDARD_TRADE,
    truckCount: GOLD_STANDARD_TRUCK_COUNT,
    monthlyCalls: GOLD_STANDARD_MONTHLY_CALLS,
    lead: GOLD_STANDARD_LEAD,
    scenarios,
    reportId: GOLD_STANDARD_REPORT_ID,
    reportDate: formatReportDate(GOLD_STANDARD_REPORT_DATE),
  });
}

/** Instruction #9 expected values for the gold-standard Plumbers fixture. */
export const GOLD_STANDARD_EXPECTED = {
  moderateTotal: "$455,983",
  conservativeTotal: "$267,160",
  aggressiveTotal: "$644,806",
  missedCallRecoveryConservative: "$170,925",
  missedCallRecoveryModerate: "$284,875",
  missedCallRecoveryAggressive: "$398,825",
  noShowReduction: "$85,447",
  jobCloserUpsells: "$50,861",
  outboundSms: "$16,800",
  timeSavings: "$18,000",
  recoveredBookingRates: ["14.4%", "23.9%", "33.5%"],
} as const;
