import { ROI_DISCLAIMER } from "~/config/features";
import { TRADES, type TradeKey } from "./roiModel";
import type { RoiResult } from "./computeRoi";
import { SCENARIO_LABELS } from "./scenarioDisplay";

export { SCENARIO_LABELS };

export function getSlippingAwayAnnual(drivers: RoiResult["drivers"]): number {
  return (
    drivers.missedCallRecovery.annualValue + drivers.noShowReduction.annualValue
  );
}

export function getUntappedUpsideAnnual(drivers: RoiResult["drivers"]): number {
  return (
    drivers.outboundSms.annualValue +
    drivers.jobCloserUpsells.annualValue +
    drivers.timeSavings.annualValue
  );
}

export const AUDIT_NOTES = [
  "Driver 1 (Missed-Call Recovery) applies only to currently-unanswered calls.",
  "Drivers 2 & 4 share the baseline answered-job pool but measure different outcomes (saved no-shows vs. higher ticket).",
  "Driver 3 (Outbound SMS) is independent new demand.",
  "Driver 5 (Time Savings) is admin cost reduction, not revenue.",
] as const;

export function getAssumptionLines(trade: TradeKey): string[] {
  const t = TRADES[trade];
  return [
    `Trade: ${t.label}`,
    `Estimated ${t.callsPerTruckPerMonth} calls per truck per month`,
    `Average job value: ${t.avgJobValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`,
    `Missed call rate: ${(t.missedCallRate * 100).toFixed(1)}%`,
    `No-show rate: ${(t.noShowRate * 100).toFixed(0)}%`,
    `Base booking conversion: ${(t.baseBookingConv * 100).toFixed(0)}%`,
    `Average upsell value: ${t.avgUpsellValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`,
    ROI_DISCLAIMER,
  ];
}
