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
    avgJobValue: 350,
    missedCallRate: 0.315,
    noShowRate: 0.15,
    baseBookingConv: 0.55,
    avgUpsellValue: 125,
    campaignJobs: [2, 4, 6],
    trucksToCalls: { "1-2": 135, "3-6": 425, "7-20": 1450, "20-50": 3500 },
  },
  Electricians: {
    label: "Electricians",
    avgJobValue: 450,
    missedCallRate: 0.225,
    noShowRate: 0.18,
    baseBookingConv: 0.5,
    avgUpsellValue: 200,
    campaignJobs: [2, 4, 6],
    trucksToCalls: { "1-2": 100, "3-6": 325, "7-20": 1150, "20-50": 3150 },
  },
  HVAC: {
    label: "HVAC",
    avgJobValue: 550,
    missedCallRate: 0.3,
    noShowRate: 0.2,
    baseBookingConv: 0.6,
    avgUpsellValue: 300,
    campaignJobs: [3, 5, 8],
    trucksToCalls: { "1-2": 135, "3-6": 400, "7-20": 1450, "20-50": 3850 },
  },
  Roofers: {
    label: "Roofers",
    avgJobValue: 3500,
    missedCallRate: 0.35,
    noShowRate: 0.1,
    baseBookingConv: 0.35,
    avgUpsellValue: 750,
    campaignJobs: [1, 2, 3],
    trucksToCalls: { "1-2": 70, "3-6": 200, "7-20": 475, "20-50": 1350 },
  },
  PestControl: {
    label: "Pest Control",
    avgJobValue: 220,
    missedCallRate: 0.26,
    noShowRate: 0.12,
    baseBookingConv: 0.65,
    avgUpsellValue: 80,
    campaignJobs: [4, 7, 10],
    trucksToCalls: { "1-2": 200, "3-6": 550, "7-20": 1650, "20-50": 4250 },
  },
} as const;

export type TradeKey = keyof typeof TRADES;
export type TruckBand = "1-2" | "3-6" | "7-20" | "20-50";
export type ScenarioIndex = 0 | 1 | 2;

export function trucksToBand(n: number): TruckBand {
  if (n <= 2) return "1-2";
  if (n <= 6) return "3-6";
  if (n <= 20) return "7-20";
  return "20-50";
}

export function trucksToCalls(trade: TradeKey, truckCount: number): number {
  const band = trucksToBand(truckCount);
  return TRADES[trade].trucksToCalls[band];
}

export function getTradeKeys(): TradeKey[] {
  return Object.keys(TRADES) as TradeKey[];
}

export function tradeToSlug(trade: TradeKey): string {
  return trade.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
