/**
 * Phase 2 Assessment PDF visual QA — nine fixtures via production rendering path.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildAssessmentReportViewModel } from "../src/lib/assessment/buildAssessmentReportViewModel";
import { runAssessment } from "../src/lib/assessment/runAssessment";
import { generateAssessmentPdfBytes } from "../src/server/report/generateAssessmentPdfBytes.server";
import { renderAssessmentHtml } from "../src/server/report/renderAssessmentHtml.server";
import { renderAssessmentPdf } from "../src/server/report/renderAssessmentPdf.server";
import type { AssessmentReportSnapshot } from "../src/server/assessment/types";

const OUT_DIR = join(import.meta.dir, "../artifacts/phase2-pdf-qa");

const lead = {
  firstName: "Pat",
  lastName: "Lee",
  email: "pat@example.com",
  phone: "+15551234567",
  businessName: "Pat's Home Services LLC",
};

const FIXTURES: Record<string, Record<string, string | number>> = {
  "01-all-modeled": {
    BP1: "HVAC",
    BP2: "3-7",
    R1: "not_sure",
    R2: "not_sure",
    R3: "not_sure",
    "GF-S": 2,
    "CV-S": 1,
    "RG-S": 1,
    "RM-S": 1,
    "MI-S": 1,
  },
  "02-all-visitor": {
    BP1: "Plumbers",
    BP2: "8-20",
    R1: 420,
    R2: 18,
    R3: 425,
    "GF-S": 1,
    "CV-S": 2,
    "RG-S": 0,
    "RM-S": 2,
    "MI-S": 0,
  },
  "03-mixed-provenance": {
    BP1: "Electricians",
    BP2: "3-7",
    R1: 180,
    R2: "not_sure",
    R3: 310,
    "GF-S": 2,
    "GF-F1": 1,
    "GF-F2": 0,
    "GF-F3": 2,
    "CV-S": 1,
    "RG-S": 1,
    "RM-S": 1,
    "MI-S": 2,
  },
  "04-low-respond": {
    BP1: "Roofers",
    BP2: "1-2",
    R1: 40,
    R2: 5,
    R3: 1200,
    "GF-S": 0,
    "CV-S": 0,
    "RG-S": 0,
    "RM-S": 0,
    "MI-S": 0,
  },
  "05-moderate-respond": {
    BP1: "HVAC",
    BP2: "3-7",
    R1: 300,
    R2: 15,
    R3: 350,
    "GF-S": 2,
    "CV-S": 1,
    "RG-S": 1,
    "RM-S": 1,
    "MI-S": 1,
  },
  "06-high-respond": {
    BP1: "PestControl",
    BP2: "8-20",
    R1: 900,
    R2: 35,
    R3: 275,
    "GF-S": 3,
    "GF-F1": 2,
    "GF-F2": 2,
    "GF-F3": 2,
    "CV-S": 3,
    "CV-F1": 2,
    "CV-F2": 2,
    "CV-F3": 2,
    "RG-S": 2,
    "RG-F1": 1,
    "RM-S": 2,
    "MI-S": 2,
  },
  "07-needs-clarification": {
    BP1: "HVAC",
    BP2: "3-7",
    R1: 300,
    R2: 15,
    R3: 350,
    "GF-S": "not_sure",
    "GF-F1": "not_sure",
    "CV-S": 2,
    "RG-S": 1,
    "RM-S": 1,
    "MI-S": 1,
  },
  "08-missing-moderate": {
    BP1: "HVAC",
    BP2: "3-7",
    R1: 0,
    R2: 0,
    R3: 0,
    "GF-S": 1,
    "CV-S": 1,
    "RG-S": 1,
    "RM-S": 1,
    "MI-S": 1,
  },
  "09-longest-realistic": {
    BP1: "Plumbers",
    BP2: "21-50",
    R1: 850,
    R2: 28,
    R3: 890,
    "GF-S": 3,
    "GF-F1": 2,
    "GF-F2": 2,
    "GF-F3": 2,
    "CV-S": 3,
    "CV-F1": 2,
    "CV-F2": 1,
    "CV-F3": 2,
    "RG-S": 3,
    "RG-F1": 2,
    "RG-F2": 2,
    "RG-F3": 1,
    "RM-S": 3,
    "RM-F1": 2,
    "RM-F2": 2,
    "RM-F3": 2,
    "MI-S": 3,
    "MI-F1": 2,
    "MI-F2": 2,
    "MI-F3": 2,
  },
};

async function screenshotHtml(html: string, outPath: string): Promise<void> {
  const [puppeteer, chromium] = await Promise.all([
    import("puppeteer-core"),
    import("@sparticuz/chromium"),
  ]);
  const browser = await puppeteer.default.launch({
    args: chromium.default.args,
    executablePath: await chromium.default.executablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");
    await page.evaluateHandle("document.fonts.ready");
    await page.screenshot({ path: outPath, fullPage: true, type: "png" });
  } finally {
    await browser.close();
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const summary: Array<Record<string, unknown>> = [];

  for (const [name, answers] of Object.entries(FIXTURES)) {
    const assessment = runAssessment(answers);
    const snapshot: AssessmentReportSnapshot = {
      ...assessment,
      lead,
      reportGeneratedAt: "2026-09-13T12:00:00.000Z",
    };
    const generatedAt = new Date(snapshot.reportGeneratedAt);
    const viewModel = buildAssessmentReportViewModel(snapshot, generatedAt);

    const pdfBytes = await generateAssessmentPdfBytes({ snapshot });
    writeFileSync(join(OUT_DIR, `${name}.pdf`), pdfBytes);

    const { pdf, timing } = await renderAssessmentPdf(viewModel, {
      mode: "cold",
      collectTiming: true,
    });
    const pageCount = timing?.pageCount ?? 1;

    const html = renderAssessmentHtml(viewModel);
    writeFileSync(join(OUT_DIR, `${name}.html`), html);
    await screenshotHtml(html, join(OUT_DIR, `${name}-visual.png`));

    summary.push({
      fixture: name,
      pdfBytes: pdfBytes.byteLength,
      renderPdfBytes: pdf.byteLength,
      pageCount,
      hasDollarEstimate: assessment.dollarEstimate != null,
      combinedLabel: assessment.combinedLabel,
      clarifyCount: assessment.clarifyGroup.length,
      visualPng: `${name}-visual.png`,
    });
    console.log(`${name}: ${pdfBytes.byteLength} bytes, ${pageCount} page(s), visual PNG saved`);
  }

  writeFileSync(join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  await import("../src/server/report/renderAssessmentPdf.server").then((m) =>
    m.closeAssessmentBrowser(),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
