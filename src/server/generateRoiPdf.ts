import { createServerFn } from "@tanstack/react-start";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { computeAllScenarios } from "~/lib/roi/computeRoi";
import {
  AUDIT_NOTES,
  getAssumptionLines,
  SCENARIO_LABELS,
} from "~/lib/roi/formatAssumptions";
import { formatCurrency, formatMultiple, formatPaybackMonths } from "~/lib/roi/formatCurrency";
import {
  SCENARIOS,
  TRADES,
  tradeToSlug,
  type TradeKey,
} from "~/lib/roi/roiModel";

export type PdfRequest = {
  trade: TradeKey;
  truckCount: number;
  monthlyCalls: number;
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
    const { trade, truckCount, monthlyCalls } = data;

    if (!TRADES[trade]) {
      throw new Error("Invalid trade");
    }

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
    page.drawText("624 Voice — ROI Estimate", {
      x: margin + 8,
      y: y - 8,
      size: 18,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    y -= 48;

    drawText(tradeLabel, { size: 14, bold: true, color: emerald });
    drawText(`Trucks: ${truckCount}`, { size: 11 });
    drawText(`Monthly inbound calls used: ${monthlyCalls.toLocaleString("en-US")}`, {
      size: 11,
    });
    y -= 8;

    drawText("Three-Scenario Summary", { size: 13, bold: true });

    for (let i = 0; i < scenarios.length; i++) {
      const result = scenarios[i]!;
      drawText(
        `${SCENARIOS[i]} (${SCENARIO_LABELS[i]})`,
        { size: 11, bold: true, indent: 8 },
      );
      drawText(`Net Annual ROI: ${formatCurrency(result.netAnnualROI)}`, { indent: 16 });
      drawText(`ROI Multiple: ${formatMultiple(result.roiMultiple)}`, { indent: 16 });
      drawText(
        `Payback: ${formatPaybackMonths(result.paybackMonths)}`,
        { indent: 16 },
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

    y -= 8;
    drawText("Assumptions", { size: 13, bold: true });
    for (const line of getAssumptionLines(trade)) {
      drawText(line, { size: 10, indent: 8, color: gray });
    }

    y -= 4;
    drawText("Audit — No Double Counting", { size: 13, bold: true });
    for (const note of AUDIT_NOTES) {
      drawText(note, { size: 10, indent: 8, color: gray });
    }

    const pdfBytes = await pdf.save();
    const base64 = Buffer.from(pdfBytes).toString("base64");
    const filename = `624-voice-roi-${tradeToSlug(trade)}.pdf`;

    return { base64, filename };
  });
