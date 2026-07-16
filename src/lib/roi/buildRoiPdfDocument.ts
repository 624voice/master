import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type { LeadInfo } from "~/lib/lead/validateLead";
import { formatLeadName } from "~/lib/lead/validateLead";
import type { RoiResult } from "~/lib/roi/computeRoi";
import {
  getSlippingAwayAnnual,
  getUntappedUpsideAnnual,
  getAssumptionLines,
  SCENARIO_LABELS,
} from "~/lib/roi/formatAssumptions";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import { SCENARIOS, TRADES, type TradeKey } from "~/lib/roi/roiModel";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const BRAND = {
  primary: rgb(16 / 255, 185 / 255, 129 / 255),
  primaryLight: rgb(209 / 255, 250 / 255, 229 / 255),
  secondary: rgb(22 / 255, 39 / 255, 54 / 255),
  white: rgb(1, 1, 1),
  text: rgb(0.09, 0.13, 0.18),
  gray: rgb(0.42, 0.45, 0.5),
  grayLight: rgb(0.97, 0.98, 0.98),
  border: rgb(0.9, 0.91, 0.92),
};

const DRIVER_ORDER = [
  "missedCallRecovery",
  "noShowReduction",
  "outboundSms",
  "jobCloserUpsells",
  "timeSavings",
] as const;

export function toPdfSafeText(text: string): string {
  return text
    .replace(/\u2192/g, "->")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u00d7/g, "x")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

function loadLogoBytes(): Uint8Array | null {
  for (const path of [
    join(process.cwd(), "public", "logo.png"),
    join(process.cwd(), "dist", "client", "logo.png"),
  ]) {
    if (existsSync(path)) {
      return readFileSync(path);
    }
  }
  return null;
}

type PdfContext = {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontBold: PDFFont;
};

