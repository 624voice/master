#!/usr/bin/env bun
/**
 * Instruction #9 QA: visual diff + model-updated renders.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildReportViewModel } from "../src/lib/report/buildReportViewModel.ts";
import { computeAllScenarios } from "../src/lib/roi/computeRoi.ts";
import { formatReportDate, formatReportId } from "../src/lib/report/formatReportMeta.ts";
import {
  buildGoldStandardReportViewModel,
  GOLD_STANDARD_LEAD,
  GOLD_STANDARD_REPORT_DATE,
} from "../src/lib/report/__fixtures__/goldStandard.ts";
import { NORTHSTAR_LEAD } from "../src/lib/report/__fixtures__/northstar.ts";
import { renderReportHtml } from "../src/server/report/renderReportHtml.server.tsx";
import { renderReportPdf } from "../src/server/report/renderReportPdf.server.ts";

const outDir = join(process.cwd(), "artifacts/report-qa-i9");
const i8Dir = join(process.cwd(), "artifacts/report-qa-i8");
const goldPdfPath = join(process.cwd(), "design-reference-v3/gold-standard.pdf");
const DPI = 192;

mkdirSync(outDir, { recursive: true });

function readAe(path) {
  return existsSync(path) ? readFileSync(path, "utf8").trim() : null;
}

const beforeAe = {};
for (let p = 1; p <= 4; p++) {
  beforeAe[p] = readAe(join(i8Dir, `compare-page-${p}-ae.txt`));
}

function buildCase(input) {
  const scenarios = computeAllScenarios(input.trade, input.monthlyCalls);
  return buildReportViewModel({
    ...input,
    scenarios,
    reportId: formatReportId(
      input.trade,
      input.monthlyCalls,
      input.reportDate ?? GOLD_STANDARD_REPORT_DATE,
    ),
    reportDate: formatReportDate(input.reportDate ?? GOLD_STANDARD_REPORT_DATE),
  });
}

const cases = {
  goldStandard: buildGoldStandardReportViewModel(),
  roofers200: buildCase({
    trade: "Roofers",
    truckCount: 10,
    monthlyCalls: 200,
    lead: NORTHSTAR_LEAD,
    reportDate: GOLD_STANDARD_REPORT_DATE,
  }),
  electriciansSmall: buildCase({
    trade: "Electricians",
    truckCount: 1,
    monthlyCalls: 30,
    lead: NORTHSTAR_LEAD,
  }),
  longBusinessName: buildCase({
    trade: "Plumbers",
    truckCount: 15,
    monthlyCalls: 900,
    lead: { ...GOLD_STANDARD_LEAD, businessName: "A".repeat(40) },
    reportDate: GOLD_STANDARD_REPORT_DATE,
  }),
  longEmail: buildCase({
    trade: "Plumbers",
    truckCount: 15,
    monthlyCalls: 900,
    lead: {
      ...GOLD_STANDARD_LEAD,
      email: `${"verylongemailaddress".repeat(3)}@624plumbing.example`,
    },
    reportDate: GOLD_STANDARD_REPORT_DATE,
  }),
  missingBusinessName: buildCase({
    trade: "Plumbers",
    truckCount: 15,
    monthlyCalls: 900,
    lead: { ...GOLD_STANDARD_LEAD, businessName: "" },
    reportDate: GOLD_STANDARD_REPORT_DATE,
  }),
  oneCharBusinessName: buildCase({
    trade: "Plumbers",
    truckCount: 15,
    monthlyCalls: 900,
    lead: { ...GOLD_STANDARD_LEAD, businessName: "d" },
    reportDate: GOLD_STANDARD_REPORT_DATE,
  }),
  missingLastName: buildCase({
    trade: "Plumbers",
    truckCount: 15,
    monthlyCalls: 900,
    lead: { ...GOLD_STANDARD_LEAD, lastName: "" },
    reportDate: GOLD_STANDARD_REPORT_DATE,
  }),
};

function rasterizePdf(pdfPath, prefix) {
  execSync(`pdftoppm -png -r ${DPI} "${pdfPath}" "${join(outDir, prefix)}"`, {
    stdio: "pipe",
  });
}

function pagePath(prefix, pageNum) {
  const padded = String(pageNum).padStart(2, "0");
  const path = join(outDir, `${prefix}-${padded}.png`);
  if (existsSync(path)) return path;
  return join(outDir, `${prefix}-${pageNum}.png`);
}

function runVisualDiff(pageNum, goldPrefix, prodPrefix, label) {
  const gold = pagePath(goldPrefix, pageNum);
  const prod = pagePath(prodPrefix, pageNum);
  execSync(
    `convert +append "${gold}" "${prod}" "${join(outDir, `compare-page-${pageNum}-${label}-side-by-side.png`)}"`,
    { stdio: "pipe" },
  );
  execSync(
    `convert "${gold}" "${prod}" -compose difference -composite "${join(outDir, `compare-page-${pageNum}-${label}-overlay.png`)}"`,
    { stdio: "pipe" },
  );
  try {
    execSync(
      `compare -metric AE "${gold}" "${prod}" "${join(outDir, `compare-page-${pageNum}-${label}-diff.png`)}" 2>"${join(outDir, `compare-page-${pageNum}-${label}-ae.txt`)}"`,
      { stdio: "pipe" },
    );
  } catch {
    // expected when images differ
  }
  return readAe(join(outDir, `compare-page-${pageNum}-${label}-ae.txt`));
}

process.argv[2] = outDir;
await import("./render-design-reference-html.mjs");

const puppeteer = await import("puppeteer-core");
const chromium = await import("@sparticuz/chromium");
const browser = await puppeteer.default.launch({
  args: chromium.default.args,
  executablePath: await chromium.default.executablePath(),
  headless: true,
  defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 2 },
});

const goldModel = buildGoldStandardReportViewModel();
const { pdf: productionPdf, timing } = await renderReportPdf(goldModel, {
  mode: "warm",
  collectTiming: true,
});
writeFileSync(join(outDir, "gold-standard-fixture-production.pdf"), productionPdf);
writeFileSync(join(outDir, "gold-standard-fixture-timing.json"), JSON.stringify(timing, null, 2));

if (existsSync(goldPdfPath)) {
  writeFileSync(join(outDir, "gold-standard-reference.pdf"), readFileSync(goldPdfPath));
  rasterizePdf(goldPdfPath, "gold-pdf");
}

const html = renderReportHtml(goldModel);
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
await page.emulateMediaType("print");
await page.evaluateHandle("document.fonts.ready");
const prodPages = await page.$$(".report-page");
for (let i = 0; i < prodPages.length; i++) {
  const png = await prodPages[i].screenshot({ type: "png" });
  writeFileSync(join(outDir, `production-${String(i + 1).padStart(2, "0")}.png`), png);
}
await page.close();

rasterizePdf(join(outDir, "gold-standard-fixture-production.pdf"), "production-pdf");

const aeAfterPdf = {};
const aeAfterHtml = {};
for (let p = 1; p <= 4; p++) {
  aeAfterPdf[p] = runVisualDiff(p, "gold-pdf", "production-pdf", "pdf");
  aeAfterHtml[p] = runVisualDiff(p, "gold", "production", "html");
}

for (const [caseName, model] of Object.entries(cases)) {
  if (caseName === "goldStandard") continue;
  const { pdf } = await renderReportPdf(model, { mode: "warm" });
  writeFileSync(join(outDir, `${caseName}.pdf`), pdf);
  const caseHtml = renderReportHtml(model);
  const casePage = await browser.newPage();
  await casePage.setContent(caseHtml, { waitUntil: "networkidle0" });
  await casePage.emulateMediaType("print");
  await casePage.evaluateHandle("document.fonts.ready");
  const pages = await casePage.$$(".report-page");
  for (let i = 0; i < pages.length; i++) {
    const png = await pages[i].screenshot({ type: "png" });
    writeFileSync(join(outDir, `edge-${caseName}-page-${i + 1}.png`), png);
  }
  await casePage.close();
}

await browser.close();

writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify(
    {
      aeBeforeVisualFixes: beforeAe,
      aeAfterVisualFixesHtml: aeAfterHtml,
      aeAfterVisualFixesPdf: aeAfterPdf,
      pdfBytes: productionPdf.byteLength,
      pageCount: timing?.pageCount,
      moderateTotal: goldModel.moderateHeroTotalFormatted,
      recoveredBookingRates: goldModel.scenarioAssumptions.map((a) => a.recoveredBookingRate),
    },
    null,
    2,
  ),
);

console.log(`Wrote Instruction #9 QA artifacts to ${outDir}`);
console.log("AE before (i8 html):", beforeAe);
console.log("AE after (i9 html):", aeAfterHtml);
console.log("AE after (i9 pdf):", aeAfterPdf);
