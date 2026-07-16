import { createServerFn } from "@tanstack/react-start";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  formatLeadName,
  normalizeLeadInfo,
  resolveContactWebsite,
  validateLeadInfo,
  validateWebsiteFields,
  type LeadInfo,
} from "~/lib/lead/validateLead";
import { computeAllScenarios } from "~/lib/roi/computeRoi";
import {
  getSlippingAwayAnnual,
  getUntappedUpsideAnnual,
  SCENARIO_LABELS,
} from "~/lib/roi/formatAssumptions";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import {
  SCENARIOS,
  TRADES,
  tradeToSlug,
  type TradeKey,
} from "~/lib/roi/roiModel";
import { saveLead } from "~/server/leads";

export type PdfRequest = {
  trade: TradeKey;
  truckCount: number;
  monthlyCalls: number;
  lead: LeadInfo;
  websiteOption: "has" | "none";
  website?: string;
};

const DRIVER_ORDER = [
  "missedCallRecovery",
  "noShowReduction",
  "outboundSms",
  "jobCloserUpsells",
  "timeSavings",
] as const;

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
    const tradeLabel = TRADES[trade].label;

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;

    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const emerald = rgb(0.06, 0.73, 0.51);
    const dark = rgb(0.09, 0.13, 0.18);
    const gray = rgb(0.4, 0.4, 0.4);

    const ensureSpace = (needed: number) => {
      if (y - needed < margin) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
    };

    const drawText = (
      text: string,
      opts: {
        size?: number;
        bold?: boolean;
        color?: ReturnType<typeof rgb>;
        indent?: number;
      } = {},
    ) => {
      const size = opts.size ?? 11;
      const usedFont = opts.bold ? fontBold : font;
      const color = opts.color ?? dark;
      const indent = opts.indent ?? 0;
      ensureSpace(size + 6);
      page.drawText(text, {
        x: margin + indent,
        y,
        size,
        font: usedFont,
        color,
        maxWidth: contentWidth - indent,
      });
      y -= size + 6;
    };

    page.drawRectangle({
      x: margin,
      y: y - 28,
      width: contentWidth,
      height: 36,
      color: emerald,
    });
    page.drawText("624 Voice — Revenue You're Missing", {
      x: margin + 8,
      y: y - 8,
      size: 18,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    y -= 48;

    drawText(tradeLabel, { size: 14, bold: true, color: emerald });
    drawText(`Prepared for: ${formatLeadName(normalizedLead)}`, { size: 11 });
    drawText(`Business: ${normalizedLead.businessName}`, { size: 11 });
    drawText(`Trucks: ${truckCount}`, { size: 11 });
    drawText(
      `Call estimate: ${truckCount} trucks × ${TRADES[trade].callsPerTruckPerMonth} calls/truck = ${monthlyCalls.toLocaleString("en-US")} calls/mo`,
      { size: 11 },
    );
    y -= 8;

    drawText("Here's the money you're missing every year.", {
      size: 13,
      bold: true,
    });

    for (let i = 0; i < scenarios.length; i++) {
      const result = scenarios[i]!;
      const scenarioPrefix =
        i === 0
          ? `${SCENARIOS[i]} (${SCENARIO_LABELS[i]})`
          : `${SCENARIOS[i]} — and up to ${SCENARIO_LABELS[i]}`;

      drawText(scenarioPrefix, { size: 11, bold: true, indent: 8 });
      drawText(
        `Revenue you're missing / year: ${formatCurrency(result.totalAnnualBenefit)}`,
        { indent: 16 },
      );
      drawText(
        `Slipping away right now: ${formatCurrency(getSlippingAwayAnnual(result.drivers))}/yr`,
        { indent: 16, color: gray },
      );
      drawText(
        `  Missed-Call Recovery + No-Show Reduction`,
        { size: 10, indent: 16, color: gray },
      );
      drawText(
        `Untapped upside: ${formatCurrency(getUntappedUpsideAnnual(result.drivers))}/yr`,
        { indent: 16, color: gray },
      );
      drawText(
        `  Outbound Campaigns + Job-Closer Upsells + Time Savings`,
        { size: 10, indent: 16, color: gray },
      );
    }

    y -= 8;
    drawText("Value Driver Breakdown (Moderate)", { size: 13, bold: true });
    const moderate = scenarios[1]!;
    for (const key of DRIVER_ORDER) {
      const driver = moderate.drivers[key];
      drawText(driver.label, { size: 10, bold: true, indent: 8 });
      drawText(
        `${driver.monthlyUnits} per month → ${formatCurrency(driver.annualValue)}/yr`,
        { size: 10, indent: 16, color: gray },
      );
    }

    const pdfBytes = await pdf.save();
    const base64 = Buffer.from(pdfBytes).toString("base64");
    const filename = `624-voice-missing-revenue-${tradeToSlug(trade)}.pdf`;

    return { base64, filename };
  });
