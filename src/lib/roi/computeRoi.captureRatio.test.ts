import { describe, expect, test } from "bun:test";
import { PDFParse } from "pdf-parse";
import { computeAllScenarios, computeRoi } from "~/lib/roi/computeRoi";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import {
  buildGoldStandardReportViewModel,
  GOLD_STANDARD_EXPECTED,
  GOLD_STANDARD_MONTHLY_CALLS,
  GOLD_STANDARD_TRADE,
} from "~/lib/report/__fixtures__/goldStandard";
import {
  effectiveRecoveredBookingRate,
  getTradeKeys,
  SHARED,
  TRADES,
  type TradeKey,
} from "~/lib/roi/roiModel";
import { buildReportViewModel } from "~/lib/report/buildReportViewModel";
import { renderReportPdf } from "~/server/report/renderReportPdf.server";
import { NORTHSTAR_LEAD } from "~/lib/report/__fixtures__/northstar";
import { formatReportDate, formatReportId } from "~/lib/report/formatReportMeta";

const MODERATE_EFFECTIVE_RATES: Record<TradeKey, number> = {
  PestControl: 0.28275,
  HVAC: 0.261,
  Plumbers: 0.23925,
  Electricians: 0.2175,
  Roofers: 0.15225,
};

const ROOFERS_200_EXPECTED = {
  missedCallRecovery: 447_615,
  conservativeTotal: 387_819,
  moderateTotal: 667_005,
  aggressiveTotal: 946_191,
} as const;

function sumDrivers(result: ReturnType<typeof computeRoi>) {
  return (
    result.drivers.missedCallRecovery.annualValue +
    result.drivers.noShowReduction.annualValue +
    result.drivers.outboundSms.annualValue +
    result.drivers.jobCloserUpsells.annualValue +
    result.drivers.timeSavings.annualValue
  );
}

