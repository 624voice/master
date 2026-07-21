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
import { formatCurrency } from "~/lib/roi/formatCurrency";
import { TRADES, tradeToSlug, type TradeKey } from "~/lib/roi/roiModel";
import { saveLead } from "~/server/leads";
import {
  buildReportUrl,
  createReportToken,
} from "~/server/speed2Lead/reportTokens";
import {
  getPrimaryOpportunity,
  startSpeed2Lead,
} from "~/server/speed2Lead/startConversation";

export type PdfRequest = {
  trade: TradeKey;
  truckCount: number;
  monthlyCalls: number;
  lead: LeadInfo;
  websiteOption: "has" | "none";
  website?: string;
  smsConsent: boolean;
};

export const generateRoiPdf = createServerFn({ method: "POST" })
  .validator((data: PdfRequest) => data)
  .handler(async ({ data }) => {
    const { trade, truckCount, monthlyCalls, lead, websiteOption, website, smsConsent } =
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

    const scenarios = computeAllScenarios(trade, monthlyCalls);
    const moderateRoi = formatCurrency(scenarios[1]!.totalAnnualBenefit);
    const primaryOpportunity = getPrimaryOpportunity(scenarios);

    const reportToken = await createReportToken({
      trade,
      truckCount,
      monthlyCalls,
      lead: normalizedLead,
      websiteOption,
      website: websiteOption === "has" ? website : undefined,
    });
    const reportUrl = buildReportUrl(reportToken);

    await saveLead({
      ...normalizedLead,
      trade: TRADES[trade].label,
      monthlyCalls,
      truckCount,
      fleetSize: String(truckCount),
      website: resolveContactWebsite(websiteOption, website),
      moderateRoi,
      smsConsent,
      source: "missing_money_pdf",
    });

    const pdfBytes = await fillRoiPdfTemplate({
      trade,
      truckCount,
      monthlyCalls,
      lead: normalizedLead,
      scenarios,
    });

    if (smsConsent) {
      try {
        await startSpeed2Lead({
          phone: normalizedLead.phone,
          firstName: normalizedLead.firstName,
          businessName: normalizedLead.businessName,
          annualOpportunity: moderateRoi,
          primaryOpportunity,
          reportUrl,
        });
      } catch (error) {
        console.error("Speed2Lead initial SMS failed:", error);
      }
    }

    const base64 = Buffer.from(pdfBytes).toString("base64");
    const filename = `624-voice-missing-revenue-${tradeToSlug(trade)}.pdf`;

    return { base64, filename };
  });
