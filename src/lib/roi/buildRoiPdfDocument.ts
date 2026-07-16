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
  getAssumptionLines,
  SCENARIO_LABELS,
} from "~/lib/roi/formatAssumptions";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import { SCENARIOS, TRADES, type TradeKey } from "~/lib/roi/roiModel";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const FOOTER_HEIGHT = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = FOOTER_HEIGHT;

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
};

export function toPdfSafeText(text: string): string {
  return text
    .replace(/\u2192/g, "->")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u00d7/g, "x")
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
  const safe = toPdfSafeText(text);
  ctx.page.drawText(safe, { x, y, size, font, color });
  addLinkAnnotation(ctx, x, y - 2, textWidth(font, text, size), size + 4, url);
}

async function drawBrandHeader(ctx: PdfContext, logoBytes: Uint8Array | null) {
  const headerHeight = 72;
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - headerHeight,
    width: PAGE_WIDTH,
    height: headerHeight,
    color: BRAND.white,
  });
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - headerHeight,
    width: PAGE_WIDTH,
    height: 3,
    color: BRAND.primary,
  });
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - headerHeight,
    width: PAGE_WIDTH,
    height: headerHeight,
    borderColor: BRAND.border,
    borderWidth: 0,
  });

  if (logoBytes) {
    const logo = await ctx.pdf.embedPng(logoBytes);
    ctx.page.drawImage(logo, {
      x: MARGIN,
      y: PAGE_HEIGHT - headerHeight + 18,
      width: 36,
      height: 36,
    });
  }

  ctx.page.drawText(toPdfSafeText("624 "), {
    x: MARGIN + 44,
    y: PAGE_HEIGHT - 40,
    size: 18,
    font: ctx.fontBold,
    color: BRAND.secondary,
  });
  const voiceX = MARGIN + 44 + textWidth(ctx.fontBold, "624 ", 18);
  ctx.page.drawText(toPdfSafeText("Voice"), {
    x: voiceX,
    y: PAGE_HEIGHT - 40,
    size: 18,
    font: ctx.fontBold,
    color: BRAND.primary,
  });
  ctx.page.drawText(toPdfSafeText("Revenue Gap Report"), {
    x: MARGIN + 44,
    y: PAGE_HEIGHT - 56,
    size: 10,
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
    x: PAGE_WIDTH - MARGIN - textWidth(ctx.font, dateStr, 9),
    y: PAGE_HEIGHT - 48,
    size: 9,
    font: ctx.font,
    color: BRAND.accent,
  });

  ctx.y = PAGE_HEIGHT - headerHeight - 20;
}

function drawMiniHeader(ctx: PdfContext, tradeLabel: string) {
  const headerHeight = 44;
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - headerHeight,
    width: PAGE_WIDTH,
    height: headerHeight,
    color: BRAND.secondary,
  });
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 3,
    width: PAGE_WIDTH,
    height: 3,
    color: BRAND.primary,
  });

  ctx.page.drawText(toPdfSafeText("624 "), {
    x: MARGIN,
    y: PAGE_HEIGHT - 28,
    size: 11,
    font: ctx.fontBold,
    color: BRAND.white,
  });
  ctx.page.drawText(toPdfSafeText("Voice"), {
    x: MARGIN + textWidth(ctx.fontBold, "624 ", 11),
    y: PAGE_HEIGHT - 28,
    size: 11,
    font: ctx.fontBold,
    color: BRAND.primary,
  });
  ctx.page.drawText(toPdfSafeText("  |  Revenue Gap Report"), {
    x: MARGIN + textWidth(ctx.fontBold, "624 Voice", 11),
    y: PAGE_HEIGHT - 28,
    size: 10,
    font: ctx.font,
    color: BRAND.muted,
  });
  ctx.page.drawText(toPdfSafeText(tradeLabel), {
    x: PAGE_WIDTH - MARGIN - textWidth(ctx.font, tradeLabel, 9),
    y: PAGE_HEIGHT - 28,
    size: 9,
    font: ctx.font,
    color: BRAND.muted,
  });
  ctx.y = PAGE_HEIGHT - headerHeight - 16;
}

