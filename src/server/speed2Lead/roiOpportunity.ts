import type { RoiResult } from "~/lib/roi/computeRoi";

export function getPrimaryOpportunity(scenarios: RoiResult[]): string {
  const moderate = scenarios[1]!;
  const drivers = Object.values(moderate.drivers);
  return drivers.reduce((largest, driver) =>
    driver.annualValue > largest.annualValue ? driver : largest,
  ).label;
}
