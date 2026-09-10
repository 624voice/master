#!/usr/bin/env bun
/**
 * Instruction #10 QA: validated gold-standard PDF overlay + visual fixes.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildReportViewModel } from "../src/lib/report/buildReportViewModel.ts";
import { computeAllScenarios } from "../src/lib/roi/computeRoi.ts";
import { formatReportDate, formatReportId } from "../src/lib/report/formatReportMeta.ts";
import { GUARANTEE_BODY } from "../src/lib/report/reportCopy.ts";
import {
  buildGoldStandardReportViewModel,
  GOLD_STANDARD_LEAD,
  GOLD_STANDARD_REPORT_DATE,
} from "../src/lib/report/__fixtures__/goldStandard.ts";
import { NORTHSTAR_LEAD } from "../src/lib/report/__fixtures__/northstar.ts";
import { renderReportHtml } from "../src/server/report/renderReportHtml.server.tsx";
import { renderReportPdf } from "../src/server/report/renderReportPdf.server.ts";

const outDir = join(process.cwd(), "artifacts/report-qa-i10");
const i9Dir = join(process.cwd(), "artifacts/report-qa-i9");
const goldPdfCandidates = [
  join(process.cwd(), "design-reference-v3/ROI-Doc-Gold-Standard-Final.pdf"),
  join(process.cwd(), "design-reference/ROI Doc Gold Standard Final.pdf"),
  join(process.cwd(), "design-reference-v3/ROI Doc Gold Standard Final.pdf"),
];
const generatedGoldPdfPath = join(process.cwd(), "design-reference-v3/ROI-Doc-Gold-Standard-Final.pdf");
const DPI = 192;

mkdirSync(outDir, { recursive: true });

function readAe(path) {
  return existsSync(path) ? readFileSync(path, "utf8").trim() : null;
}

const beforeAe = {};
for (let p = 1; p <= 4; p++) {
  beforeAe[p] = readAe(join(i9Dir, `compare-page-${p}-html-ae.txt`));
}

function validateGoldPdfPage4(pdfPath) {
  const text = execSync(`pdftotext -f 4 -l 4 "${pdfPath}" -`, { encoding: "utf8" });
  const missing = [];
  if (!text.includes("04")) missing.push("section 04");
  if (!text.includes("90-Day Results Guarantee")) missing.push("90-Day Results Guarantee");
  if (text.includes("Even the conservative model puts")) {
    throw new Error(
      `Gold reference PDF is i7-era production (scenario recap on page 4): ${pdfPath}`,
    );
  }
  if (/\b06\b/.test(text) && text.includes("What happens next")) {
    throw new Error(`Gold reference PDF contains section 06: ${pdfPath}`);
  }
  if (missing.length) {
    throw new Error(`Gold reference PDF page 4 missing ${missing.join(", ")}: ${pdfPath}`);
  }
  return text;
}

async function resolveGoldPdfPath(browserFactory) {
  for (const candidate of goldPdfCandidates) {
    if (existsSync(candidate)) {
      validateGoldPdfPage4(candidate);
      return candidate;
    }
  }

  mkdirSync(join(process.cwd(), "design-reference-v3"), { recursive: true });
  process.argv[2] = outDir;
  process.argv[3] = generatedGoldPdfPath;
  await import("./render-design-reference-html.mjs");
  validateGoldPdfPage4(generatedGoldPdfPath);
  return generatedGoldPdfPath;
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

const goldModel = buildGoldStandardReportViewModel();
const hvacModel = buildCase({
  trade: "HVAC",
  truckCount: 10,
  monthlyCalls: 700,
  lead: {
    firstName: "Alex",
    lastName: "Rivera",
    businessName: "Rivera Comfort HVAC",
    email: "alex@riveracomfort.example",
    phone: "(555) 555-0202",
  },
  reportDate: GOLD_STANDARD_REPORT_DATE,
});

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

async function screenshotPages(browser, model, prefix) {
  const html = renderReportHtml(model);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.emulateMediaType("print");
  await page.evaluateHandle("document.fonts.ready");
  const prodPages = await page.$$(".report-page");
  for (let i = 0; i < prodPages.length; i++) {
    const png = await prodPages[i].screenshot({ type: "png" });
    writeFileSync(join(outDir, `${prefix}-${String(i + 1).padStart(2, "0")}.png`), png);
  }
  await page.close();
}

const goldPdfPath = await resolveGoldPdfPath();
writeFileSync(join(outDir, "gold-standard-reference.pdf"), readFileSync(goldPdfPath));
writeFileSync(
  join(outDir, "gold-reference-validation.txt"),
  validateGoldPdfPage4(goldPdfPath),
);
rasterizePdf(goldPdfPath, "gold-pdf");

const puppeteer = await import("puppeteer-core");
const chromium = await import("@sparticuz/chromium");
const browser = await puppeteer.default.launch({
  args: chromium.default.args,
  executablePath: await chromium.default.executablePath(),
  headless: true,
  defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 2 },
});

const { pdf: productionPdf, timing } = await renderReportPdf(goldModel, {
  mode: "warm",
  collectTiming: true,
});
writeFileSync(join(outDir, "gold-standard-fixture-production.pdf"), productionPdf);
writeFileSync(join(outDir, "gold-standard-fixture-timing.json"), JSON.stringify(timing, null, 2));

await screenshotPages(browser, goldModel, "production");
rasterizePdf(join(outDir, "gold-standard-fixture-production.pdf"), "production-pdf");

const { pdf: hvacPdf } = await renderReportPdf(hvacModel, { mode: "warm" });
writeFileSync(join(outDir, "hvac-case-production.pdf"), hvacPdf);
await screenshotPages(browser, hvacModel, "hvac-production");

await browser.close();

const aeAfterPdf = {};
const aeAfterHtml = {};
for (let p = 1; p <= 4; p++) {
  aeAfterPdf[p] = runVisualDiff(p, "gold-pdf", "production-pdf", "pdf");
  aeAfterHtml[p] = runVisualDiff(p, "gold", "production", "html");
}

const guaranteePdfText = execSync(
  `pdftotext -f 4 -l 4 "${join(outDir, "gold-standard-fixture-production.pdf")}" -`,
  { encoding: "utf8" },
);

writeFileSync(
  join(outDir, "runtime-path-parity.md"),
  `# Runtime path parity — renderReportPdf

## generateRoiPdf (calculator POST)

\`src/components/RoiCalculator.tsx\` → \`generateRoiPdf()\` (\`src/server/generateRoiPdf.ts\`)
→ \`generateRoiPdfHandler()\` (\`src/server/generateRoiPdfHandler.server.ts\`)
→ \`generateReportPdfBytes()\` (\`src/server/report/generateReportPdfBytes.server.ts\`)
→ \`renderReportPdf()\` (\`src/server/report/renderReportPdf.server.ts\`)

## GET /report/$token

\`src/routes/report/$token.ts\` → \`serveReportTokenPdf()\` (\`src/server/report/serveReportTokenPdf.server.ts\`)
→ \`renderReportPdf()\` (\`src/server/report/renderReportPdf.server.ts\`)
`,
);

writeFileSync(
  join(outDir, "guarantee-verification.json"),
  JSON.stringify(
    {
      canonicalRepoString: GUARANTEE_BODY,
      canonicalUsesHyphenMinus: GUARANTEE_BODY.includes("go-live - or"),
      goldStandardUsesEmDash: true,
      note: "Gold PDF uses em dash; canonical repo copy uses hyphen-minus per Instruction #6 policy.",
      renderedPdfContainsCanonicalSubstring: guaranteePdfText.includes("go-live - or"),
      renderedPdfSnippet: guaranteePdfText.match(/go-live.{0,20}or/)?.[0] ?? null,
    },
    null,
    2,
  ),
);

writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify(
    {
      goldPdfPath,
      goldPdfValidated: true,
      aeBeforeVisualFixes: beforeAe,
      aeAfterVisualFixesHtml: aeAfterHtml,
      aeAfterVisualFixesPdf: aeAfterPdf,
      pdfBytes: productionPdf.byteLength,
      pageCount: timing?.pageCount,
      hvacPdfBytes: hvacPdf.byteLength,
      moderateTotal: goldModel.moderateHeroTotalFormatted,
      recoveredBookingRates: goldModel.scenarioAssumptions.map((a) => a.recoveredBookingRate),
    },
    null,
    2,
  ),
);

console.log(`Wrote Instruction #10 QA artifacts to ${outDir}`);
console.log("Gold PDF:", goldPdfPath);
console.log("AE before (i9 html):", beforeAe);
console.log("AE after (i10 html):", aeAfterHtml);
console.log("AE after (i10 pdf):", aeAfterPdf);
