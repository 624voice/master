import type { TradeKey } from "~/lib/roi/roiModel";
import { tradeToSlug } from "~/lib/roi/roiModel";

export function formatReportDate(date: Date): string {
  const dateStr = date.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `Prepared ${dateStr}`;
}

export function formatReportId(
  trade: TradeKey,
  monthlyCalls: number,
  date: Date,
): string {
  const compact = date
    .toLocaleDateString("en-CA", { timeZone: "America/Chicago" })
    .replace(/-/g, "");
  const code = tradeToSlug(trade).slice(0, 3).toUpperCase();
  return `624-${compact}-${code}-${monthlyCalls}`;
}
