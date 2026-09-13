import { describe, expect, test } from "bun:test";
import {
  computeAllScenarios,
  computeAllScenariosWithOverrides,
  computeRoi,
} from "./computeRoi";

describe("S-ROI supplemental overrides", () => {
  test("S-ROI-01: empty overrides match baseline scenarios", () => {
    const baseline = computeAllScenarios("HVAC", 700);
    const overridden = computeAllScenariosWithOverrides("HVAC", 700, {});
    expect(overridden).toEqual(baseline);
  });

  test("S-ROI-02: missedCallRateOverride changes moderate scenario", () => {
    const baseline = computeAllScenarios("HVAC", 700);
    const overridden = computeAllScenariosWithOverrides("HVAC", 700, {
      missedCallRateOverride: 25,
    });
    expect(overridden[1]!.netAnnualROI).not.toBe(baseline[1]!.netAnnualROI);
  });

  test("S-ROI-03: avgJobValueOverride scales benefit", () => {
    const low = computeAllScenariosWithOverrides("Plumbers", 300, {
      avgJobValueOverride: 200,
    });
    const high = computeAllScenariosWithOverrides("Plumbers", 300, {
      avgJobValueOverride: 800,
    });
    expect(high[1]!.totalAnnualBenefit).toBeGreaterThan(low[1]!.totalAnnualBenefit);
  });

  test("S-ROI-04: lower call volume input changes missed-call driver", () => {
    const highVolume = computeAllScenarios("HVAC", 700);
    const lowVolume = computeAllScenarios("HVAC", 100);
    expect(lowVolume[1]!.drivers.missedCallRecovery.annualValue).toBeLessThan(
      highVolume[1]!.drivers.missedCallRecovery.annualValue,
    );
  });

  test("S-ROI-05: computeRoi returns five driver buckets", () => {
    const result = computeRoi("HVAC", 700, 1);
    expect(Object.keys(result.drivers)).toEqual([
      "missedCallRecovery",
      "noShowReduction",
      "outboundSms",
      "jobCloserUpsells",
      "timeSavings",
    ]);
  });

  test("S-ROI-06: scenario index ordering is conservative, moderate, aggressive", () => {
    const scenarios = computeAllScenarios("Electricians", 90);
    expect(scenarios[0]!.scenarioIndex).toBe(0);
    expect(scenarios[1]!.scenarioIndex).toBe(1);
    expect(scenarios[2]!.scenarioIndex).toBe(2);
  });

  test("S-ROI-07: zero monthly calls yields null payback", () => {
    expect(computeRoi("HVAC", 0, 0).paybackMonths).toBeNull();
  });

  test("S-ROI-08: driver sum equals totalAnnualBenefit", () => {
    const result = computeRoi("Roofers", 40, 1);
    const sum = Object.values(result.drivers).reduce(
      (total, driver) => total + driver.annualValue,
      0,
    );
    expect(sum).toBe(result.totalAnnualBenefit);
  });
});