function drawPageFooter(ctx: PdfContext) {
  ctx.page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: FOOTER_HEIGHT,
    color: BRAND.secondary,
  });
  ctx.page.drawRectangle({
    x: 0,
    y: FOOTER_HEIGHT - 2,
    width: PAGE_WIDTH,
    height: 2,
    color: BRAND.primary,
  });

  let x = MARGIN;
  const y = 14;
  drawLinkedText(ctx, "info@624voice.com", x, y, "mailto:info@624voice.com", {
    size: 9,
    color: BRAND.primary,
  });
  x += textWidth(ctx.font, "info@624voice.com", 9) + 10;
  ctx.page.drawText(toPdfSafeText("|"), { x, y, size: 9, font: ctx.font, color: BRAND.muted });
  x += 14;
  drawLinkedText(ctx, "624voice.com", x, y, "https://624voice.com", {
    size: 9,
    color: BRAND.primary,
  });
}

function drawSectionTitle(ctx: PdfContext, title: string) {
  ctx.page.drawText(toPdfSafeText(title.toUpperCase()), {
    x: MARGIN,
    y: ctx.y,
    size: 8,
    font: ctx.fontBold,
    color: BRAND.accent,
  });
  ctx.y -= 14;
  ctx.page.drawText(toPdfSafeText(title), {
    x: MARGIN,
    y: ctx.y,
    size: 13,
    font: ctx.fontBold,
    color: BRAND.secondary,
  });
  ctx.y -= 18;
}

function drawBookDemoButton(ctx: PdfContext, url: string) {
  const label = "Book a Demo";
  const fontSize = 14;
  const padX = 20;
  const padY = 12;
  const labelWidth = textWidth(ctx.fontBold, label, fontSize);
  const buttonWidth = labelWidth + padX * 2;
  const buttonHeight = fontSize + padY * 2;
  const buttonX = MARGIN + 20;
  const buttonY = ctx.y - buttonHeight;

  drawRoundedRect(
    ctx.page,
    buttonX + 1,
    buttonY - 2,
    buttonWidth,
    buttonHeight,
    8,
    rgb(0.88, 0.9, 0.92),
  );
  drawRoundedRect(ctx.page, buttonX, buttonY, buttonWidth, buttonHeight, 8, BRAND.primary);

  ctx.page.drawText(toPdfSafeText(label), {
    x: buttonX + padX,
    y: buttonY + padY + 1,
    size: fontSize,
    font: ctx.fontBold,
    color: BRAND.white,
  });

  addLinkAnnotation(ctx, buttonX, buttonY, buttonWidth, buttonHeight, url);
  ctx.y = buttonY - 12;
}

