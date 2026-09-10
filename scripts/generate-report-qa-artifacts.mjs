#!/usr/bin/env bun
/**
 * Render report HTML pages to PNG/PDF for visual QA artifacts.
 * Fill measurement analyzes page screenshots — not DOM box heights — so
 * stretched solid-color containers do not inflate the metric.
 *
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
  missingBusinessName: buildCase("missingBusinessName", {
    trade: "PestControl",
    truckCount: 15,
    monthlyCalls: 525,
    lead: { ...NORTHSTAR_LEAD, businessName: "" },
  }),
  oneCharBusinessName: buildCase("oneCharBusinessName", {
    trade: "PestControl",
    truckCount: 15,
    monthlyCalls: 525,
    lead: { ...NORTHSTAR_LEAD, businessName: "d" },
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

/**
 * Analyze a page screenshot in-browser: scan rows bottom-up for meaningful
 * content using local contrast / color variance. Uniform solid fills (e.g.
 * stretched card backgrounds) score as non-content.
 */
async function measurePageFillFromScreenshot(page, pngBase64) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    function bucket(r, g, b) {
      return `${(r >> 4) * 16},${(g >> 4) * 16},${(b >> 4) * 16}`;
    }

    function rowMetrics(y) {
      const buckets = new Map();
      let edgeCount = 0;
      let samples = 0;
      let lumSum = 0;

      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        buckets.set(bucket(r, g, b), (buckets.get(bucket(r, g, b)) ?? 0) + 1);

        const left = (y * width + (x - 1)) * 4;
        const right = (y * width + (x + 1)) * 4;
        const up = ((y - 1) * width + x) * 4;
        const down = ((y + 1) * width + x) * 4;

        const lum =
          0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        lumSum += lum;
        const lumL =
          0.299 * data[left] + 0.587 * data[left + 1] + 0.114 * data[left + 2];
        const lumR =
          0.299 * data[right] + 0.587 * data[right + 1] + 0.114 * data[right + 2];
        const lumU =
          0.299 * data[up] + 0.587 * data[up + 1] + 0.114 * data[up + 2];
        const lumD =
          0.299 * data[down] + 0.587 * data[down + 1] + 0.114 * data[down + 2];

        const localContrast = Math.max(
          Math.abs(lum - lumL),
          Math.abs(lum - lumR),
          Math.abs(lum - lumU),
          Math.abs(lum - lumD),
        );
        if (localContrast > 18) edgeCount++;
        samples++;
      }

      const maxBucket = Math.max(...buckets.values());
      const uniformFillRatio = maxBucket / Math.max(samples, 1);
      const edgeDensity = edgeCount / Math.max(samples, 1);
      const distinctBuckets = buckets.size;
      const avgLum = lumSum / Math.max(samples, 1);

      return { uniformFillRatio, edgeDensity, distinctBuckets, avgLum };
    }

    function rowIsMeaningful(m) {
      const isUniformFill = m.uniformFillRatio > 0.985 && m.distinctBuckets <= 4;
      const hasTextOrEdges = m.edgeDensity > 0.012;
      const hasVariedColor = m.distinctBuckets >= 8 && m.uniformFillRatio < 0.92;
      return !isUniformFill && (hasTextOrEdges || hasVariedColor);
    }

    function rowIsBlank(m) {
      const nearWhite = m.avgLum > 248;
      const lowEdge = m.edgeDensity < 0.022;
      return nearWhite && lowEdge;
    }

    let lastContentRow = 0;
    for (let y = height - 1; y >= 0; y--) {
      if (rowIsMeaningful(rowMetrics(y))) {
        lastContentRow = y;
        break;
      }
    }

    // Footer band: bottom ~4% with text edges (page number, email).
    const footerScanStart = Math.floor(height * 0.96);
    let footerTopRow = height - 1;
    for (let y = height - 1; y >= footerScanStart; y--) {
      if (rowIsMeaningful(rowMetrics(y))) {
        footerTopRow = y;
        break;
      }
    }

    // Skip footer separator, then count blank dead band, then find content bottom.
    let scanY = footerTopRow - 1;
    while (scanY >= 0 && !rowIsBlank(rowMetrics(scanY)) && !rowIsMeaningful(rowMetrics(scanY))) {
      scanY--;
    }
    let deadBandRows = 0;
    while (scanY >= 0 && rowIsBlank(rowMetrics(scanY))) {
      deadBandRows++;
      scanY--;
    }
    let mainContentBottomRow = scanY;
    while (scanY >= 0 && !rowIsMeaningful(rowMetrics(scanY))) {
      scanY--;
    }
    if (scanY >= 0) mainContentBottomRow = scanY;

    // Content top = first meaningful row below header (~10% skip).
    const headerSkip = Math.floor(height * 0.1);
    let mainContentTopRow = headerSkip;
    for (let y = headerSkip; y < height; y++) {
      if (rowIsMeaningful(rowMetrics(y))) {
        mainContentTopRow = y;
        break;
      }
    }

    const contentFillPercent = Math.round(((lastContentRow + 1) / height) * 100);
    const mainContentBottomPercent = Math.round(((mainContentBottomRow + 1) / height) * 100);
    const mainContentTopPercent = Math.round(((mainContentTopRow + 1) / height) * 100);
    const deadBandAboveFooterPercent = Math.round((deadBandRows / height) * 100);

    return {
      contentFillPercent,
      mainContentTopPercent,
      mainContentBottomPercent,
      deadBandAboveFooterPercent,
      lastContentRow,
      mainContentBottomRow,
      mainContentTopRow,
      footerTopRow,
      imageHeightPx: height,
      imageWidthPx: width,
      method: "screenshot-row-scan-v3",
      note: "QA-only metric; uniform solid fills excluded. Not a design target.",
    };
  }, pngBase64);
}