describe("recoveredCallCaptureRatio model correction", () => {
  test("frozen array is implemented verbatim", () => {
    expect(SHARED.recoveredCallCaptureRatio).toEqual([0.261, 0.435, 0.609]);
    expect("recoveredBookingRate" in SHARED).toBe(false);
  });

  test("per-trade effective moderate recovery rates match B3 table", () => {
    for (const trade of getTradeKeys()) {
      const actual = effectiveRecoveredBookingRate(trade, 1);
      expect(actual).toBeCloseTo(MODERATE_EFFECTIVE_RATES[trade], 5);
    }
  });

  test("Roofers 200 calls/month scenario totals match B3 expected outcomes", () => {
    const scenarios = computeAllScenarios("Roofers", 200);
    expect(scenarios[1]!.drivers.missedCallRecovery.annualValue).toBe(
      ROOFERS_200_EXPECTED.missedCallRecovery,
    );
    expect(scenarios[0]!.totalAnnualBenefit).toBe(ROOFERS_200_EXPECTED.conservativeTotal);
    expect(scenarios[1]!.totalAnnualBenefit).toBe(ROOFERS_200_EXPECTED.moderateTotal);
    expect(scenarios[2]!.totalAnnualBenefit).toBe(ROOFERS_200_EXPECTED.aggressiveTotal);

    expect(scenarios[1]!.drivers.noShowReduction.annualValue).toBe(76_440);
    expect(scenarios[1]!.drivers.jobCloserUpsells.annualValue).toBe(40_950);
    expect(scenarios[1]!.drivers.outboundSms.annualValue).toBe(84_000);
    expect(scenarios[1]!.drivers.timeSavings.annualValue).toBe(18_000);
  });

  test("gold-standard Plumbers fixture matches all six B3 expected values", () => {
    const scenarios = computeAllScenarios(GOLD_STANDARD_TRADE, GOLD_STANDARD_MONTHLY_CALLS);
    expect(formatCurrency(scenarios[0]!.totalAnnualBenefit)).toBe(
      GOLD_STANDARD_EXPECTED.conservativeTotal,
    );
    expect(formatCurrency(scenarios[1]!.totalAnnualBenefit)).toBe(
      GOLD_STANDARD_EXPECTED.moderateTotal,
    );
    expect(formatCurrency(scenarios[2]!.totalAnnualBenefit)).toBe(
      GOLD_STANDARD_EXPECTED.aggressiveTotal,
    );
    expect(formatCurrency(scenarios[0]!.drivers.missedCallRecovery.annualValue)).toBe(
      GOLD_STANDARD_EXPECTED.missedCallRecoveryConservative,
    );
    expect(formatCurrency(scenarios[1]!.drivers.missedCallRecovery.annualValue)).toBe(
      GOLD_STANDARD_EXPECTED.missedCallRecoveryModerate,
    );
    expect(formatCurrency(scenarios[2]!.drivers.missedCallRecovery.annualValue)).toBe(
      GOLD_STANDARD_EXPECTED.missedCallRecoveryAggressive,
    );
  });

  test("scenario cards expose trade-specific recovered booking rates, not 15/25/35", () => {
    const model = buildGoldStandardReportViewModel();
    expect(model.scenarioAssumptions.map((a) => a.recoveredBookingRate)).toEqual([
      ...GOLD_STANDARD_EXPECTED.recoveredBookingRates,
    ]);
    for (const assumption of model.scenarioAssumptions) {
      expect(assumption.recoveredBookingRate).not.toBe("15%");
      expect(assumption.recoveredBookingRate).not.toBe("25%");
      expect(assumption.recoveredBookingRate).not.toBe("35%");
    }
  });

  test("driver totals reconcile to scenario totals for every trade", () => {
    for (const trade of getTradeKeys()) {
      const calls = TRADES[trade].callsPerTruckPerMonth * 10;
      for (const scenarioIndex of [0, 1, 2] as const) {
        const result = computeRoi(trade, calls, scenarioIndex);
        expect(sumDrivers(result)).toBe(result.totalAnnualBenefit);
      }
    }
  });

  test("no-double-counting pool separation remains intact", () => {
    const moderate = computeRoi("Plumbers", 900, 1);
    const answeredPool = 900 * (1 - TRADES.Plumbers.missedCallRate);
    const missedPool = 900 * TRADES.Plumbers.missedCallRate;
    expect(missedPool).toBeGreaterThan(0);
    expect(answeredPool).toBeGreaterThan(0);
    expect(missedPool + answeredPool).toBe(900);
    expect(moderate.drivers.missedCallRecovery.monthlyUnits).toBeCloseTo(
      missedPool * effectiveRecoveredBookingRate("Plumbers", 1),
      1,
    );
    expect(moderate.drivers.noShowReduction.monthlyUnits).toBeGreaterThan(0);
    expect(moderate.drivers.jobCloserUpsells.monthlyUnits).toBeGreaterThan(0);
  });

  test("report view model figures equal engine figures", () => {
    const scenarios = computeAllScenarios(GOLD_STANDARD_TRADE, GOLD_STANDARD_MONTHLY_CALLS);
    const model = buildGoldStandardReportViewModel();
    expect(model.moderateHeroTotal).toBe(scenarios[1]!.totalAnnualBenefit);
    expect(model.scenarios.map((s) => s.total)).toEqual(
      scenarios.map((s) => s.totalAnnualBenefit),
    );
    const driverMap = Object.fromEntries(model.drivers.map((d) => [d.key, d.annualValue]));
    expect(driverMap.missedCallRecovery).toBe(
      scenarios[1]!.drivers.missedCallRecovery.annualValue,
    );
  });

  test(
    "both PDF paths return identical moderate totals for the same inputs",
    async () => {
      const scenarios = computeAllScenarios(GOLD_STANDARD_TRADE, GOLD_STANDARD_MONTHLY_CALLS);
      const model = buildReportViewModel({
        trade: GOLD_STANDARD_TRADE,
        truckCount: 15,
        monthlyCalls: GOLD_STANDARD_MONTHLY_CALLS,
        lead: NORTHSTAR_LEAD,
        scenarios,
        reportId: formatReportId(
          GOLD_STANDARD_TRADE,
          GOLD_STANDARD_MONTHLY_CALLS,
          new Date("2026-09-09T15:00:00.000Z"),
        ),
        reportDate: formatReportDate(new Date("2026-09-09T15:00:00.000Z")),
      });

      const cold = await renderReportPdf(model, { mode: "cold" });
      const warm = await renderReportPdf(model, { mode: "warm" });
      expect(cold.pdf.byteLength).toBe(warm.pdf.byteLength);

      const coldText = await new PDFParse({ data: Buffer.from(cold.pdf) }).getText();
      expect(coldText.text).toContain(GOLD_STANDARD_EXPECTED.moderateTotal);
      expect(coldText.text).toContain(GOLD_STANDARD_EXPECTED.missedCallRecoveryModerate);
      expect(coldText.text).not.toContain("Recovered booking: 25%");
    },
    { timeout: 120_000 },
  );
});
