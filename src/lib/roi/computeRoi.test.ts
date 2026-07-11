import { describe, expect, test } from "bun:test";
import { computeAllScenarios, computeRoi } from "./computeRoi";
import { estimateMonthlyCalls, type TradeKey } from "./roiModel";

describe("estimateMonthlyCalls", () => {
  test("Plumbers 5 trucks → 300", () => {
    expect(estimateMonthlyCalls("Plumbers", 5)).toBe(300);
  });

  test("HVAC 10 trucks → 700", () => {
    expect(estimateMonthlyCalls("HVAC", 10)).toBe(700);
  });

  test("Electricians 3 trucks → 90", () => {
    expect(estimateMonthlyCalls("Electricians", 3)).toBe(90);
  });

  test("PestControl 4 trucks → 140", () => {
    expect(estimateMonthlyCalls("PestControl", 4)).toBe(140);
  });

  test("Roofers 2 trucks → 40", () => {
    expect(estimateMonthlyCalls("Roofers", 2)).toBe(40);
  });
});

describe("computeAllScenarios", () => {
  test("returns three scenarios in increasing order", () => {
    const results = computeAllScenarios("HVAC", 700);
    expect(results).toHaveLength(3);
    expect(results[0]!.netAnnualROI).toBeLessThan(results[1]!.netAnnualROI);
    expect(results[1]!.netAnnualROI).toBeLessThan(results[2]!.netAnnualROI);
  });
});

describe("computeRoi spot-check", () => {
  test("HVAC conservative at 700 calls/mo", () => {
    const result = computeRoi("HVAC", 700, 0);
    expect(result.netAnnualROI).toBe(368_640);
  });
});

describe("edge cases", () => {
  test("handles zero calls without divide-by-zero on payback", () => {
    const result = computeRoi("HVAC", 0, 0);
    expect(result.paybackMonths).toBeNull();
    expect(result.drivers.missedCallRecovery.annualValue).toBe(0);
    expect(result.drivers.timeSavings.annualValue).toBeGreaterThan(0);
  });

  test("driver breakdown sums to total annual benefit", () => {
    const result = computeRoi("Roofers", 40, 1);
    const driverSum =
      result.drivers.missedCallRecovery.annualValue +
      result.drivers.noShowReduction.annualValue +
      result.drivers.outboundSms.annualValue +
      result.drivers.jobCloserUpsells.annualValue +
      result.drivers.timeSavings.annualValue;
    expect(driverSum).toBe(result.totalAnnualBenefit);
  });
});

describe("estimateMonthlyCalls scales linearly", () => {
  for (const trade of [
    "Plumbers",
    "HVAC",
    "Electricians",
    "Roofers",
    "PestControl",
  ] as TradeKey[]) {
    test(`${trade} doubles when truck count doubles`, () => {
      expect(estimateMonthlyCalls(trade, 4)).toBe(
        estimateMonthlyCalls(trade, 2) * 2,
      );
    });
  }
});
