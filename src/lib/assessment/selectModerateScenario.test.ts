import { describe, expect, test } from "bun:test";
import { computeAllScenarios } from "~/lib/roi/computeRoi";
import {
  selectModerateScenario,
  selectModerateScenarioValue,
} from "~/lib/assessment/selectModerateScenario";

describe("selectModerateScenario supplemental", () => {
  test("S-CMP-02: selectModerateScenarioValue and missing-moderate guard", () => {
    const scenarios = computeAllScenarios("HVAC", 700);
    const shuffled = [scenarios[2]!, scenarios[0]!, scenarios[1]!];

    expect(selectModerateScenarioValue(shuffled)).toBe(
      scenarios[1]!.totalAnnualBenefit,
    );
    expect(selectModerateScenario(shuffled).scenarioIndex).toBe(1);

    const withoutModerate = scenarios.filter(
      (scenario) => scenario.scenarioIndex !== 1,
    );
    expect(() => selectModerateScenario(withoutModerate)).toThrow(
      "Moderate scenario (scenarioIndex === 1) not found",
    );
    expect(() => selectModerateScenarioValue(withoutModerate)).toThrow(
      "Moderate scenario (scenarioIndex === 1) not found",
    );
  });
});
