export const CALL_VOLUME_TRADES = {
  Plumbers: { label: "Plumbers", callsPerTruckPerMonth: 60 },
  Electricians: { label: "Electricians", callsPerTruckPerMonth: 30 },
  HVAC: { label: "HVAC", callsPerTruckPerMonth: 70 },
  Roofers: { label: "Roofers", callsPerTruckPerMonth: 20 },
  PestControl: { label: "Pest Control", callsPerTruckPerMonth: 35 },
} as const;

/** Client-safe trade list (label + calls-per-truck only). */
export const TRADES = CALL_VOLUME_TRADES;

export type TradeKey = keyof typeof CALL_VOLUME_TRADES;

export function estimateMonthlyCalls(
  trade: TradeKey,
  truckCount: number,
): number {
  return truckCount * CALL_VOLUME_TRADES[trade].callsPerTruckPerMonth;
}

export function getTradeKeys(): TradeKey[] {
  return Object.keys(CALL_VOLUME_TRADES) as TradeKey[];
}

export function tradeToSlug(trade: TradeKey): string {
  return trade.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
