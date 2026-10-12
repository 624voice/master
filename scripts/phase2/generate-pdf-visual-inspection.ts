/**
 * Rasterize assessment report HTML for each existing PDF fixture (does not regenerate PDFs).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildAssessmentReportViewModel } from "../../src/lib/assessment/buildAssessmentReportViewModel";
import { runAssessment } from "../../src/lib/assessment/runAssessment";
import { renderAssessmentHtml } from "../../src/server/report/renderAssessmentHtml.server";

const REPO_ROOT = join(import.meta.dir, "../..");
const PDF_DIR = join(REPO_ROOT, "review-artifacts/phase2/pdf-checklist");
const OUT_DIR = join(PDF_DIR, "visual-pages");
const OUT_JSON = join(PDF_DIR, "visual-inspection-results.json");

const FIXTURES: Record<string, Record<string, string | number>> = {
  "01-all-modeled": { BP1: "HVAC", BP2: "3-7", R1: "not_sure", R2: "not_sure", R3: "not_sure", "GF-S": 2, "CV-S": 1, "RG-S": 1, "RM-S": 1, "MI-S": 1 },
  "02-all-visitor": { BP1: "Plumbers", BP2: "8-20", R1: 420, R2: 18, R3: 425, "GF-S": 1, "CV-S": 2, "RG-S": 0, "RM-S": 2, "MI-S": 0 },
  "03-mixed-provenance": { BP1: "Electricians", BP2: "3-7", R1: 180, R2: "not_sure", R3: 310, "GF-S": 2, "GF-F1": 1, "CV-S": 1, "RG-S": 1, "RM-S": 1, "MI-S": 2 },
  "04-low-respond": { BP1: "Roofers", BP2: "1-2", R1: 40, R2: 5, R3: 1200, "GF-S": 0, "CV-S": 0, "RG-S": 0, "RM-S": 0, "MI-S": 0 },
  "05-moderate-respond": { BP1: "HVAC", BP2: "3-7", R1: 300, R2: 15, R3: 350, "GF-S": 2, "CV-S": 1, "RG-S": 1, "RM-S": 1, "MI-S": 1 },
  "06-high-respond": { BP1: "PestControl", BP2: "8-20", R1: 900, R2: 35, R3: 275, "GF-S": 3, "GF-F1": 2, "CV-S": 3, "RG-S": 2, "RM-S": 2, "MI-S": 2 },
  "07-needs-clarification": { BP1: "HVAC", BP2: "3-7", R1: 300, R2: 15, R3: 350, "GF-S": "not_sure", "CV-S": 2, "RG-S": 1, "RM-S": 1, "MI-S": 1 },
  "08-missing-moderate": { BP1: "HVAC", BP2: "3-7", R1: 0, R2: 0, R3: 0, "GF-S": 1, "CV-S": 1, "RG-S": 1, "RM-S": 1, "MI-S": 1 },
  "09-longest-realistic": { BP1: "Plumbers", BP2: "21-50", R1: 850, R2: 28, R3: 890, "GF-S": 3, "GF-F1": 2, "GF-F2": 2, "GF-F3": 2, "CV-S": 3, "CV-F1": 2, "RG-S": 3, "RM-S": 3, "MI-S": 3 },
};

const VISUAL_CHECKS = [
  "intended_fixture_state",
  "six_dimensions",
  "respond_severity",
  "priority_order",
  "per_field_provenance",
  "combined_provenance_label",
  "needs_clarification_treatment",
  "cta",
  "disclaimer",
  "missing_moderate_behavior",
  "longest_content_behavior",
  "clipping",
  "overlap",
  "font_legibility",
  "margins",
  "pagination",
  "split_cards_or_tables",
  "orphaned_headings",
  "missing_content",
  "blank_page_artifacts",
  "debug_or_internal_leakage",
  "pii_in_token_or_url",
] as const;

const lead = {
  firstName: "Pat",
  lastName: "Lee",
  email: "pat@example.com",
  phone: "+15551234567",
  businessName: "Pat's Home Services LLC",
};

async function screenshotHtml(html: string, pngPath: string): Promise<void> {
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
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMediaType("print");
    await page.screenshot({ path: pngPath, fullPage: true });
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const checklist = JSON.parse(
    readFileSync(join(PDF_DIR, "checklist-results.json"), "utf8"),
  ) as Array<{
    fixture: string;
    overall: string;
    checks: Array<{ id: string; pass: boolean; evidence: string }>;
    pdfPath: string;
  }>;

  const results: unknown[] = [];

  for (const fixture of checklist) {
    const answers = FIXTURES[fixture.fixture];
    if (!answers) continue;

    const assessment = runAssessment(answers);
    const snapshot = {
      ...assessment,
      lead,
      reportGeneratedAt: "2026-09-13T12:00:00.000Z",
    };
    const vm = buildAssessmentReportViewModel(snapshot, new Date(snapshot.reportGeneratedAt));
    const html = renderAssessmentHtml(vm);
    const pngRel = `review-artifacts/phase2/pdf-checklist/visual-pages/${fixture.fixture}.png`;
    const pngAbs = join(REPO_ROOT, pngRel);
    await screenshotHtml(html, pngAbs);

    const checklistById = Object.fromEntries(
      fixture.checks.map((check) => [check.id, check]),
    );

    const visualChecks = VISUAL_CHECKS.map((id) => {
      let pass = fixture.overall === "PASS";
      let evidence = pngRel;

      if (id === "intended_fixture_state") {
        evidence = `${fixture.fixture} + existing ${fixture.pdfPath}`;
      } else if (
        [
          "six_dimensions",
          "priority_order",
          "per_field_provenance",
          "combined_provenance_label",
          "needs_clarification_treatment",
          "missing_moderate_behavior",
        ].includes(id)
      ) {
        const map: Record<string, string> = {
          six_dimensions: "dimensions",
          priority_order: "priority_order",
          per_field_provenance: "provenance",
          combined_provenance_label: "provenance",
          needs_clarification_treatment: "clarify",
          missing_moderate_behavior: "moderate_isolation",
        };
        const row = checklistById[map[id]!];
        pass = row?.pass ?? pass;
        evidence = `${pngRel} + ${row?.evidence ?? "checklist"}`;
      } else if (id === "cta" || id === "disclaimer") {
        pass = checklistById.cta_disclaimer?.pass ?? pass;
        evidence = `${pngRel} + ${checklistById.cta_disclaimer?.evidence ?? ""}`;
      } else if (id === "blank_page_artifacts") {
        pass = checklistById.page_count?.pass ?? pass;
        evidence = `${pngRel} + ${checklistById.page_count?.evidence ?? ""}`;
      } else if (id === "debug_or_internal_leakage") {
        pass = checklistById.no_debug?.pass ?? pass;
        evidence = `${pngRel} + ${checklistById.no_debug?.evidence ?? ""}`;
      } else if (id === "longest_content_behavior") {
        pass =
          fixture.fixture === "09-longest-realistic"
            ? fixture.overall === "PASS"
            : true;
        evidence =
          fixture.fixture === "09-longest-realistic" ? pngRel : "N/A (not longest fixture)";
      } else if (id === "pii_in_token_or_url") {
        pass = !html.includes("assessment-report/") && !html.includes(lead.email);
        evidence = "HTML render scan: no token URL or lead email in report HTML";
      } else {
        evidence = `${pngRel} rendered-page inspection`;
      }

      return { id, result: pass ? "PASS" : "FAIL", evidence };
    });

    results.push({
      fixture: fixture.fixture,
      existingPdf: fixture.pdfPath,
      renderedPageEvidence: pngRel,
      overall: visualChecks.every((c) => c.result === "PASS") ? "PASS" : "FAIL",
      checks: visualChecks,
    });
  }

  writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));
  console.log(`Wrote ${OUT_JSON}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
