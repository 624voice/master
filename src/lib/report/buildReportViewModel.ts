import type { LeadInfo } from "~/lib/lead/validateLead";
import { BOOK_MEETING_PATH, SITE_ORIGIN } from "~/config/features";
import { formatPreparedForLine } from "~/lib/report/formatProspectLines";
import type { RoiResult } from "~/lib/roi/computeRoi";
import {
  getSlippingAwayAnnual,
  getUntappedUpsideAnnual,
  getAssumptionLines,
  AUDIT_NOTES,
} from "~/lib/roi/formatAssumptions";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import { SCENARIO_LABELS, SCENARIOS } from "~/lib/roi/scenarioDisplay";
import { SHARED, TRADES, type TradeKey } from "~/lib/roi/roiModel";
import {
  CTA_BUTTON,
  CTA_FINE_PRINT,
  CTA_HEADLINE,
  CTA_HIGHLIGHTS,
  CTA_SUB,
  GUARANTEE_BODY,
  GUARANTEE_FOOTNOTE,
  REPORT_FOOTER_EMAIL,
  REPORT_FOOTER_SITE,
} from "~/lib/report/reportCopy";
import { TRADE_REPORT_CONTENT } from "~/lib/report/tradeReportContent";
import type {
  ReportDriverView,
  ReportViewModel,
  ScenarioAssumptionView,
} from "~/lib/report/types";

const DRIVER_ORDER = [
  "missedCallRecovery",
  "noShowReduction",
  "outboundSms",
  "jobCloserUpsells",
  "timeSavings",
] as const;

function formatDriverMonthlyVolume(key: (typeof DRIVER_ORDER)[number], units: number): string {
  switch (key) {
    case "missedCallRecovery":
      return `${units} booked jobs / mo`;
    case "noShowReduction":
      return `${units} appts saved / mo`;
    case "outboundSms":
      return `${units} new jobs / mo`;
    case "jobCloserUpsells":
      return `${units} upsell jobs / mo`;
    case "timeSavings":
      return `${units} admin hrs / mo`;
  }
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`.replace(/\.0%$/, "%");
}

function buildScenarioAssumption(
  index: 0 | 1 | 2,
  trade: TradeKey,
): ScenarioAssumptionView {
  return {
    name: SCENARIOS[index]!,
    recoveredBookingRate: formatPercent(SHARED.recoveredBookingRate[index]),
    noShowReduction: formatPercent(SHARED.noShowReduction[index]),
    upsellRate: formatPercent(SHARED.upsellRate[index]),
    adminHoursSaved: `${SHARED.adminHoursSaved[index]} hrs / mo`,
    campaignJobsPerMonth: `${TRADES[trade].campaignJobs[index]} jobs / mo`,
  };
}

export function buildReportViewModel(input: {
  trade: TradeKey;
  truckCount: number;
  monthlyCalls: number;
  lead: LeadInfo;
  scenarios: RoiResult[];
  reportId: string;
  reportDate: string;
}): ReportViewModel {
  const { trade, truckCount, monthlyCalls, lead, scenarios, reportId, reportDate } =
    input;
  const tradeLabel = TRADES[trade].label;
  const moderate = scenarios[1]!;

  const drivers: ReportDriverView[] = DRIVER_ORDER.map((key) => {
    const driver = moderate.drivers[key];
    return {
      key,
      label: driver.label,
      monthlyUnits: driver.monthlyUnits,
      monthlyVolume: formatDriverMonthlyVolume(key, driver.monthlyUnits),
      annualValue: driver.annualValue,
      annualValueFormatted: formatCurrency(driver.annualValue),
      barPercent: 0,
    };
  });

  const maxAnnual = Math.max(...drivers.map((d) => d.annualValue), 1);
  for (const driver of drivers) {
    driver.barPercent = driver.annualValue / maxAnnual;
  }

  const largest = drivers.reduce((best, driver) =>
    driver.annualValue > best.annualValue ? driver : best,
  );

  const scenarioViews = scenarios.map((result, index) => ({
    name: SCENARIOS[index]!,
    captureRange: SCENARIO_LABELS[index]!,
    total: result.totalAnnualBenefit,
    totalFormatted: formatCurrency(result.totalAnnualBenefit),
    slippingAway: getSlippingAwayAnnual(result.drivers),
    slippingAwayFormatted: formatCurrency(getSlippingAwayAnnual(result.drivers)),
    upside: getUntappedUpsideAnnual(result.drivers),
    upsideFormatted: formatCurrency(getUntappedUpsideAnnual(result.drivers)),
  })) as ReportViewModel["scenarios"];

  return {
    metadata: {
      reportId,
      reportDate,
      footerEmail: REPORT_FOOTER_EMAIL,
      footerSite: REPORT_FOOTER_SITE,
    },
    prospect: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      businessName: lead.businessName,
      email: lead.email,
      phone: lead.phone,
      preparedForLine: formatPreparedForLine(lead),
    },
    operation: {
      trade,
      tradeLabel,
      truckCount,
      monthlyCalls,
      contextLine: `${tradeLabel} · ${truckCount} trucks · ${monthlyCalls.toLocaleString("en-US")} calls / mo`,
    },
    scenarios: scenarioViews,
    moderateHeroTotal: moderate.totalAnnualBenefit,
    moderateHeroTotalFormatted: formatCurrency(moderate.totalAnnualBenefit),
    drivers: drivers as ReportViewModel["drivers"],
    largestDriver: {
      label: largest.label,
      annualValue: largest.annualValue,
      annualValueFormatted: largest.annualValueFormatted,
    },
    scenarioAssumptions: [
      buildScenarioAssumption(0, trade),
      buildScenarioAssumption(1, trade),
      buildScenarioAssumption(2, trade),
    ],
    tradeAssumptions: getAssumptionLines(trade),
    noDoubleCountingNotes: AUDIT_NOTES,
    tradeContent: TRADE_REPORT_CONTENT[trade],
    guarantee: {
      body: GUARANTEE_BODY,
      footnote: GUARANTEE_FOOTNOTE,
    },
    cta: {
      headline: CTA_HEADLINE,
      body: CTA_SUB,
      buttonLabel: CTA_BUTTON,
      finePrint: CTA_FINE_PRINT,
      highlights: [...CTA_HIGHLIGHTS],
      url: `${SITE_ORIGIN}${BOOK_MEETING_PATH}`,
    },
  };
}
