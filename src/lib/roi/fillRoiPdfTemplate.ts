import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import type { LeadInfo } from "~/lib/lead/validateLead";
import type { RoiResult } from "~/lib/roi/computeRoi";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import {
  getSlippingAwayAnnual,
  getUntappedUpsideAnnual,
} from "~/lib/roi/formatAssumptions";
import { SCENARIO_LABELS } from "~/lib/roi/scenarioDisplay";
import { TRADES, type TradeKey } from "~/lib/roi/roiModel";

const TEMPLATE_FILENAME = "624-voice-roi-report-template.pdf";
const MODERATE_INDEX = 1;
const LOGO_SIZE = 36;
const LOGO_X = 83;
const LOGO_Y = 728.5;

const DRIVER_KEYS = [
  "missedCallRecovery",
  "noShowReduction",
  "outboundSms",
  "jobCloserUpsells",
  "timeSavings",
] as const;

type DriverKey = (typeof DRIVER_KEYS)[number];

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

async function drawCoverLogo(pdf: PDFDocument) {
  const logoBytes = loadLogoBytes();
  if (!logoBytes) return;

  const logo = await pdf.embedPng(logoBytes);
  pdf.getPage(0).drawImage(logo, {
    x: LOGO_X,
    y: LOGO_Y,
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  });
}

function formatReportDate(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatScenarioRange(index: number): string {
  return SCENARIO_LABELS[index]!.replace(/\u2013/g, "-");
}

function formatAnnualSuffix(value: number): string {
  return `${formatCurrency(value)}/yr`;
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

function setText(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string) {
  form.getTextField(name).setText(value);
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

  setText(form, "reportDate", formatReportDate());
  setText(form, "firstName", lead.firstName);
  setText(form, "lastName", lead.lastName);
  setText(form, "businessName", lead.businessName);
  setText(form, "email", lead.email);
  setText(form, "phone", lead.phone);
  setText(form, "trade", tradeLabel);
  setText(form, "truckCount", String(truckCount));
  setText(form, "monthlyCalls", String(monthlyCalls));
  setText(
    form,
    "heroContextLine",
    `${tradeLabel} · ${truckCount} trucks · ${monthlyCalls} calls/mo`,
  );
  setText(form, "moderateTotal", formatCurrency(moderate.totalAnnualBenefit));

  for (let i = 0; i < scenarios.length; i++) {
    const result = scenarios[i]!;
    const prefix = ["conservative", "moderate", "aggressive"][i]!;

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

  DRIVER_KEYS.forEach((key, index) => {
    const driver = moderate.drivers[key];
    const n = index + 1;

    setText(form, `driver${n}Name`, driver.label);
    setText(
      form,
      `driver${n}Volume`,
      formatDriverMonthlyVolume(key, driver.monthlyUnits),
    );
    setText(form, `driver${n}Annual`, formatCurrency(driver.annualValue));
  });

  form.updateFieldAppearances();
  form.flatten();

  await drawCoverLogo(pdf);

  return pdf.save();
}
