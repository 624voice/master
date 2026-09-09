#!/usr/bin/env bun
/**
 * Render report HTML pages to PNG for visual QA artifacts.
 * Usage: bun scripts/generate-report-qa-artifacts.mjs [outputDir]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildReportViewModel } from "../src/lib/report/buildReportViewModel.ts";
import { computeAllScenarios } from "../src/lib/roi/computeRoi.ts";
import { formatReportDate, formatReportId } from "../src/lib/report/formatReportMeta.ts";
import { renderReportHtml } from "../src/server/report/renderReportHtml.server.tsx";
import { renderReportPdf } from "../src/server/report/renderReportPdf.server.ts";
import { NORTHSTAR_LEAD, NORTHSTAR_REPORT_DATE } from "../src/lib/report/__fixtures__/northstar.ts";

const outDir = process.argv[2] ?? "/opt/cursor/artifacts/report-qa";
mkdirSync(outDir, { recursive: true });

function buildCase(name, input) {
  const scenarios = computeAllScenarios(input.trade, input.monthlyCalls);
  return buildReportViewModel({
    ...input,
    scenarios,
    reportId: formatReportId(input.trade, input.monthlyCalls, NORTHSTAR_REPORT_DATE),
    reportDate: formatReportDate(NORTHSTAR_REPORT_DATE),
  });
}

const cases = {
  northstar: buildCase("northstar", {
    trade: "PestControl",
    truckCount: 15,
    monthlyCalls: 525,
    lead: NORTHSTAR_LEAD,
  }),
  longBusinessName: buildCase("longBusinessName", {
    trade: "PestControl",
    truckCount: 15,
    monthlyCalls: 525,
    lead: {
      ...NORTHSTAR_LEAD,
      businessName: "A".repeat(40),
    },
  }),
  longEmail: buildCase("longEmail", {
    trade: "PestControl",
    truckCount: 15,
    monthlyCalls: 525,
    lead: {
      ...NORTHSTAR_LEAD,
      email: `${"verylongemailaddress".repeat(3)}@northstarpest.example`,
    },
  }),
  longContactName: buildCase("longContactName", {
    trade: "PestControl",
    truckCount: 15,
    monthlyCalls: 525,
    lead: {
      ...NORTHSTAR_LEAD,
      firstName: "Christopher-Alexander",
      lastName: "Montgomery-Wellington",
    },
  }),
  roofersHighVolume: buildCase("roofersHighVolume", {
    trade: "Roofers",
    truckCount: 50,
    monthlyCalls: 1000,
    lead: NORTHSTAR_LEAD,
  }),
  electriciansSmall: buildCase("electriciansSmall", {
    trade: "Electricians",
    truckCount: 1,
    monthlyCalls: 30,
    lead: NORTHSTAR_LEAD,
  }),
};

const puppeteer = await import("puppeteer-core");
const chromium = await import("@sparticuz/chromium");
const browser = await puppeteer.default.launch({
  args: chromium.default.args,
  executablePath: await chromium.default.executablePath(),
  headless: true,
  defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 2 },
});

for (const [caseName, model] of Object.entries(cases)) {
  const html = renderReportHtml(model);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.emulateMediaType("print");
  await page.evaluateHandle("document.fonts.ready");

  const pages = await page.$$(".report-page");
  for (let i = 0; i < pages.length; i++) {
    const png = await pages[i].screenshot({ type: "png" });
    writeFileSync(join(outDir, `${caseName}-page-${i + 1}.png`), png);
  }

  const { pdf, timing } = await renderReportPdf(model, { mode: "warm", collectTiming: true });
  writeFileSync(join(outDir, `${caseName}.pdf`), pdf);
  writeFileSync(
    join(outDir, `${caseName}-timing.json`),
    JSON.stringify(timing, null, 2),
  );

  await page.close();
}

await browser.close();
console.log(`Wrote QA artifacts to ${outDir}`);
