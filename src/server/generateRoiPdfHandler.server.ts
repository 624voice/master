import {
  normalizeLeadInfo,
  resolveContactWebsite,
  validateLeadInfo,
  validateWebsiteFields,
} from "~/lib/lead/validateLead";
import { computeAllScenarios } from "~/lib/roi/computeRoi";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import { TRADES, tradeToSlug } from "~/lib/roi/roiModel";
import { saveLead } from "~/server/leads";
import { isSpeed2LeadEnabled } from "~/server/speed2Lead/config";
import {
  buildReportUrl,
  createReportToken,
} from "~/server/speed2Lead/reportTokens";
import { getPrimaryOpportunity } from "~/server/speed2Lead/roiOpportunity";
import { startAgentConversation } from "~/server/speed2Lead/agent/startConversation";
import type { PdfRequest } from "~/server/generateRoiPdf";

export async function generateRoiPdfHandler(data: PdfRequest) {
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
  const reportGeneratedAt = new Date();

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

  const { generateReportPdfBytes } = await import(
    "~/server/report/generateReportPdfBytes.server"
  );
  const pdfBytes = await generateReportPdfBytes({
    trade,
    truckCount,
    monthlyCalls,
    lead: normalizedLead,
    scenarios,
    reportGeneratedAt,
  });

  if (smsConsent && isSpeed2LeadEnabled()) {
    try {
      const reportToken = await createReportToken({
        trade,
        truckCount,
        monthlyCalls,
        lead: normalizedLead,
        websiteOption,
        website: websiteOption === "has" ? website : undefined,
      });
      const reportUrl = buildReportUrl(reportToken);

      await startAgentConversation({
        phone: normalizedLead.phone,
        firstName: normalizedLead.firstName,
        lastName: normalizedLead.lastName,
        businessName: normalizedLead.businessName,
        email: normalizedLead.email,
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
}
