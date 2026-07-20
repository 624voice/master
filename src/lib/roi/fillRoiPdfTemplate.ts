import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { BOOK_MEETING_PATH } from "~/config/features";
import type { LeadInfo } from "~/lib/lead/validateLead";
import type { RoiResult } from "~/lib/roi/computeRoi";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import {
  getSlippingAwayAnnual,
  getUntappedUpsideAnnual,
} from "~/lib/roi/formatAssumptions";
import { SCENARIO_LABELS } from "~/lib/roi/scenarioDisplay";
import { TRADES, tradeToSlug, type TradeKey } from "~/lib/roi/roiModel";

const TEMPLATE_FILENAME = "624-voice-revenue-gap-report.pdf";
const SITE_ORIGIN = "https://624voice.com";
const MODERATE_INDEX = 1;

type DriverKey =
  | "missedCallRecovery"
  | "noShowReduction"
  | "jobCloserUpsells"
  | "outboundSms"
  | "timeSavings";

const DRIVER_FIELD_ORDER: DriverKey[] = [
  "missedCallRecovery",
  "noShowReduction",
  "jobCloserUpsells",
  "outboundSms",
  "timeSavings",
];

function loadTemplateBytes(): Uint8Array {
  for (const path of [
    join(process.cwd(), "public", "templates", TEMPLATE_FILENAME),
    join(process.cwd(), "dist", "client", "templates", TEMPLATE_FILENAME),
  ]) {
    if (existsSync(path)) {
      return readFileSync(path);
    }
  }

  throw new Error("ROI PDF template not found");
}

function formatPreparedDate(): string {
  const dateStr = new Date().toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `Prepared ${dateStr}`;
}

function formatReportDate(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatReportId(trade: TradeKey, monthlyCalls: number): string {
  const compact = new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Chicago" })
    .replace(/-/g, "");
  const code = tradeToSlug(trade).slice(0, 3).toUpperCase();
  return `624-${compact}-${code}-${monthlyCalls}`;
}

function formatCompactK(value: number): string {
  const k = Math.round(value / 1000);
  return `$${k.toLocaleString("en-US")}K`;
}

function formatScenarioRange(index: number): string {
  return `~${SCENARIO_LABELS[index]!.replace(/^~/, "").replace(/\u2013/g, "-")} capture`;
}

function formatAnnualSuffix(value: number): string {
  return `${formatCurrency(value)}/yr`;
}

function formatDriverMonthlyVolume(key: DriverKey, units: number): string {
  switch (key) {
    case "missedCallRecovery":
      return `${units} booked jobs / mo`;
    case "noShowReduction":
      return `${units} appts saved / mo`;
    case "outboundSms":
      return `${units} new jobs / mo`;
    case "jobCloserUpsells":
      return `${units} upsell jobs / mo`;
    case "timeSavings":
      return `${units} admin hrs / mo`;
  }
}

function setText(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string) {
  form.getTextField(name).setText(value);
}

function addLinkAnnotation(
  pdf: PDFDocument,
  pageIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
  url: string,
) {
  const page = pdf.getPage(pageIndex);
  const annotation = pdf.context.register(
    pdf.context.obj({
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

  const annotsRef = page.node.get(PDFName.of("Annots"));
  if (annotsRef) {
    const annots = pdf.context.lookup(annotsRef);
    annots.push(annotation);
  } else {
    page.node.set(PDFName.of("Annots"), pdf.context.obj([annotation]));
  }
}

function addBookDemoLink(pdf: PDFDocument) {
  // "Book your demo" button on page 5 (fitz top-left y ~626-641 → pdf-lib bottom-left).
  addLinkAnnotation(pdf, 4, 118.5, 150.5, 98, 16, `${SITE_ORIGIN}${BOOK_MEETING_PATH}`);
}

export async function fillRoiPdfTemplate(input: {
  trade: TradeKey;
  truckCount: number;
  monthlyCalls: number;
  lead: LeadInfo;
  scenarios: RoiResult[];
}): Promise<Uint8Array> {
  const { trade, truckCount, monthlyCalls, lead, scenarios } = input;
  const tradeLabel = TRADES[trade].label;
  const moderate = scenarios[MODERATE_INDEX]!;

  const pdf = await PDFDocument.load(loadTemplateBytes());
  const form = pdf.getForm();

  setText(form, "reportDate", formatPreparedDate());
  setText(form, "firstName", lead.firstName);
  setText(form, "lastName", lead.lastName);
  setText(form, "businessName", lead.businessName);
  setText(form, "email", lead.email);
  setText(form, "phone", lead.phone);
  setText(form, "reportId", formatReportId(trade, monthlyCalls));
  setText(form, "trade", tradeLabel);
  setText(form, "truckCount", String(truckCount));
  setText(form, "monthlyCalls", String(monthlyCalls));
  setText(form, "moderateHeroTotal", formatCurrency(moderate.totalAnnualBenefit));
  setText(form, "heroTradePill", `${tradeLabel} trade`);
  setText(form, "heroTrucksPill", `${truckCount} trucks`);
  setText(form, "heroCallsPill", `${monthlyCalls.toLocaleString("en-US")} calls / mo`);

  const scenarioNames = ["Conservative", "Moderate", "Aggressive"] as const;
  for (let i = 0; i < scenarios.length; i++) {
    const result = scenarios[i]!;
    const prefix = ["conservative", "moderate", "aggressive"][i]!;

    setText(
      form,
      `summary${scenarioNames[i]}`,
      `${scenarioNames[i]!} · ${formatCompactK(result.totalAnnualBenefit)}`,
    );
    setText(form, `${prefix}Range`, formatScenarioRange(i));
    setText(form, `${prefix}Total`, formatCurrency(result.totalAnnualBenefit));
    setText(
      form,
      `${prefix}SlippingAway`,
      formatAnnualSuffix(getSlippingAwayAnnual(result.drivers)),
    );
    setText(
      form,
      `${prefix}Upside`,
      formatAnnualSuffix(getUntappedUpsideAnnual(result.drivers)),
    );
  }

  setText(form, "moderateImpactTotal", formatCurrency(moderate.totalAnnualBenefit));
  setText(form, "closingConservative", formatCompactK(scenarios[0]!.totalAnnualBenefit));
  setText(form, "closingModerate", formatCompactK(moderate.totalAnnualBenefit));
  setText(
    form,
    "closingAggressive",
    formatCompactK(scenarios[2]!.totalAnnualBenefit),
  );

  DRIVER_FIELD_ORDER.forEach((key, index) => {
    const driver = moderate.drivers[key];
    const n = index + 1;

    setText(
      form,
      `driver${n}Volume`,
      formatDriverMonthlyVolume(key, driver.monthlyUnits),
    );
    setText(form, `driver${n}Annual`, formatCurrency(driver.annualValue));
  });

  form.updateFieldAppearances();
  form.flatten();

  addBookDemoLink(pdf);

  return pdf.save();
}