function buildPage1(
  ctx: PdfContext,
  input: {
    tradeLabel: string;
    truckCount: number;
    monthlyCalls: number;
    lead: LeadInfo;
    scenarios: RoiResult[];
    conservative: RoiResult;
    logoBytes: Uint8Array | null;
  },
) {
  const { tradeLabel, truckCount, monthlyCalls, lead, scenarios, conservative } =
    input;

  drawBrandHeader(ctx, input.logoBytes);

  // Client info card
  const infoHeight = 64;
  drawRoundedRect(
    ctx.page,
    MARGIN,
    ctx.y - infoHeight,
    CONTENT_WIDTH,
    infoHeight,
    10,
    BRAND.accentLight,
    BRAND.border,
    1,
  );
  const infoTop = ctx.y - 16;
  ctx.page.drawText(toPdfSafeText(`Prepared for ${formatLeadName(lead)}`), {
    x: MARGIN + 16,
    y: infoTop,
    size: 11,
    font: ctx.fontBold,
    color: BRAND.secondary,
  });
  ctx.page.drawText(toPdfSafeText(lead.businessName), {
    x: MARGIN + 16,
    y: infoTop - 16,
    size: 10,
    font: ctx.font,
    color: BRAND.text,
  });
  ctx.page.drawText(
    toPdfSafeText(
      `${tradeLabel}  ·  ${truckCount} trucks  ·  ${monthlyCalls.toLocaleString("en-US")} calls/mo`,
    ),
    { x: MARGIN + 16, y: infoTop - 30, size: 9, font: ctx.font, color: BRAND.gray },
  );
  ctx.page.drawText(toPdfSafeText(lead.phone), {
    x: MARGIN + 320,
    y: infoTop - 16,
    size: 9,
    font: ctx.font,
    color: BRAND.gray,
  });
  drawLinkedText(
    ctx,
    lead.email,
    MARGIN + 320,
    infoTop - 30,
    `mailto:${lead.email}`,
    { size: 9, color: BRAND.primary },
  );

  ctx.y -= infoHeight + 16;

  // Hero conservative estimate (matches website card)
  const heroHeight = 92;
  drawRoundedRect(
    ctx.page,
    MARGIN,
    ctx.y - heroHeight,
    CONTENT_WIDTH,
    heroHeight,
    12,
    BRAND.emerald50,
    rgb(16 / 255, 185 / 255, 129 / 255),
    1,
  );

  const heroLabel = "CONSERVATIVE ESTIMATE";
  const heroLabelW = textWidth(ctx.fontBold, heroLabel, 8);
  ctx.page.drawText(toPdfSafeText(heroLabel), {
    x: (PAGE_WIDTH - heroLabelW) / 2,
    y: ctx.y - 22,
    size: 8,
    font: ctx.fontBold,
    color: BRAND.accent,
  });

  const heroAmount = formatCurrency(conservative.totalAnnualBenefit);
  const heroLine = `You're missing about ${heroAmount}+ every year`;
  const heroLineW = textWidth(ctx.fontBold, heroLine, 17);
  ctx.page.drawText(toPdfSafeText("You're missing about "), {
    x: (PAGE_WIDTH - heroLineW) / 2,
    y: ctx.y - 46,
    size: 17,
    font: ctx.fontBold,
    color: BRAND.secondary,
  });
  const prefixW = textWidth(ctx.fontBold, "You're missing about ", 17);
  ctx.page.drawText(toPdfSafeText(`${heroAmount}+`), {
    x: (PAGE_WIDTH - heroLineW) / 2 + prefixW,
    y: ctx.y - 46,
    size: 17,
    font: ctx.fontBold,
    color: BRAND.primary,
  });
  ctx.page.drawText(toPdfSafeText(" every year"), {
    x: (PAGE_WIDTH - heroLineW) / 2 + prefixW + textWidth(ctx.fontBold, `${heroAmount}+`, 17),
    y: ctx.y - 46,
    size: 17,
    font: ctx.fontBold,
    color: BRAND.secondary,
  });

  const sub = `${tradeLabel} · ${truckCount} trucks · ${monthlyCalls.toLocaleString("en-US")} calls/mo`;
  ctx.page.drawText(toPdfSafeText(sub), {
    x: (PAGE_WIDTH - textWidth(ctx.font, sub, 9)) / 2,
    y: ctx.y - 66,
    size: 9,
    font: ctx.font,
    color: BRAND.gray,
  });

  ctx.y -= heroHeight + 18;
  drawSectionTitle(ctx, "Annual Revenue Gap by Scenario");

  const cardGap = 10;
  const cardWidth = (CONTENT_WIDTH - cardGap * 2) / 3;
  const cardHeight = 104;
  const cardsTop = ctx.y;

  for (let i = 0; i < scenarios.length; i++) {
    const result = scenarios[i]!;
    const cardX = MARGIN + i * (cardWidth + cardGap);
    const isPrimary = i === 0;

    drawRoundedRect(
      ctx.page,
      cardX,
      cardsTop - cardHeight,
      cardWidth,
      cardHeight,
      10,
      isPrimary ? BRAND.emerald50 : BRAND.white,
      isPrimary ? BRAND.primary : BRAND.border,
      isPrimary ? 2 : 1,
    );

    ctx.page.drawText(toPdfSafeText(SCENARIOS[i]!), {
      x: cardX + 12,
      y: cardsTop - 20,
      size: 9,
      font: ctx.fontBold,
      color: BRAND.primary,
    });
    ctx.page.drawText(toPdfSafeText(SCENARIO_LABELS[i]!), {
      x: cardX + 12,
      y: cardsTop - 32,
      size: 8,
      font: ctx.font,
      color: BRAND.gray,
    });
    ctx.page.drawText(toPdfSafeText(formatCurrency(result.totalAnnualBenefit)), {
      x: cardX + 12,
      y: cardsTop - 54,
      size: 15,
      font: ctx.fontBold,
      color: BRAND.secondary,
    });
    ctx.page.drawText(toPdfSafeText("per year"), {
      x: cardX + 12,
      y: cardsTop - 68,
      size: 8,
      font: ctx.font,
      color: BRAND.gray,
    });
    ctx.page.drawText(
      toPdfSafeText(`Slipping away: ${formatCurrency(getSlippingAwayAnnual(result.drivers))}`),
      { x: cardX + 12, y: cardsTop - 82, size: 7, font: ctx.font, color: BRAND.gray, maxWidth: cardWidth - 20 },
    );
    ctx.page.drawText(
      toPdfSafeText(`Upside: ${formatCurrency(getUntappedUpsideAnnual(result.drivers))}`),
      { x: cardX + 12, y: cardsTop - 94, size: 7, font: ctx.font, color: BRAND.gray, maxWidth: cardWidth - 20 },
    );
  }

  ctx.y = cardsTop - cardHeight - 18;
  drawSectionTitle(ctx, "Value Drivers (Moderate Scenario)");

  const moderate = scenarios[1]!;
  const tableTop = ctx.y;
  const rowHeight = 20;
  const colLabel = MARGIN;
  const colUnits = MARGIN + 248;
  const colValue = MARGIN + 392;

  drawRoundedRect(
    ctx.page,
    MARGIN,
    tableTop - rowHeight,
    CONTENT_WIDTH,
    rowHeight,
    8,
    BRAND.secondary,
  );
  for (const [label, x] of [
    ["Driver", colLabel + 12],
    ["Monthly Volume", colUnits + 8],
    ["Annual Value", colValue + 8],
  ] as const) {
    ctx.page.drawText(toPdfSafeText(label), {
      x,
      y: tableTop - 14,
      size: 8,
      font: ctx.fontBold,
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
      y: tableY + 6,
      size: 8.5,
      font: ctx.fontBold,
      color: BRAND.text,
    });
    ctx.page.drawText(toPdfSafeText(formatDriverMonthlyVolume(key, driver.monthlyUnits)), {
      x: colUnits + 8,
      y: tableY + 6,
      size: 8,
      font: ctx.font,
      color: BRAND.gray,
    });
    ctx.page.drawText(toPdfSafeText(formatCurrency(driver.annualValue)), {
      x: colValue + 8,
      y: tableY + 6,
      size: 8.5,
      font: ctx.fontBold,
      color: BRAND.primary,
    });
  }

  drawPageFooter(ctx);
}

