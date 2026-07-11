export const SCENARIOS = ["Conservative", "Moderate", "Aggressive"] as const;

export const SHARED = {
  recoveredBookingRate: [0.15, 0.25, 0.35],
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

export type TradeKey = keyof typeof TRADES;
export type ScenarioIndex = 0 | 1 | 2;

export function estimateMonthlyCalls(
  trade: TradeKey,
  truckCount: number,
): number {
  return truckCount * TRADES[trade].callsPerTruckPerMonth;
}

export function getTradeKeys(): TradeKey[] {
  return Object.keys(TRADES) as TradeKey[];
}

export function tradeToSlug(trade: TradeKey): string {
  return trade.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
