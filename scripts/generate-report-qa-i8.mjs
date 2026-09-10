#!/usr/bin/env bun
/**
 * Instruction #8 QA artifacts: production PDF/PNGs, edge cases, and visual diff
 * against the gold-standard PDF for the Chris Hutson / 624 Plumbing fixture.
 *
 * Usage: bun scripts/generate-report-qa-i8.mjs
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

const outDir = join(process.cwd(), "artifacts/report-qa-i8");
const DPI = 192; // 816px @ 96dpi × 2 device scale

mkdirSync(outDir, { recursive: true });

function buildCase(input) {
  const scenarios = computeAllScenarios(input.trade, input.monthlyCalls);
  return buildReportViewModel({
    ...input,
    scenarios,
    reportId: formatReportId(input.trade, input.monthlyCalls, input.reportDate ?? NORTHSTAR_REPORT_DATE),
    reportDate: formatReportDate(input.reportDate ?? NORTHSTAR_REPORT_DATE),
  });
}

const NORTHSTAR_REPORT_DATE = new Date("2026-03-15T15:00:00.000Z");

const edgeCases = {
  goldStandard: buildGoldStandardReportViewModel(),
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
  roofersHighVolume: buildCase({
    trade: "Roofers",
    truckCount: 50,
    monthlyCalls: 1000,
    lead: NORTHSTAR_LEAD,
  }),
  electriciansSmall: buildCase({
    trade: "Electricians",
    truckCount: 1,
    monthlyCalls: 30,
    lead: NORTHSTAR_LEAD,
  }),
};

function rasterizePdf(pdfPath, prefix) {
  execSync(
    `pdftoppm -png -r ${DPI} "${pdfPath}" "${join(outDir, prefix)}"`,
    { stdio: "pipe" },
  );
}

function pagePath(prefix, pageNum) {
  const padded = String(pageNum).padStart(2, "0");
  const path = join(outDir, `${prefix}-${padded}.png`);
  if (existsSync(path)) return path;
  const alt = join(outDir, `${prefix}-${pageNum}.png`);
  return existsSync(alt) ? alt : path;
}

function runVisualDiff(pageNum) {
  const gold = pagePath("gold", pageNum);
  const prod = pagePath("production", pageNum);
  const sideBySide = join(outDir, `compare-page-${pageNum}-side-by-side.png`);
  const overlay = join(outDir, `compare-page-${pageNum}-overlay.png`);
  const diff = join(outDir, `compare-page-${pageNum}-diff.png`);

  execSync(
    `convert +append "${gold}" "${prod}" "${sideBySide}"`,
    { stdio: "pipe" },
  );
  execSync(
    `convert "${gold}" "${prod}" -compose difference -composite "${overlay}"`,
    { stdio: "pipe" },
  );
  try {
    execSync(
      `compare -metric AE "${gold}" "${prod}" "${diff}" 2>"${join(outDir, `compare-page-${pageNum}-ae.txt`)}"`,
      { stdio: "pipe" },
    );
  } catch {
    // compare returns non-zero when images differ
  }
}

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
const productionPdfPath = join(outDir, "gold-standard-fixture-production.pdf");
writeFileSync(productionPdfPath, productionPdf);
writeFileSync(join(outDir, "gold-standard-fixture-timing.json"), JSON.stringify(timing, null, 2));

// Gold reference pages: v3 HTML (bundled PDF is an older layout).
await import("./render-design-reference-html.mjs");

const html = renderReportHtml(goldModel);
const refPage = await browser.newPage();
await refPage.setContent(html, { waitUntil: "networkidle0" });
await refPage.emulateMediaType("print");
await refPage.evaluateHandle("document.fonts.ready");
const prodPages = await refPage.$$(".report-page");
for (let i = 0; i < prodPages.length; i++) {
  const png = await prodPages[i].screenshot({ type: "png" });
  writeFileSync(join(outDir, `production-${String(i + 1).padStart(2, "0")}.png`), png);
}
await refPage.close();

rasterizePdf(productionPdfPath, "production-pdf");

for (let page = 1; page <= 4; page++) {
  runVisualDiff(page);
}

for (const [caseName, model] of Object.entries(edgeCases)) {
  if (caseName === "goldStandard") continue;
  const html = renderReportHtml(model);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.emulateMediaType("print");
  await page.evaluateHandle("document.fonts.ready");
  const pages = await page.$$(".report-page");
  for (let i = 0; i < pages.length; i++) {
    const png = await pages[i].screenshot({ type: "png" });
    writeFileSync(join(outDir, `edge-${caseName}-page-${i + 1}.png`), png);
  }
  await page.close();
}

await browser.close();

writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify(
    {
      fixture: "Chris Hutson · 624 Plumbing · Plumbers · 15 trucks · 900 calls/month",
      reportId: goldModel.metadata.reportId,
      reportDate: goldModel.metadata.reportDate,
      moderateTotal: goldModel.moderateHeroTotalFormatted,
      dpi: DPI,
      pageCount: timing?.pageCount,
      pdfBytes: productionPdf.byteLength,
      artifacts: {
        goldPages: [1, 2, 3, 4].map((p) => `gold-${String(p).padStart(2, "0")}.png`),
        productionPages: [1, 2, 3, 4].map((p) => `production-${String(p).padStart(2, "0")}.png`),
        comparisons: [1, 2, 3, 4].flatMap((p) => [
          `compare-page-${p}-side-by-side.png`,
          `compare-page-${p}-overlay.png`,
          `compare-page-${p}-diff.png`,
        ]),
      },
    },
    null,
    2,
  ),
);

console.log(`Wrote Instruction #8 QA artifacts to ${outDir}`);
