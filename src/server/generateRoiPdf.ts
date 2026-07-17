import { createServerFn } from "@tanstack/react-start";
import {
  normalizeLeadInfo,
  resolveContactWebsite,
  validateLeadInfo,
  validateWebsiteFields,
  type LeadInfo,
} from "~/lib/lead/validateLead";
import { fillRoiPdfTemplate } from "~/lib/roi/fillRoiPdfTemplate";
import { computeAllScenarios } from "~/lib/roi/computeRoi";
import { TRADES, tradeToSlug, type TradeKey } from "~/lib/roi/roiModel";
import { saveLead } from "~/server/leads";

export type PdfRequest = {
  trade: TradeKey;
  truckCount: number;
  monthlyCalls: number;
  lead: LeadInfo;
  websiteOption: "has" | "none";
  website?: string;
};

export const generateRoiPdf = createServerFn({ method: "POST" })
  .validator((data: PdfRequest) => data)
  .handler(async ({ data }) => {
    const { trade, truckCount, monthlyCalls, lead, websiteOption, website } =
      data;

    const leadError = validateLeadInfo(lead);
    if (leadError) {
      throw new Error(leadError);
    }

    const websiteError = validateWebsiteFields(websiteOption, website);
    if (websiteError) {
      throw new Error(websiteError);
    }

    const normalizedLead = normalizeLeadInfo(lead);

    if (!TRADES[trade]) {
      throw new Error("Invalid trade");
    }

    await saveLead({
      ...normalizedLead,
      trade: TRADES[trade].label,
      monthlyCalls,
      truckCount,
      fleetSize: String(truckCount),
      website: resolveContactWebsite(websiteOption, website),
      source: "missing_money_pdf",
    });

    const scenarios = computeAllScenarios(trade, monthlyCalls);
    const pdfBytes = await fillRoiPdfTemplate({
      trade,
      truckCount,
      monthlyCalls,
      lead: normalizedLead,
      scenarios,
    });

    const base64 = Buffer.from(pdfBytes).toString("base64");
    const filename = `624-voice-missing-revenue-${tradeToSlug(trade)}.pdf`;

    return { base64, filename };
  });
