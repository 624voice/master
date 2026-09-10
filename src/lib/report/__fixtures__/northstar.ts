import type { LeadInfo } from "~/lib/lead/validateLead";
import { computeAllScenarios } from "~/lib/roi/computeRoi";
import { buildReportViewModel } from "~/lib/report/buildReportViewModel";
import { formatReportDate, formatReportId } from "~/lib/report/formatReportMeta";

export const NORTHSTAR_LEAD: LeadInfo = {
  firstName: "Jordan",
  lastName: "Miller",
  businessName: "Northstar Pest Control",
  email: "jordan.miller@northstarpest.example",
  phone: "(555) 555-0101",
};

export const NORTHSTAR_TRADE = "PestControl" as const;
export const NORTHSTAR_TRUCK_COUNT = 15;
export const NORTHSTAR_MONTHLY_CALLS = 525;
export const NORTHSTAR_REPORT_DATE = new Date("2026-03-15T15:00:00.000Z");
export const NORTHSTAR_REPORT_ID = formatReportId(
  NORTHSTAR_TRADE,
  NORTHSTAR_MONTHLY_CALLS,
  NORTHSTAR_REPORT_DATE,
);

export function buildNorthstarReportViewModel() {
  const scenarios = computeAllScenarios(NORTHSTAR_TRADE, NORTHSTAR_MONTHLY_CALLS);
  return buildReportViewModel({
    trade: NORTHSTAR_TRADE,
    truckCount: NORTHSTAR_TRUCK_COUNT,
    monthlyCalls: NORTHSTAR_MONTHLY_CALLS,
    lead: NORTHSTAR_LEAD,
    scenarios,
    reportId: NORTHSTAR_REPORT_ID,
    reportDate: formatReportDate(NORTHSTAR_REPORT_DATE),
  });
}
