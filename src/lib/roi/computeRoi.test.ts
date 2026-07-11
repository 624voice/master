import { describe, expect, test } from "bun:test";
import { computeAllScenarios, computeRoi } from "./computeRoi";
import {
  TRADES,
  trucksToBand,
  trucksToCalls,
  type TradeKey,
} from "./roiModel";

const SANITY_CHECKS: Record<TradeKey, number> = {
  Plumbers: 414_164,
  Electricians: 373_149,
  HVAC: 752_040,
  Roofers: 1_242_469,
  PestControl: 272_396,
};

const TRUCK_COUNT_7_20 = 10;

describe("trucksToBand", () => {
  test("maps truck counts to correct bands", () => {
    expect(trucksToBand(1)).toBe("1-2");
    expect(trucksToBand(2)).toBe("1-2");
    expect(trucksToBand(3)).toBe("3-6");
    expect(trucksToBand(7)).toBe("7-20");
    expect(trucksToBand(21)).toBe("20-50");
    expect(trucksToBand(50)).toBe("20-50");
  });
});

describe("trucksToCalls", () => {
  test("returns band call volumes for each trade at 7-20 band", () => {
    expect(trucksToCalls("Plumbers", TRUCK_COUNT_7_20)).toBe(1450);
    expect(trucksToCalls("Electricians", TRUCK_COUNT_7_20)).toBe(1150);
    expect(trucksToCalls("HVAC", TRUCK_COUNT_7_20)).toBe(1450);
    expect(trucksToCalls("Roofers", TRUCK_COUNT_7_20)).toBe(475);
    expect(trucksToCalls("PestControl", TRUCK_COUNT_7_20)).toBe(1650);
  });

  test("maps band boundaries correctly for plumbers", () => {
    expect(trucksToCalls("Plumbers", 1)).toBe(135);
    expect(trucksToCalls("Plumbers", 3)).toBe(425);
    expect(trucksToCalls("Plumbers", 21)).toBe(3500);
  });
});

describe("computeRoi sanity checks (Conservative, 7-20 truck band)", () => {
  for (const trade of Object.keys(TRADES) as TradeKey[]) {
    test(`${trade} matches spreadsheet Conservative net annual ROI`, () => {
      const calls = trucksToCalls(trade, TRUCK_COUNT_7_20);
      const result = computeRoi(trade, calls, 0);
      expect(result.netAnnualROI).toBeCloseTo(SANITY_CHECKS[trade], -1);
    });
  }
});

describe("computeAllScenarios", () => {
  test("returns three scenarios in order", () => {
    const results = computeAllScenarios("HVAC", 1450);
    expect(results).toHaveLength(3);
    expect(results[0]!.netAnnualROI).toBeLessThan(results[1]!.netAnnualROI);
    expect(results[1]!.netAnnualROI).toBeLessThan(results[2]!.netAnnualROI);
  });
});

describe("edge cases", () => {
  test("handles zero calls without divide-by-zero on payback", () => {
    const result = computeRoi("HVAC", 0, 0);
    expect(result.paybackMonths).toBeNull();
    expect(result.drivers.missedCallRecovery.annualValue).toBe(0);
    expect(result.drivers.timeSavings.annualValue).toBeGreaterThan(0);
  });

  test("HVAC conservative is exact at 752040", () => {
    const result = computeRoi("HVAC", 1450, 0);
    expect(result.netAnnualROI).toBe(752_040);
  });

  test("driver breakdown sums to total annual benefit", () => {
    const result = computeRoi("Roofers", 475, 1);
    const driverSum =
      result.drivers.missedCallRecovery.annualValue +
      result.drivers.noShowReduction.annualValue +
      result.drivers.outboundSms.annualValue +
      result.drivers.jobCloserUpsells.annualValue +
      result.drivers.timeSavings.annualValue;
    expect(driverSum).toBe(result.totalAnnualBenefit);
  });
});
