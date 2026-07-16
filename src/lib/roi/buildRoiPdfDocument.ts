import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
  type RGB,
} from "pdf-lib";
import { BOOK_MEETING_URL } from "~/config/features";
import type { LeadInfo } from "~/lib/lead/validateLead";
import { formatLeadName } from "~/lib/lead/validateLead";
import type { RoiResult } from "~/lib/roi/computeRoi";
import {
  getSlippingAwayAnnual,
  getUntappedUpsideAnnual,
  SCENARIO_LABELS,
} from "~/lib/roi/formatAssumptions";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import {
  BOOK_DEMO_LABEL,
  GUARANTEE_BODY,
  GUARANTEE_FOOTNOTE,
  NARRATIVE_SECTIONS,
  NEXT_STEPS_PARAGRAPHS,
  NEXT_STEPS_TITLE,
  PDF_SUBTITLE,
  PDF_TITLE,
} from "~/lib/roi/pdfReportContent";
import { SCENARIOS, TRADES, type TradeKey } from "~/lib/roi/roiModel";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const FOOTER_HEIGHT = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = FOOTER_HEIGHT + 12;
const MODERATE_INDEX = 1;

const BRAND = {
  primary: rgb(16 / 255, 185 / 255, 129 / 255),
  primaryDark: rgb(5 / 255, 150 / 255, 105 / 255),
  primaryLight: rgb(209 / 255, 250 / 255, 229 / 255),
  emerald50: rgb(236 / 255, 253 / 255, 245 / 255),
  secondary: rgb(22 / 255, 39 / 255, 54 / 255),
  accent: rgb(148 / 255, 163 / 255, 184 / 255),
  accentLight: rgb(241 / 255, 245 / 255, 249 / 255),
  white: rgb(1, 1, 1),
  text: rgb(0.09, 0.13, 0.18),
  gray: rgb(0.42, 0.45, 0.5),
  grayLight: rgb(0.97, 0.98, 0.98),
  border: rgb(0.9, 0.91, 0.92),
  muted: rgb(0.75, 0.8, 0.85),
};

const DRIVER_ORDER = [
  "missedCallRecovery",
  "noShowReduction",
  "outboundSms",
  "jobCloserUpsells",
  "timeSavings",
] as const;

type DriverKey = (typeof DRIVER_ORDER)[number];

type PdfContext = {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontBold: PDFFont;
  tradeLabel: string;
  pageNumber: number;
};

