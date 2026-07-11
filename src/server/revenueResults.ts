import { createServerFn } from "@tanstack/react-start";
import {
  normalizeLeadInfo,
  validateLeadInfo,
  type LeadInfo,
} from "~/lib/lead/validateLead";
import {
  buildFullBreakdown,
  computeHeroTeaser,
  type ScenarioBreakdown,
} from "~/lib/roi/revenueBreakdown";
import { TRADES, type TradeKey } from "~/lib/roi/roiModel";
import { saveLead } from "~/server/leads";

export type { ScenarioBreakdown };

type RevenueRequest = {
  trade: TradeKey;
  monthlyCalls: number;
};

type UnlockRequest = RevenueRequest & {
  lead: LeadInfo;
};

function assertValidInput(trade: TradeKey, monthlyCalls: number) {
  if (!TRADES[trade]) {
    throw new Error("Invalid trade");
  }
  if (!Number.isFinite(monthlyCalls) || monthlyCalls <= 0) {
    throw new Error("Monthly calls must be a positive number");
  }
}

export const getTeaserRevenue = createServerFn({ method: "POST" })
  .validator((data: RevenueRequest) => data)
  .handler(async ({ data }) => {
    const { trade, monthlyCalls } = data;
    assertValidInput(trade, monthlyCalls);
    return { hero: computeHeroTeaser(trade, monthlyCalls) };
  });

export const getFullBreakdown = createServerFn({ method: "POST" })
  .validator((data: RevenueRequest) => data)
  .handler(async ({ data }) => {
    const { trade, monthlyCalls } = data;
    assertValidInput(trade, monthlyCalls);
    return { scenarios: buildFullBreakdown(trade, monthlyCalls) };
  });

export const unlockRevenue = createServerFn({ method: "POST" })
  .validator((data: UnlockRequest) => data)
  .handler(async ({ data }) => {
    const { trade, monthlyCalls, lead } = data;
    assertValidInput(trade, monthlyCalls);

    const leadError = validateLeadInfo(lead);
    if (leadError) {
      throw new Error(leadError);
    }

    const normalizedLead = normalizeLeadInfo(lead);

    await saveLead({
      ...normalizedLead,
      trade,
      monthlyCalls,
      source: "missing_money",
    });

    return { scenarios: buildFullBreakdown(trade, monthlyCalls) };
  });
