import type { ContactTrade } from "~/lib/lead/validateLead";

export type TradeExampleLink = {
  outcome: string;
  link: string;
};

const TRADE_EXAMPLES: Record<string, TradeExampleLink> = {
  Plumbing: {
    outcome: "capture more after-hours and emergency calls without adding another dispatcher",
    link: "https://www.624voice.com/book",
  },
  Electrical: {
    outcome: "respond faster to inbound leads and book more service calls",
    link: "https://www.624voice.com/book",
  },
  HVAC: {
    outcome: "handle peak-season call volume without burning out the office",
    link: "https://www.624voice.com/book",
  },
  Roofing: {
    outcome: "follow up on storm and inspection leads faster while jobs are in progress",
    link: "https://www.624voice.com/book",
  },
  "Pest Control": {
    outcome: "book more route stops from inbound calls without extra office staff",
    link: "https://www.624voice.com/book",
  },
  Other: {
    outcome: "capture more opportunities and take repetitive follow-up off your team",
    link: "https://www.624voice.com/services",
  },
};

export function exampleLinkForTrade(trade: string | undefined): TradeExampleLink {
  const key = trade?.trim() || "Other";
  return TRADE_EXAMPLES[key] ?? TRADE_EXAMPLES.Other!;
}

export function fleetSizeContextNote(fleetSize: string | undefined): string | undefined {
  if (!fleetSize?.trim()) return undefined;
  const n = Number.parseInt(fleetSize.replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n <= 1) return undefined;
  return `Multi-truck fleet (${fleetSize.trim()}) — coordination and dispatch load at scale may matter.`;
}

export function isContactTrade(value: string): value is ContactTrade {
  return ["Plumbing", "Electrical", "HVAC", "Roofing", "Pest Control", "Other"].includes(value);
}
