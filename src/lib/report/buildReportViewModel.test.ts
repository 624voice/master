import { describe, expect, test } from "bun:test";
import { computeAllScenarios } from "~/lib/roi/computeRoi";
import { buildReportViewModel } from "~/lib/report/buildReportViewModel";
import {
  buildNorthstarReportViewModel,
  NORTHSTAR_LEAD,
  NORTHSTAR_MONTHLY_CALLS,
  NORTHSTAR_TRADE,
  NORTHSTAR_TRUCK_COUNT,
} from "~/lib/report/__fixtures__/northstar";
import { formatReportDate, formatReportId } from "~/lib/report/formatReportMeta";
import { SHARED, TRADES } from "~/lib/roi/roiModel";
import { SCENARIO_LABELS, SCENARIOS } from "~/lib/roi/scenarioDisplay";
import { TRADE_REPORT_CONTENT } from "~/lib/report/tradeReportContent";
import { formatCurrency } from "~/lib/roi/formatCurrency";

const FIXED_DATE = new Date("2026-03-15T15:00:00.000Z");

describe("buildReportViewModel", () => {
  const scenarios = computeAllScenarios(NORTHSTAR_TRADE, NORTHSTAR_MONTHLY_CALLS);
  const model = buildReportViewModel({
    trade: NORTHSTAR_TRADE,
    truckCount: NORTHSTAR_TRUCK_COUNT,
    monthlyCalls: NORTHSTAR_MONTHLY_CALLS,
    lead: NORTHSTAR_LEAD,
    scenarios,
    reportId: formatReportId(NORTHSTAR_TRADE, NORTHSTAR_MONTHLY_CALLS, FIXED_DATE),
    reportDate: formatReportDate(FIXED_DATE),
  });

  test("northstar fixture derives totals from ROI engine", () => {
    const fixture = buildNorthstarReportViewModel();
    expect(fixture.moderateHeroTotal).toBe(scenarios[1]!.totalAnnualBenefit);
    expect(fixture.moderateHeroTotalFormatted).toBe(
      formatCurrency(scenarios[1]!.totalAnnualBenefit),
    );
  });

  test("includes three scenarios with capture ranges", () => {
    expect(model.scenarios).toHaveLength(3);
    expect(model.scenarios.map((s) => s.name)).toEqual([...SCENARIOS]);
    expect(model.scenarios.map((s) => s.captureRange)).toEqual([...SCENARIO_LABELS]);
  });

  test("includes five drivers with bar percentages capped at 1", () => {
    expect(model.drivers).toHaveLength(5);
    const max = Math.max(...model.drivers.map((d) => d.annualValue));
    for (const driver of model.drivers) {
      expect(driver.barPercent).toBeCloseTo(driver.annualValue / max, 5);
    }
  });

  test("largestDriver matches moderate scenario max driver", () => {
    const moderateDrivers = Object.values(scenarios[1]!.drivers);
    const largest = moderateDrivers.reduce((best, driver) =>
      driver.annualValue > best.annualValue ? driver : best,
    );
    expect(model.largestDriver.label).toBe(largest.label);
    expect(model.largestDriver.annualValue).toBe(largest.annualValue);
  });

  test("scenario assumptions match SHARED and TRADES by index", () => {
    model.scenarioAssumptions.forEach((assumption, index) => {
      expect(assumption.recoveredBookingRate).toBe(
        `${Math.round(SHARED.recoveredBookingRate[index]! * 100)}%`,
      );
      expect(assumption.noShowReduction).toBe(
        `${Math.round(SHARED.noShowReduction[index]! * 100)}%`,
      );
      expect(assumption.upsellRate).toBe(
        `${Math.round(SHARED.upsellRate[index]! * 100)}%`,
      );
      expect(assumption.adminHoursSaved).toBe(`${SHARED.adminHoursSaved[index]} hrs / mo`);
      expect(assumption.campaignJobsPerMonth).toBe(
        `${TRADES[NORTHSTAR_TRADE].campaignJobs[index]} jobs / mo`,
      );
    });
  });

  test("trade content interpolates model values, not hardcoded benchmarks", () => {
    const t = TRADES[NORTHSTAR_TRADE];
    const content = TRADE_REPORT_CONTENT[NORTHSTAR_TRADE];
    const joined = content.blocks.map((b) => `${b.problem} ${b.consequence}`).join(" ");
    expect(joined).toContain(formatCurrency(t.avgJobValue));
    expect(joined).toContain(formatCurrency(t.avgUpsellValue));
    expect(joined).not.toContain("$350");
    expect(joined).not.toContain("3500");
  });
});
