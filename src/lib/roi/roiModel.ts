import {
  estimateMonthlyCalls,
  getTradeKeys,
  tradeToSlug,
  type TradeKey,
} from "./callVolume";
import { SCENARIOS } from "./scenarioDisplay";

export { estimateMonthlyCalls, getTradeKeys, tradeToSlug, type TradeKey };
export { SCENARIOS };

export const SHARED = {
  /**
   * Share of a trade's own booking conversion that a recovered missed call achieves.
   *
   * A recovered missed call is an ordinary inbound lead that arrives late, so it
   * should convert at a share of the trade's established booking rate rather than
   * at a flat rate independent of the trade. The ratio is below 1.0 because a
   * called-back prospect has had time to reach a competitor.
   *
   * Calibrated from the previously approved recovered-booking assumptions
   * [0.15, 0.25, 0.35] divided by 0.575 — the midpoint of baseBookingConv across
   * the four dispatch/service trades (Electricians 0.50, Plumbers 0.55, HVAC 0.60,
   * Pest Control 0.65). This preserves the prior assumption for a representative
   * service trade while making recovery trade-relative.
   *
   *   0.15 / 0.575 = 0.261
   *   0.25 / 0.575 = 0.435
   *   0.35 / 0.575 = 0.609
   */
  recoveredCallCaptureRatio: [0.261, 0.435, 0.609],
  noShowReduction: [0.25, 0.4, 0.55],
  upsellRate: [0.05, 0.1, 0.15],
  adminHoursSaved: [10, 20, 30],
  hourlyRate: 75,
  annualInvestment: 18000,
} as const;

export const TRADES = {
  Plumbers: {
    label: "Plumbers",
    callsPerTruckPerMonth: 60,
    avgJobValue: 350,
    missedCallRate: 0.315,
    noShowRate: 0.15,
    baseBookingConv: 0.55,
    avgUpsellValue: 125,
    campaignJobs: [2, 4, 6],
  },
  Electricians: {
    label: "Electricians",
    callsPerTruckPerMonth: 30,
    avgJobValue: 450,
    missedCallRate: 0.225,
    noShowRate: 0.18,
    baseBookingConv: 0.5,
    avgUpsellValue: 200,
    campaignJobs: [2, 4, 6],
  },
  HVAC: {
    label: "HVAC",
    callsPerTruckPerMonth: 70,
    avgJobValue: 550,
    missedCallRate: 0.3,
    noShowRate: 0.2,
    baseBookingConv: 0.6,
    avgUpsellValue: 300,
    campaignJobs: [3, 5, 8],
  },
  Roofers: {
    label: "Roofers",
    callsPerTruckPerMonth: 20,
    avgJobValue: 3500,
    missedCallRate: 0.35,
    noShowRate: 0.1,
    baseBookingConv: 0.35,
    avgUpsellValue: 750,
    campaignJobs: [1, 2, 3],
  },
  PestControl: {
    label: "Pest Control",
    callsPerTruckPerMonth: 35,
    avgJobValue: 220,
    missedCallRate: 0.26,
    noShowRate: 0.12,
    baseBookingConv: 0.65,
    avgUpsellValue: 80,
    campaignJobs: [4, 7, 10],
  },
} as const;

export type ScenarioIndex = 0 | 1 | 2;

/** Trade-specific effective recovered-call booking rate for a scenario. */
export function effectiveRecoveredBookingRate(
  trade: TradeKey,
  scenarioIndex: ScenarioIndex,
): number {
  return TRADES[trade].baseBookingConv * SHARED.recoveredCallCaptureRatio[scenarioIndex];
}
