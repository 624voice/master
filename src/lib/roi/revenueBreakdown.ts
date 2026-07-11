import { computeAllScenarios } from "./computeRoi";
import {
  getSlippingAwayAnnual,
  getUntappedUpsideAnnual,
} from "./formatAssumptions";
import type { TradeKey } from "./roiModel";
import { SCENARIO_LABELS, SCENARIOS } from "./scenarioDisplay";

const DRIVER_ORDER = [
  "missedCallRecovery",
  "noShowReduction",
  "outboundSms",
  "jobCloserUpsells",
  "timeSavings",
] as const;

export type DriverBreakdown = {
  key: (typeof DRIVER_ORDER)[number];
  label: string;
  monthlyUnits: number;
  annualValue: number;
};

export type ScenarioBreakdown = {
  scenario: string;
  scenarioLabel: string;
  total: number;
  missingNow: number;
  upside: number;
  drivers: DriverBreakdown[];
};

export function roundDownHero(totalAnnualBenefit: number): number {
  const step = totalAnnualBenefit >= 50_000 ? 50_000 : 10_000;
  return Math.floor(totalAnnualBenefit / step) * step;
}

export function buildFullBreakdown(
  trade: TradeKey,
  monthlyCalls: number,
): ScenarioBreakdown[] {
  const results = computeAllScenarios(trade, monthlyCalls);

  return results.map((result, index) => ({
    scenario: SCENARIOS[index]!,
    scenarioLabel: SCENARIO_LABELS[index]!,
    total: result.totalAnnualBenefit,
    missingNow: getSlippingAwayAnnual(result.drivers),
    upside: getUntappedUpsideAnnual(result.drivers),
    drivers: DRIVER_ORDER.map((key) => ({
      key,
      label: result.drivers[key].label,
      monthlyUnits: result.drivers[key].monthlyUnits,
      annualValue: result.drivers[key].annualValue,
    })),
  }));
}

export function computeHeroTeaser(
  trade: TradeKey,
  monthlyCalls: number,
): number {
  const conservative = computeAllScenarios(trade, monthlyCalls)[0]!;
  return roundDownHero(conservative.totalAnnualBenefit);
}