export async function buildRoiPdfDocument(input: {
  trade: TradeKey;
  truckCount: number;
  monthlyCalls: number;
  lead: LeadInfo;
  scenarios: RoiResult[];
}): Promise<Uint8Array> {
  const { trade, truckCount, monthlyCalls, lead, scenarios } = input;
  const tradeLabel = TRADES[trade].label;
  const conservative = scenarios[0]!;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT;

  const ctx: PdfContext = { pdf, page, y, font, fontBold };

  const ensureSpace = (needed: number) => {
    if (ctx.y - needed < MARGIN + 48) {
      drawPageFooter(ctx);
      ctx.page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawMiniHeader(ctx, tradeLabel);
    }
  };

  const drawText = (
    text: string,
    opts: {
      x?: number;
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      maxWidth?: number;
    } = {},
  ) => {
    const size = opts.size ?? 10;
    const usedFont = opts.bold ? fontBold : font;
    const x = opts.x ?? MARGIN;
    const maxWidth = opts.maxWidth ?? CONTENT_WIDTH - (x - MARGIN);
    ensureSpace(size + 8);
    ctx.page.drawText(toPdfSafeText(text), {
      x,
      y: ctx.y,
      size,
      font: usedFont,
      color: opts.color ?? BRAND.text,
      maxWidth,
      lineHeight: size * 1.35,
    });
    const lines = Math.max(1, Math.ceil(usedFont.widthOfTextAtSize(text, size) / maxWidth));
    ctx.y -= size * 1.35 * lines + 4;
  };

  const setY = (nextY: number) => {
    ctx.y = nextY;
  };

  // --- Branded header ---
  const headerHeight = 80;
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - headerHeight,
    width: PAGE_WIDTH,
    height: headerHeight,
    color: BRAND.secondary,
  });

  const logoBytes = loadLogoBytes();
  if (logoBytes) {
    const logo = await pdf.embedPng(logoBytes);
    ctx.page.drawImage(logo, {
      x: MARGIN,
      y: PAGE_HEIGHT - headerHeight + 22,
      width: 36,
      height: 36,
    });
  }

  ctx.page.drawText(toPdfSafeText("624 Voice"), {
    x: MARGIN + 44,
    y: PAGE_HEIGHT - 38,
    size: 20,
    font: fontBold,
    color: BRAND.white,
  });
  ctx.page.drawText(toPdfSafeText("Revenue Gap Report"), {
    x: MARGIN + 44,
    y: PAGE_HEIGHT - 56,
    size: 11,
    font,
    color: rgb(0.75, 0.8, 0.85),
  });

  ctx.page.drawText(toPdfSafeText(new Date().toLocaleDateString("en-US")), {
    x: PAGE_WIDTH - MARGIN - 80,
    y: PAGE_HEIGHT - 48,
    size: 10,
    font,
    color: rgb(0.75, 0.8, 0.85),
  });

  setY(PAGE_HEIGHT - headerHeight - 24);

  // --- Client info card ---
  const infoCardTop = ctx.y;
  const infoCardHeight = 72;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: infoCardTop - infoCardHeight,
    width: CONTENT_WIDTH,
    height: infoCardHeight,
    color: BRAND.primaryLight,
    borderColor: BRAND.border,
    borderWidth: 1,
  });

  const infoY = infoCardTop - 22;
  ctx.page.drawText(toPdfSafeText(`Prepared for: ${formatLeadName(lead)}`), {
    x: MARGIN + 16,
    y: infoY,
    size: 11,
    font: fontBold,
    color: BRAND.secondary,
  });
  ctx.page.drawText(toPdfSafeText(`Business: ${lead.businessName}`), {
    x: MARGIN + 16,
    y: infoY - 18,
    size: 10,
    font,
    color: BRAND.text,
  });
  ctx.page.drawText(toPdfSafeText(`${tradeLabel}  |  ${truckCount} trucks  |  ${monthlyCalls.toLocaleString("en-US")} calls/mo`), {
    x: MARGIN + 16,
    y: infoY - 34,
    size: 10,
    font,
    color: BRAND.gray,
  });
  ctx.page.drawText(toPdfSafeText(`${lead.email}  |  ${lead.phone}`), {
    x: MARGIN + 280,
    y: infoY - 18,
    size: 9,
    font,
    color: BRAND.gray,
  });

  setY(infoCardTop - infoCardHeight - 28);

  // --- Hero conservative estimate ---
  const heroHeight = 88;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - heroHeight,
    width: CONTENT_WIDTH,
    height: heroHeight,
    color: BRAND.white,
    borderColor: BRAND.primary,
    borderWidth: 2,
  });
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - heroHeight,
    width: 6,
    height: heroHeight,
    color: BRAND.primary,
  });

  ctx.page.drawText(toPdfSafeText("CONSERVATIVE ESTIMATE"), {
    x: MARGIN + 20,
    y: ctx.y - 28,
    size: 9,
    font: fontBold,
    color: BRAND.primary,
  });
  ctx.page.drawText(
    toPdfSafeText(`You're missing about ${formatCurrency(conservative.totalAnnualBenefit)}+ every year`),
    {
      x: MARGIN + 20,
      y: ctx.y - 52,
      size: 18,
      font: fontBold,
      color: BRAND.secondary,
      maxWidth: CONTENT_WIDTH - 40,
    },
  );
  ctx.page.drawText(toPdfSafeText("Based on your trade, fleet size, and call volume."), {
    x: MARGIN + 20,
    y: ctx.y - 72,
    size: 10,
    font,
    color: BRAND.gray,
  });

  setY(ctx.y - heroHeight - 28);

  // --- Scenario cards ---
  drawText("Annual Revenue Gap by Scenario", { size: 13, bold: true, color: BRAND.secondary });
  setY(ctx.y - 4);

  const cardGap = 12;
  const cardWidth = (CONTENT_WIDTH - cardGap * 2) / 3;
  const cardHeight = 118;
  const cardsTop = ctx.y;

  for (let i = 0; i < scenarios.length; i++) {
    const result = scenarios[i]!;
    const cardX = MARGIN + i * (cardWidth + cardGap);
    const isPrimary = i === 0;

    ctx.page.drawRectangle({
      x: cardX,
      y: cardsTop - cardHeight,
      width: cardWidth,
      height: cardHeight,
      color: isPrimary ? rgb(0.98, 1, 0.99) : BRAND.white,
      borderColor: isPrimary ? BRAND.primary : BRAND.border,
      borderWidth: isPrimary ? 2 : 1,
    });

    ctx.page.drawText(toPdfSafeText(SCENARIOS[i]!.toUpperCase()), {
      x: cardX + 12,
      y: cardsTop - 22,
      size: 8,
      font: fontBold,
      color: BRAND.primary,
    });
    ctx.page.drawText(toPdfSafeText(SCENARIO_LABELS[i]!), {
      x: cardX + 12,
      y: cardsTop - 34,
      size: 8,
      font,
      color: BRAND.gray,
    });
    ctx.page.drawText(toPdfSafeText(formatCurrency(result.totalAnnualBenefit)), {
      x: cardX + 12,
      y: cardsTop - 58,
      size: 16,
      font: fontBold,
      color: BRAND.secondary,
    });
    ctx.page.drawText(toPdfSafeText("per year"), {
      x: cardX + 12,
      y: cardsTop - 72,
      size: 8,
      font,
      color: BRAND.gray,
    });
    ctx.page.drawText(toPdfSafeText(`Slipping away: ${formatCurrency(getSlippingAwayAnnual(result.drivers))}`), {
      x: cardX + 12,
      y: cardsTop - 88,
      size: 7.5,
      font,
      color: BRAND.gray,
      maxWidth: cardWidth - 24,
    });
    ctx.page.drawText(toPdfSafeText(`Upside: ${formatCurrency(getUntappedUpsideAnnual(result.drivers))}`), {
      x: cardX + 12,
      y: cardsTop - 102,
      size: 7.5,
      font,
      color: BRAND.gray,
      maxWidth: cardWidth - 24,
    });
  }

  setY(cardsTop - cardHeight - 28);

  // --- Value drivers table ---
  drawText("Value Drivers (Moderate Scenario)", {
    size: 13,
    bold: true,
    color: BRAND.secondary,
  });
  setY(ctx.y - 4);

  const moderate = scenarios[1]!;
  const tableTop = ctx.y;
  const rowHeight = 22;
  const colLabel = MARGIN;
  const colUnits = MARGIN + 260;
  const colValue = MARGIN + 380;

  ctx.page.drawRectangle({
    x: MARGIN,
    y: tableTop - rowHeight,
    width: CONTENT_WIDTH,
    height: rowHeight,
    color: BRAND.secondary,
  });
  for (const [label, x] of [
    ["Driver", colLabel + 12],
    ["Monthly Volume", colUnits + 12],
    ["Annual Value", colValue + 12],
  ] as const) {
    ctx.page.drawText(toPdfSafeText(label), {
      x,
      y: tableTop - 15,
      size: 9,
      font: fontBold,
      color: BRAND.white,
    });
  }

  let tableY = tableTop - rowHeight;
  for (let i = 0; i < DRIVER_ORDER.length; i++) {
    const key = DRIVER_ORDER[i]!;
    const driver = moderate.drivers[key];
    tableY -= rowHeight;

    if (i % 2 === 0) {
      ctx.page.drawRectangle({
        x: MARGIN,
        y: tableY,
        width: CONTENT_WIDTH,
        height: rowHeight,
        color: BRAND.grayLight,
      });
    }

    ctx.page.drawText(toPdfSafeText(driver.label), {
      x: colLabel + 12,
      y: tableY + 7,
      size: 9,
      font: fontBold,
      color: BRAND.text,
    });
    ctx.page.drawText(toPdfSafeText(String(driver.monthlyUnits)), {
      x: colUnits + 12,
      y: tableY + 7,
      size: 9,
      font,
      color: BRAND.gray,
    });
    ctx.page.drawText(toPdfSafeText(formatCurrency(driver.annualValue)), {
      x: colValue + 12,
      y: tableY + 7,
      size: 9,
      font: fontBold,
      color: BRAND.primary,
    });
  }

  setY(tableY - 28);

  // --- Guarantee box ---
  const guaranteeHeight = 96;
  ensureSpace(guaranteeHeight + 20);
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - guaranteeHeight,
    width: CONTENT_WIDTH,
    height: guaranteeHeight,
    color: BRAND.primaryLight,
    borderColor: BRAND.primary,
    borderWidth: 1,
  });
  ctx.page.drawText(toPdfSafeText("90-Day Results Guarantee"), {
    x: MARGIN + 16,
    y: ctx.y - 24,
    size: 12,
    font: fontBold,
    color: BRAND.secondary,
  });
  ctx.page.drawText(
    toPdfSafeText(
      "We guarantee you recover at least our service investment in booked service-visit revenue within 90 days of go-live - or we keep working, for free, until you do.",
    ),
    {
      x: MARGIN + 16,
      y: ctx.y - 42,
      size: 9,
      font,
      color: BRAND.text,
      maxWidth: CONTENT_WIDTH - 32,
      lineHeight: 12,
    },
  );
  ctx.page.drawText(
    toPdfSafeText("If we don't perform, you don't pay beyond the Results Engagement Period."),
    {
      x: MARGIN + 16,
      y: ctx.y - 72,
      size: 9,
      font,
      color: BRAND.gray,
      maxWidth: CONTENT_WIDTH - 32,
    },
  );

  setY(ctx.y - guaranteeHeight - 16);
  drawPageFooter(ctx);

  // --- Page 2: Assumptions ---
  ctx.page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN;
  drawMiniHeader(ctx, tradeLabel);

  drawText("Methodology & Assumptions", { size: 14, bold: true, color: BRAND.secondary });
  setY(ctx.y - 8);

  for (const line of getAssumptionLines(trade)) {
    drawText(`- ${line}`, { size: 9, color: BRAND.gray, maxWidth: CONTENT_WIDTH - 12 });
  }

  setY(ctx.y - 12);
  drawText("Next Steps", { size: 13, bold: true, color: BRAND.secondary });
  drawText("Book a personalized demo at 624voice.com/contact or email info@624voice.com.", {
    size: 10,
    color: BRAND.text,
  });
  drawText("624 Voice helps home services companies answer every call 24/7/365 on the first ring.", {
    size: 9,
    color: BRAND.gray,
  });

  drawPageFooter(ctx);

  return pdf.save();
}

function drawMiniHeader(ctx: PdfContext, tradeLabel: string) {
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 48,
    width: PAGE_WIDTH,
    height: 48,
    color: BRAND.secondary,
  });
  ctx.page.drawText(toPdfSafeText("624 Voice - Revenue Gap Report"), {
    x: MARGIN,
    y: PAGE_HEIGHT - 30,
    size: 12,
    font: ctx.fontBold,
    color: BRAND.white,
  });
  ctx.page.drawText(toPdfSafeText(tradeLabel), {
    x: PAGE_WIDTH - MARGIN - 100,
    y: PAGE_HEIGHT - 30,
    size: 10,
    font: ctx.font,
    color: rgb(0.75, 0.8, 0.85),
  });
  ctx.y = PAGE_HEIGHT - 68;
}

function drawPageFooter(ctx: PdfContext) {
  const footerHeight = 36;
  ctx.page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: footerHeight,
    color: BRAND.secondary,
  });
  ctx.page.drawText(toPdfSafeText("info@624voice.com  |  624voice.com  |  Book a demo at /contact"), {
    x: MARGIN,
    y: 12,
    size: 9,
    font: ctx.font,
    color: rgb(0.75, 0.8, 0.85),
  });
}