export function toPdfSafeText(text: string): string {
  return text
    .replace(/\u2192/g, "->")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u00d7/g, "x")
    .replace(/[\u2460-\u2473]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

function formatDriverMonthlyVolume(key: DriverKey, units: number): string {
  switch (key) {
    case "missedCallRecovery":
      return `${units} booked jobs/mo`;
    case "noShowReduction":
      return `${units} appts saved/mo`;
    case "outboundSms":
      return `${units} new jobs/mo`;
    case "jobCloserUpsells":
      return `${units} upsell jobs/mo`;
    case "timeSavings":
      return `${units} admin hrs/mo`;
  }
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

function textWidth(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(toPdfSafeText(text), size);
}

function wrapLines(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const safe = toPdfSafeText(text);
  const words = safe.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const word = words[i]!;
    const test = `${current} ${word}`;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

function drawRoundedRect(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: RGB,
  borderColor?: RGB,
  borderWidth = 0,
) {
  const r = Math.min(radius, width / 2, height / 2);
  const path = [
    `M ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height - r}`,
    `Q ${x + width} ${y + height} ${x + width - r} ${y + height}`,
    `L ${x + r} ${y + height}`,
    `Q ${x} ${y + height} ${x} ${y + height - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");
  page.drawSvgPath(path, { color, borderColor, borderWidth });
}

function addLinkAnnotation(
  ctx: PdfContext,
  x: number,
  y: number,
  width: number,
  height: number,
  url: string,
) {
  const annotation = ctx.pdf.context.register(
    ctx.pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, y, x + width, y + height],
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: PDFString.of(url),
      },
    }),
  );

  const annotsRef = ctx.page.node.get(PDFName.of("Annots"));
  if (annotsRef) {
    const annots = ctx.pdf.context.lookup(annotsRef);
    annots.push(annotation);
  } else {
    ctx.page.node.set(PDFName.of("Annots"), ctx.pdf.context.obj([annotation]));
  }
}

function drawLinkedText(
  ctx: PdfContext,
  text: string,
  x: number,
  y: number,
  url: string,
  opts: { size?: number; bold?: boolean; color?: RGB } = {},
) {
  const size = opts.size ?? 9;
  const font = opts.bold ? ctx.fontBold : ctx.font;
  const color = opts.color ?? BRAND.primary;
  ctx.page.drawText(toPdfSafeText(text), { x, y, size, font, color });
  addLinkAnnotation(ctx, x, y - 2, textWidth(font, text, size), size + 4, url);
}

class PdfLayout {
  constructor(
    private pdf: PDFDocument,
    private font: PDFFont,
    private fontBold: PDFFont,
    private tradeLabel: string,
    private logoBytes: Uint8Array | null,
  ) {}

  ctx!: PdfContext;

  start() {
    this.newPage(false);
  }

  private newPage(withMiniHeader: boolean) {
    const page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.ctx = {
      pdf: this.pdf,
      page,
      y: PAGE_HEIGHT - MARGIN,
      font: this.font,
      fontBold: this.fontBold,
      tradeLabel: this.tradeLabel,
      pageNumber: (this.ctx?.pageNumber ?? 0) + 1,
    };

    page.drawRectangle({
      x: 0,
      y: FOOTER_HEIGHT,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT - FOOTER_HEIGHT,
      color: BRAND.accentLight,
    });

    if (withMiniHeader) {
      this.drawMiniHeader();
    }
  }

  ensureSpace(needed: number) {
    if (this.ctx.y - needed < CONTENT_BOTTOM) {
      this.drawFooter();
      this.newPage(true);
    }
  }

  private drawMiniHeader() {
    const h = 40;
    this.ctx.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - h,
      width: PAGE_WIDTH,
      height: h,
      color: BRAND.white,
    });
    this.ctx.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 3,
      width: PAGE_WIDTH,
      height: 3,
      color: BRAND.primary,
    });
    this.ctx.page.drawText(toPdfSafeText("624 "), {
      x: MARGIN,
      y: PAGE_HEIGHT - 26,
      size: 11,
      font: this.fontBold,
      color: BRAND.secondary,
    });
    this.ctx.page.drawText(toPdfSafeText("Voice"), {
      x: MARGIN + textWidth(this.fontBold, "624 ", 11),
      y: PAGE_HEIGHT - 26,
      size: 11,
      font: this.fontBold,
      color: BRAND.primary,
    });
    this.ctx.y = PAGE_HEIGHT - h - 12;
  }

  drawFooter() {
    const { page } = this.ctx;
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: FOOTER_HEIGHT,
      color: BRAND.secondary,
    });
    page.drawRectangle({
      x: 0,
      y: FOOTER_HEIGHT - 2,
      width: PAGE_WIDTH,
      height: 2,
      color: BRAND.primary,
    });

    let x = MARGIN;
    const y = 16;
    drawLinkedText(this.ctx, "info@624voice.com", x, y, "mailto:info@624voice.com", {
      size: 9,
      color: BRAND.primary,
    });
    x += textWidth(this.font, "info@624voice.com", 9) + 10;
    page.drawText(toPdfSafeText("|"), { x, y, size: 9, font: this.font, color: BRAND.muted });
    x += 14;
    drawLinkedText(this.ctx, "624voice.com", x, y, "https://624voice.com", {
      size: 9,
      color: BRAND.primary,
    });

    const pageLabel = `Page ${this.ctx.pageNumber}`;
    page.drawText(toPdfSafeText(pageLabel), {
      x: PAGE_WIDTH - MARGIN - textWidth(this.font, pageLabel, 8),
      y: 16,
      size: 8,
      font: this.font,
      color: BRAND.muted,
    });
  }

  async drawCoverHeader() {
    const { ctx } = this;
    const cardTop = ctx.y;
    const cardHeight = 118;
    drawRoundedRect(
      ctx.page,
      MARGIN,
      cardTop - cardHeight,
      CONTENT_WIDTH,
      cardHeight,
      12,
      BRAND.white,
      BRAND.border,
      1,
    );

    if (this.logoBytes) {
      const logo = await ctx.pdf.embedPng(this.logoBytes);
      ctx.page.drawImage(logo, {
        x: (PAGE_WIDTH - 36) / 2,
        y: cardTop - 36,
        width: 36,
        height: 36,
      });
    }

    const brandY = cardTop - 52;
    const brand624 = "624 ";
    const brand624W = textWidth(ctx.fontBold, brand624, 14);
    const voiceW = textWidth(ctx.fontBold, "Voice", 14);
    const brandStart = (PAGE_WIDTH - brand624W - voiceW) / 2;
    ctx.page.drawText(toPdfSafeText(brand624), {
      x: brandStart,
      y: brandY,
      size: 14,
      font: ctx.fontBold,
      color: BRAND.secondary,
    });
    ctx.page.drawText(toPdfSafeText("Voice"), {
      x: brandStart + brand624W,
      y: brandY,
      size: 14,
      font: ctx.fontBold,
      color: BRAND.primary,
    });

    const titleW = textWidth(ctx.fontBold, PDF_TITLE, 13);
    ctx.page.drawText(toPdfSafeText(PDF_TITLE), {
      x: (PAGE_WIDTH - titleW) / 2,
      y: cardTop - 72,
      size: 13,
      font: ctx.fontBold,
      color: BRAND.secondary,
    });

    const subW = textWidth(ctx.font, PDF_SUBTITLE, 9);
    ctx.page.drawText(toPdfSafeText(PDF_SUBTITLE), {
      x: (PAGE_WIDTH - subW) / 2,
      y: cardTop - 88,
      size: 9,
      font: ctx.font,
      color: BRAND.gray,
    });

    const dateStr = new Date().toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    ctx.page.drawText(toPdfSafeText(dateStr), {
      x: (PAGE_WIDTH - textWidth(ctx.font, dateStr, 8)) / 2,
      y: cardTop - 102,
      size: 8,
      font: ctx.font,
      color: BRAND.accent,
    });

    ctx.y = cardTop - cardHeight - 14;
  }

  drawClientCard(lead: LeadInfo, tradeLabel: string, truckCount: number, monthlyCalls: number) {
    const h = 58;
    this.ensureSpace(h + 8);
    drawRoundedRect(
      this.ctx.page,
      MARGIN,
      this.ctx.y - h,
      CONTENT_WIDTH,
      h,
      10,
      BRAND.white,
      BRAND.border,
      1,
    );
    const top = this.ctx.y - 16;
    this.ctx.page.drawText(toPdfSafeText(`Prepared for ${formatLeadName(lead)}`), {
      x: MARGIN + 14,
      y: top,
      size: 10,
      font: this.ctx.fontBold,
      color: BRAND.secondary,
    });
    this.ctx.page.drawText(toPdfSafeText(lead.businessName), {
      x: MARGIN + 14,
      y: top - 14,
      size: 9,
      font: this.ctx.font,
      color: BRAND.text,
    });
    this.ctx.page.drawText(
      toPdfSafeText(
        `${tradeLabel}  ·  ${truckCount} trucks  ·  ${monthlyCalls.toLocaleString("en-US")} calls/mo`,
      ),
      { x: MARGIN + 14, y: top - 28, size: 8.5, font: this.ctx.font, color: BRAND.gray },
    );
    drawLinkedText(
      this.ctx,
      lead.email,
      MARGIN + 300,
      top - 14,
      `mailto:${lead.email}`,
      { size: 8.5, color: BRAND.primary },
    );
    this.ctx.page.drawText(toPdfSafeText(lead.phone), {
      x: MARGIN + 300,
      y: top - 28,
      size: 8.5,
      font: this.ctx.font,
      color: BRAND.gray,
    });
    this.ctx.y -= h + 12;
  }

  drawModerateHero(
    moderate: RoiResult,
    tradeLabel: string,
    truckCount: number,
    monthlyCalls: number,
  ) {
    const h = 96;
    this.ensureSpace(h + 10);
    drawRoundedRect(
      this.ctx.page,
      MARGIN,
      this.ctx.y - h,
      CONTENT_WIDTH,
      h,
      12,
      BRAND.emerald50,
      BRAND.primary,
      1.5,
    );

    const label = "MODERATE ESTIMATE";
    this.ctx.page.drawText(toPdfSafeText(label), {
      x: (PAGE_WIDTH - textWidth(this.ctx.fontBold, label, 8)) / 2,
      y: this.ctx.y - 22,
      size: 8,
      font: this.ctx.fontBold,
      color: BRAND.accent,
    });

    const amount = formatCurrency(moderate.totalAnnualBenefit);
    const prefix = "You're missing about ";
    const suffix = "+ every year";
    const fullW =
      textWidth(this.ctx.fontBold, prefix, 16) +
      textWidth(this.ctx.fontBold, amount, 16) +
      textWidth(this.ctx.fontBold, suffix, 16);
    let x = (PAGE_WIDTH - fullW) / 2;
    const y = this.ctx.y - 46;
    this.ctx.page.drawText(toPdfSafeText(prefix), {
      x,
      y,
      size: 16,
      font: this.ctx.fontBold,
      color: BRAND.secondary,
    });
    x += textWidth(this.ctx.fontBold, prefix, 16);
    this.ctx.page.drawText(toPdfSafeText(amount), {
      x,
      y,
      size: 16,
      font: this.ctx.fontBold,
      color: BRAND.primary,
    });
    x += textWidth(this.ctx.fontBold, amount, 16);
    this.ctx.page.drawText(toPdfSafeText(suffix), {
      x,
      y,
      size: 16,
      font: this.ctx.fontBold,
      color: BRAND.secondary,
    });

    const sub = `${tradeLabel} · ${truckCount} trucks · ${monthlyCalls.toLocaleString("en-US")} calls/mo`;
    this.ctx.page.drawText(toPdfSafeText(sub), {
      x: (PAGE_WIDTH - textWidth(this.ctx.font, sub, 9)) / 2,
      y: this.ctx.y - 66,
      size: 9,
      font: this.ctx.font,
      color: BRAND.gray,
    });

    this.ctx.page.drawText(toPdfSafeText("Revenue you're missing / year"), {
      x: (PAGE_WIDTH - textWidth(this.ctx.font, "Revenue you're missing / year", 8)) / 2,
      y: this.ctx.y - 80,
      size: 8,
      font: this.ctx.font,
      color: BRAND.gray,
    });

    this.ctx.y -= h + 14;
  }

  drawScenarioCards(scenarios: RoiResult[]) {
    this.drawHeading("Your Revenue Gap by Scenario", false);
    const cardGap = 8;
    const cardWidth = (CONTENT_WIDTH - cardGap * 2) / 3;
    const cardHeight = 148;
    this.ensureSpace(cardHeight + 6);
    const cardsTop = this.ctx.y;

    for (let i = 0; i < scenarios.length; i++) {
      const result = scenarios[i]!;
      const cardX = MARGIN + i * (cardWidth + cardGap);
      const isModerate = i === MODERATE_INDEX;

      drawRoundedRect(
        this.ctx.page,
        cardX,
        cardsTop - cardHeight,
        cardWidth,
        cardHeight,
        10,
        isModerate ? BRAND.emerald50 : BRAND.white,
        isModerate ? BRAND.primary : BRAND.border,
        isModerate ? 2 : 1,
      );

      this.ctx.page.drawText(toPdfSafeText(SCENARIOS[i]!.toUpperCase()), {
        x: cardX + 10,
        y: cardsTop - 18,
        size: 7.5,
        font: this.ctx.fontBold,
        color: BRAND.accent,
      });
      const rangeLabel =
        i === 0 ? SCENARIO_LABELS[i]! : `And up to ${SCENARIO_LABELS[i]!}`;
      this.ctx.page.drawText(toPdfSafeText(rangeLabel), {
        x: cardX + 10,
        y: cardsTop - 30,
        size: 7,
        font: this.ctx.font,
        color: BRAND.gray,
      });
      this.ctx.page.drawText(toPdfSafeText(formatCurrency(result.totalAnnualBenefit)), {
        x: cardX + 10,
        y: cardsTop - 50,
        size: 13,
        font: this.ctx.fontBold,
        color: BRAND.secondary,
      });
      this.ctx.page.drawText(toPdfSafeText("Revenue you're missing / year"), {
        x: cardX + 10,
        y: cardsTop - 62,
        size: 6.5,
        font: this.ctx.font,
        color: BRAND.gray,
      });

      this.ctx.page.drawLine({
        start: { x: cardX + 10, y: cardsTop - 70 },
        end: { x: cardX + cardWidth - 10, y: cardsTop - 70 },
        thickness: 0.5,
        color: BRAND.border,
      });

      this.ctx.page.drawText(toPdfSafeText("Slipping away right now"), {
        x: cardX + 10,
        y: cardsTop - 82,
        size: 6.5,
        font: this.ctx.fontBold,
        color: BRAND.secondary,
      });
      this.ctx.page.drawText(
        toPdfSafeText(`${formatCurrency(getSlippingAwayAnnual(result.drivers))}/yr`),
        { x: cardX + 10, y: cardsTop - 94, size: 7.5, font: this.ctx.fontBold, color: BRAND.primary },
      );
      this.ctx.page.drawText(toPdfSafeText("Missed-Call Recovery + No-Show Reduction"), {
        x: cardX + 10,
        y: cardsTop - 104,
        size: 5.5,
        font: this.ctx.font,
        color: BRAND.gray,
        maxWidth: cardWidth - 16,
      });

      this.ctx.page.drawText(toPdfSafeText("Untapped upside"), {
        x: cardX + 10,
        y: cardsTop - 118,
        size: 6.5,
        font: this.ctx.fontBold,
        color: BRAND.secondary,
      });
      this.ctx.page.drawText(
        toPdfSafeText(`${formatCurrency(getUntappedUpsideAnnual(result.drivers))}/yr`),
        { x: cardX + 10, y: cardsTop - 130, size: 7.5, font: this.ctx.fontBold, color: BRAND.primary },
      );
      this.ctx.page.drawText(
        toPdfSafeText("Outbound Campaigns + Job-Closer Upsells + Time Savings"),
        { x: cardX + 10, y: cardsTop - 140, size: 5.5, font: this.ctx.font, color: BRAND.gray, maxWidth: cardWidth - 16 },
      );
    }

    this.ctx.y = cardsTop - cardHeight - 14;
  }

  drawValueDriversTable(moderate: RoiResult) {
    this.drawHeading("Value Drivers (Moderate Scenario)", false);
    const rowHeight = 20;
    const tableTop = this.ctx.y;
    this.ensureSpace(rowHeight * 6 + 4);

    drawRoundedRect(
      this.ctx.page,
      MARGIN,
      tableTop - rowHeight,
      CONTENT_WIDTH,
      rowHeight,
      8,
      BRAND.secondary,
    );
    const cols = [
      ["Driver", MARGIN + 12],
      ["Monthly Volume", MARGIN + 230],
      ["Annual Value", MARGIN + 390],
    ] as const;
    for (const [label, x] of cols) {
      this.ctx.page.drawText(toPdfSafeText(label), {
        x,
        y: tableTop - 14,
        size: 8,
        font: this.ctx.fontBold,
        color: BRAND.white,
      });
    }

    let tableY = tableTop - rowHeight;
    for (let i = 0; i < DRIVER_ORDER.length; i++) {
      const key = DRIVER_ORDER[i]!;
      const driver = moderate.drivers[key];
      tableY -= rowHeight;
      drawRoundedRect(
        this.ctx.page,
        MARGIN,
        tableY,
        CONTENT_WIDTH,
        rowHeight,
        0,
        i % 2 === 0 ? BRAND.white : BRAND.grayLight,
      );
      this.ctx.page.drawText(toPdfSafeText(driver.label), {
        x: MARGIN + 12,
        y: tableY + 6,
        size: 8,
        font: this.ctx.fontBold,
        color: BRAND.text,
      });
      this.ctx.page.drawText(toPdfSafeText(formatDriverMonthlyVolume(key, driver.monthlyUnits)), {
        x: MARGIN + 230,
        y: tableY + 6,
        size: 7.5,
        font: this.ctx.font,
        color: BRAND.gray,
      });
      this.ctx.page.drawText(toPdfSafeText(formatCurrency(driver.annualValue)), {
        x: MARGIN + 390,
        y: tableY + 6,
        size: 8,
        font: this.ctx.fontBold,
        color: BRAND.primary,
      });
    }
    this.ctx.y = tableY - 16;
  }

  drawGuarantee() {
    const h = 96;
    this.ensureSpace(h + 10);
    const boxBottom = this.ctx.y - h;
    drawRoundedRect(
      this.ctx.page,
      MARGIN,
      boxBottom,
      CONTENT_WIDTH,
      h,
      12,
      BRAND.primaryLight,
      BRAND.primary,
      1,
    );

    const title = "90-Day Results Guarantee";
    this.ctx.page.drawText(toPdfSafeText("90-Day "), {
      x: (PAGE_WIDTH - textWidth(this.ctx.fontBold, title, 12)) / 2,
      y: this.ctx.y - 24,
      size: 12,
      font: this.ctx.fontBold,
      color: BRAND.secondary,
    });
    this.ctx.page.drawText(toPdfSafeText("Results Guarantee"), {
      x:
        (PAGE_WIDTH - textWidth(this.ctx.fontBold, title, 12)) / 2 +
        textWidth(this.ctx.fontBold, "90-Day ", 12),
      y: this.ctx.y - 24,
      size: 12,
      font: this.ctx.fontBold,
      color: BRAND.primary,
    });

    const bodyLines = wrapLines(this.ctx.font, GUARANTEE_BODY, 9, CONTENT_WIDTH - 40);
    let lineY = this.ctx.y - 42;
    for (const line of bodyLines) {
      const w = textWidth(this.ctx.font, line, 9);
      this.ctx.page.drawText(toPdfSafeText(line), {
        x: (PAGE_WIDTH - w) / 2,
        y: lineY,
        size: 9,
        font: this.ctx.font,
        color: BRAND.text,
      });
      lineY -= 12;
    }

    const footLines = wrapLines(this.ctx.font, GUARANTEE_FOOTNOTE, 8.5, CONTENT_WIDTH - 40);
    for (const line of footLines) {
      const w = textWidth(this.ctx.font, line, 8.5);
      this.ctx.page.drawText(toPdfSafeText(line), {
        x: (PAGE_WIDTH - w) / 2,
        y: lineY,
        size: 8.5,
        font: this.ctx.font,
        color: BRAND.gray,
      });
      lineY -= 11;
    }

    this.ctx.y = boxBottom - 14;
  }

  drawHeading(title: string, withDividerAfter = true) {
    this.ensureSpace(24);
    this.ctx.page.drawText(toPdfSafeText(title), {
      x: MARGIN,
      y: this.ctx.y,
      size: 12,
      font: this.ctx.fontBold,
      color: BRAND.secondary,
    });
    this.ctx.y -= 16;
    if (withDividerAfter) {
      this.drawDivider();
    }
  }

  drawSectionHeading(title: string) {
    this.ensureSpace(28);
    this.ctx.page.drawText(toPdfSafeText(title), {
      x: MARGIN,
      y: this.ctx.y,
      size: 10,
      font: this.ctx.fontBold,
      color: BRAND.secondary,
    });
    this.ctx.y -= 14;
  }

  drawSubheading(title: string) {
    this.ensureSpace(18);
    this.ctx.page.drawText(toPdfSafeText(title), {
      x: MARGIN,
      y: this.ctx.y,
      size: 9,
      font: this.ctx.fontBold,
      color: BRAND.primary,
    });
    this.ctx.y -= 12;
  }

  drawParagraph(text: string, size = 9, gap = 8) {
    const lines = wrapLines(this.ctx.font, text, size, CONTENT_WIDTH);
    const lineHeight = size * 1.45;
    this.ensureSpace(lines.length * lineHeight + gap);
    for (const line of lines) {
      this.ctx.page.drawText(toPdfSafeText(line), {
        x: MARGIN,
        y: this.ctx.y,
        size,
        font: this.ctx.font,
        color: BRAND.text,
      });
      this.ctx.y -= lineHeight;
    }
    this.ctx.y -= gap;
  }

  drawDivider() {
    this.ensureSpace(14);
    this.ctx.page.drawLine({
      start: { x: MARGIN, y: this.ctx.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.ctx.y },
      thickness: 0.75,
      color: BRAND.border,
    });
    this.ctx.y -= 14;
  }

  drawNarrativeSections() {
    for (const section of NARRATIVE_SECTIONS) {
      this.drawSectionHeading(section.title);
      for (const paragraph of section.paragraphs) {
        this.drawParagraph(paragraph);
      }
      if (section.subsections) {
        for (const sub of section.subsections) {
          this.drawSubheading(sub.title);
          for (const paragraph of sub.paragraphs) {
            this.drawParagraph(paragraph);
          }
        }
      }
      this.drawDivider();
    }
  }

  drawBookButton(url: string) {
    const label = BOOK_DEMO_LABEL;
    const fontSize = 13;
    const padX = 22;
    const padY = 11;
    const labelWidth = textWidth(this.ctx.fontBold, label, fontSize);
    const buttonWidth = labelWidth + padX * 2;
    const buttonHeight = fontSize + padY * 2;
    const buttonX = MARGIN + 18;
    const buttonY = this.ctx.y - buttonHeight;
    this.ensureSpace(buttonHeight + 8);

    drawRoundedRect(
      this.ctx.page,
      buttonX + 1,
      buttonY - 2,
      buttonWidth,
      buttonHeight,
      8,
      rgb(0.06, 0.73, 0.51),
      undefined,
      0,
    );
    drawRoundedRect(
      this.ctx.page,
      buttonX,
      buttonY,
      buttonWidth,
      buttonHeight,
      8,
      BRAND.primary,
    );

    this.ctx.page.drawText(toPdfSafeText(label), {
      x: buttonX + padX,
      y: buttonY + padY,
      size: fontSize,
      font: this.ctx.fontBold,
      color: BRAND.white,
    });

    addLinkAnnotation(this.ctx, buttonX, buttonY, buttonWidth, buttonHeight, url);
    this.ctx.y = buttonY - 10;
  }

  finish() {
    this.drawFooter();
  }
}

export async function buildRoiPdfDocument(input: {
  trade: TradeKey;
  truckCount: number;
  monthlyCalls: number;
  lead: LeadInfo;
  scenarios: RoiResult[];
}): Promise<Uint8Array> {
  const { trade, truckCount, monthlyCalls, lead, scenarios } = input;
  const tradeLabel = TRADES[trade].label;
  const moderate = scenarios[MODERATE_INDEX]!;
  const logoBytes = loadLogoBytes();

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const layout = new PdfLayout(pdf, font, fontBold, tradeLabel, logoBytes);
  layout.start();

  await layout.drawCoverHeader();
  layout.drawClientCard(lead, tradeLabel, truckCount, monthlyCalls);
  layout.drawModerateHero(moderate, tradeLabel, truckCount, monthlyCalls);
  layout.drawScenarioCards(scenarios);
  layout.drawValueDriversTable(moderate);
  layout.drawGuarantee();
  layout.drawNarrativeSections();

  layout.drawDivider();
  layout.drawSectionHeading(NEXT_STEPS_TITLE);
  for (const paragraph of NEXT_STEPS_PARAGRAPHS) {
    layout.drawParagraph(paragraph, 9, 6);
  }
  layout.drawBookButton(BOOK_MEETING_URL);

  layout.finish();
  return pdf.save();
}