function flagIdenticalFillAcrossPages(fillReport) {
  const values = fillReport.map((r) => r.contentFillPercent);
  const rows = fillReport.map((r) => r.lastContentRow);
  const allSame = values.length > 1 && values.every((v) => v === values[0]);
  const allSameRow = rows.length > 1 && rows.every((r) => r === rows[0]);
  const clustered =
    values.filter((v) => v === values[0]).length >= 3 && values.length >= 4;

  if (allSame || (clustered && allSameRow)) {
    return {
      warning:
        "Multiple pages share identical contentFillPercent/lastContentRow — likely footer-anchored; use deadBandAboveFooterPercent for spacing QA; not an approval gate.",
      identicalValue: values[0],
      identicalLastContentRow: rows[0],
    };
  }
  return null;
}

const puppeteer = await import("puppeteer-core");
const chromium = await import("@sparticuz/chromium");
const browser = await puppeteer.default.launch({
  args: chromium.default.args,
  executablePath: await chromium.default.executablePath(),
  headless: true,
  defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 2 },
});

const allFillSummaries = {};

for (const [caseName, model] of Object.entries(cases)) {
  const html = renderReportHtml(model);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.emulateMediaType("print");
  await page.evaluateHandle("document.fonts.ready");

  const pages = await page.$$(".report-page");
  const fillReport = [];
  for (let i = 0; i < pages.length; i++) {
    const png = await pages[i].screenshot({ type: "png", encoding: "base64" });
    const imageFill = await measurePageFillFromScreenshot(page, png);
    const domFill = await pages[i].evaluate((el) => {
      const pageRect = el.getBoundingClientRect();
      const footer = el.querySelector(".report-footer");
      const footerTop = footer
        ? footer.getBoundingClientRect().top - pageRect.top
        : pageRect.height;
      let contentTop = pageRect.height;
      let contentBottom = 0;
      const body = el.querySelector(".report-page-body");
      if (!body) {
        return { mainContentTopPercent: 0, mainContentBottomPercent: 0, deadBandAboveFooterPercent: 0 };
      }
      const nodes = body.querySelectorAll(
        "h1,h2,h3,p,li,div,span,svg,img,a,header,footer,ul",
      );
      nodes.forEach((node) => {
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return;
        const rect = node.getBoundingClientRect();
        if (rect.height < 2 || rect.width < 2) return;
        const top = rect.top - pageRect.top;
        const bottom = rect.bottom - pageRect.top;
        if (bottom <= footerTop - 4) {
          contentTop = Math.min(contentTop, top);
          contentBottom = Math.max(contentBottom, bottom);
        }
      });
      const pageHeight = pageRect.height;
      const deadBandPx = Math.max(0, footerTop - contentBottom);
      return {
        mainContentTopPercent: Math.round((contentTop / pageHeight) * 100),
        mainContentBottomPercent: Math.round((contentBottom / pageHeight) * 100),
        deadBandAboveFooterPercent: Math.round((deadBandPx / pageHeight) * 100),
      };
    });
    const fill = {
      ...imageFill,
      ...domFill,
      method: "screenshot-row-scan-v3+dom-bounds",
    };
    fillReport.push({ page: i + 1, ...fill });
    writeFileSync(join(outDir, `${caseName}-page-${i + 1}.png`), Buffer.from(png, "base64"));
  }

  const identicalWarning = flagIdenticalFillAcrossPages(fillReport);
  const payload = identicalWarning ? { pages: fillReport, ...identicalWarning } : { pages: fillReport };
  allFillSummaries[caseName] = payload;

  writeFileSync(join(outDir, `${caseName}-fill.json`), JSON.stringify(payload, null, 2));

  const { pdf, timing } = await renderReportPdf(model, { mode: "warm", collectTiming: true });
  writeFileSync(join(outDir, `${caseName}.pdf`), pdf);
  writeFileSync(
    join(outDir, `${caseName}-timing.json`),
    JSON.stringify(timing, null, 2),
  );

  await page.close();
}

writeFileSync(join(outDir, "fill-summary.json"), JSON.stringify(allFillSummaries, null, 2));

await browser.close();
console.log(`Wrote QA artifacts to ${outDir}`);
