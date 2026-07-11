import { ROI_DISCLAIMER } from "~/config/features";
import { SHARED, TRADES, type TradeKey } from "./roiModel";

export const SCENARIO_LABELS = [
  "~10–20%",
  "~20–35%",
  "~35–50%+",
] as const;

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
    `Average job value: ${t.avgJobValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`,
    `Missed call rate: ${(t.missedCallRate * 100).toFixed(1)}%`,
    `No-show rate: ${(t.noShowRate * 100).toFixed(0)}%`,
    `Base booking conversion: ${(t.baseBookingConv * 100).toFixed(0)}%`,
    `Average upsell value: ${t.avgUpsellValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`,
    `624 Voice platform cost: ${formatPlatformCost()}`,
    ROI_DISCLAIMER,
  ];
}

function formatPlatformCost(): string {
  return `$1,500/mo ($${SHARED.annualInvestment.toLocaleString("en-US")}/yr)`;
}
