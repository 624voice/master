import type { RoiResult } from "~/lib/roi/computeRoi";

export function selectModerateScenario(scenarios: RoiResult[]): RoiResult {
  const moderate = scenarios.find((scenario) => scenario.scenarioIndex === 1);
  if (!moderate) {
    throw new Error("Moderate scenario (scenarioIndex === 1) not found");
  }
  return moderate;
}

export function selectModerateScenarioValue(scenarios: RoiResult[]): number {
  return selectModerateScenario(scenarios).totalAnnualBenefit;
}