function buildPage2(
  ctx: PdfContext,
  input: { trade: TradeKey; tradeLabel: string },
) {
  const { trade, tradeLabel } = input;
  drawMiniHeader(ctx, tradeLabel);

  // Guarantee box (matches website)
  const guaranteeHeight = 88;
  drawRoundedRect(
    ctx.page,
    MARGIN,
    ctx.y - guaranteeHeight,
    CONTENT_WIDTH,
    guaranteeHeight,
    12,
    BRAND.primaryLight,
    rgb(16 / 255, 185 / 255, 129 / 255),
    1,
  );

  const guaranteeTitle = "90-Day Results Guarantee";
  ctx.page.drawText(toPdfSafeText("90-Day "), {
    x: (PAGE_WIDTH - textWidth(ctx.fontBold, guaranteeTitle, 13)) / 2,
    y: ctx.y - 24,
    size: 13,
    font: ctx.fontBold,
    color: BRAND.secondary,
  });
  ctx.page.drawText(toPdfSafeText("Results Guarantee"), {
    x:
      (PAGE_WIDTH - textWidth(ctx.fontBold, guaranteeTitle, 13)) / 2 +
      textWidth(ctx.fontBold, "90-Day ", 13),
    y: ctx.y - 24,
    size: 13,
    font: ctx.fontBold,
    color: BRAND.primary,
  });

  const guaranteeBody =
    "We guarantee you recover at least our service investment in booked service-visit revenue within 90 days of go-live - or we keep working, for free, until you do.";
  ctx.page.drawText(toPdfSafeText(guaranteeBody), {
    x: MARGIN + 20,
    y: ctx.y - 44,
    size: 9,
    font: ctx.font,
    color: BRAND.text,
    maxWidth: CONTENT_WIDTH - 40,
    lineHeight: 12,
  });
  ctx.page.drawText(
    toPdfSafeText("If we don't perform, you don't pay beyond the Results Engagement Period."),
    {
      x: MARGIN + 20,
      y: ctx.y - 72,
      size: 9,
      font: ctx.font,
      color: BRAND.gray,
      maxWidth: CONTENT_WIDTH - 40,
    },
  );

  ctx.y -= guaranteeHeight + 16;
  drawSectionTitle(ctx, "Methodology & Assumptions");

  const lines = getAssumptionLines(trade);
  const mid = Math.ceil(lines.length / 2);
  const colWidth = (CONTENT_WIDTH - 16) / 2;
  let leftY = ctx.y;
  let rightY = ctx.y;

  for (let i = 0; i < lines.length; i++) {
    const isLeft = i < mid;
    const x = isLeft ? MARGIN : MARGIN + colWidth + 16;
    const y = isLeft ? leftY : rightY;
    ctx.page.drawText(toPdfSafeText(`• ${lines[i]}`), {
      x,
      y,
      size: 8,
      font: ctx.font,
      color: BRAND.gray,
      maxWidth: colWidth - 8,
      lineHeight: 10,
    });
    const used = 12;
    if (isLeft) leftY -= used;
    else rightY -= used;
  }

  ctx.y = Math.min(leftY, rightY) - 12;

  // Next steps CTA panel
  const ctaHeight = 108;
  drawRoundedRect(
    ctx.page,
    MARGIN,
    ctx.y - ctaHeight,
    CONTENT_WIDTH,
    ctaHeight,
    12,
    BRAND.accentLight,
    BRAND.border,
    1,
  );

  ctx.page.drawText(toPdfSafeText("Next Steps"), {
    x: MARGIN + 20,
    y: ctx.y - 22,
    size: 13,
    font: ctx.fontBold,
    color: BRAND.secondary,
  });
  ctx.page.drawText(
    toPdfSafeText("Ready to recover this revenue? Book a personalized demo with our team."),
    {
      x: MARGIN + 20,
      y: ctx.y - 38,
      size: 10,
      font: ctx.font,
      color: BRAND.text,
      maxWidth: CONTENT_WIDTH - 40,
    },
  );

  ctx.y -= 52;
  drawBookDemoButton(ctx, BOOK_MEETING_URL);

  ctx.page.drawText(toPdfSafeText("Or email "), {
    x: MARGIN + 20,
    y: ctx.y,
    size: 9,
    font: ctx.font,
    color: BRAND.gray,
  });
  const orX = MARGIN + 20 + textWidth(ctx.font, "Or email ", 9);
  drawLinkedText(ctx, "info@624voice.com", orX, ctx.y, "mailto:info@624voice.com", {
    size: 9,
    color: BRAND.primary,
  });

  ctx.y -= 14;
  ctx.page.drawText(
    toPdfSafeText("624 Voice helps home services companies answer every call 24/7/365 on the first ring."),
    {
      x: MARGIN + 20,
      y: ctx.y,
      size: 8.5,
      font: ctx.font,
      color: BRAND.gray,
      maxWidth: CONTENT_WIDTH - 40,
    },
  );

  drawPageFooter(ctx);
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
  const conservative = scenarios[0]!;
  const logoBytes = loadLogoBytes();

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page1 = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const ctx1: PdfContext = {
    pdf,
    page: page1,
    y: PAGE_HEIGHT,
    font,
    fontBold,
  };

  buildPage1(ctx1, {
    tradeLabel,
    truckCount,
    monthlyCalls,
    lead,
    scenarios,
    conservative,
    logoBytes,
  });

  const page2 = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const ctx2: PdfContext = {
    pdf,
    page: page2,
    y: PAGE_HEIGHT,
    font,
    fontBold,
  };

  buildPage2(ctx2, { trade, tradeLabel });

  return pdf.save();
}
