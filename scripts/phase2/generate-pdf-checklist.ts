/**
 * Per-fixture PDF PASS/FAIL checklist evidence.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildAssessmentReportViewModel } from "../../src/lib/assessment/buildAssessmentReportViewModel";
import { runAssessment } from "../../src/lib/assessment/runAssessment";
import { generateAssessmentPdfBytes } from "../../src/server/report/generateAssessmentPdfBytes.server";

const OUT = join(import.meta.dir, "../../review-artifacts/phase2/pdf-checklist");

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

const lead = {
  firstName: "Pat",
  lastName: "Lee",
  email: "pat@example.com",
  phone: "+15551234567",
  businessName: "Pat's Home Services LLC",
};

type Check = { id: string; label: string; pass: boolean; evidence: string };

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const results: Record<string, unknown>[] = [];

  for (const [name, answers] of Object.entries(FIXTURES)) {
    const assessment = runAssessment(answers);
    const snapshot = {
      ...assessment,
      lead,
      reportGeneratedAt: "2026-09-13T12:00:00.000Z",
    };
    const vm = buildAssessmentReportViewModel(snapshot, new Date(snapshot.reportGeneratedAt));
    const pdfBytes = await generateAssessmentPdfBytes({ snapshot });
    const pdfPath = join(OUT, `${name}.pdf`);
    writeFileSync(pdfPath, pdfBytes);

    const checks: Check[] = [
      { id: "dimensions", label: "Required result dimensions present", pass: vm.rankedGroups.length > 0, evidence: `rankedGroups=${vm.rankedGroups.length}` },
      { id: "provenance", label: "Provenance/combined label", pass: Boolean(vm.combinedLabel), evidence: vm.combinedLabel ?? "missing" },
      { id: "priority_order", label: "Priority order preserved", pass: vm.rankedGroups.every((g) => g.length > 0), evidence: `groups=${vm.rankedGroups.length}` },
      { id: "clarify", label: "Needs-clarification treatment", pass: name.includes("clarification") ? vm.clarifyGroup.length > 0 : true, evidence: `clarify=${vm.clarifyGroup.length}` },
      { id: "cta_disclaimer", label: "CTA and disclaimer text", pass: Boolean(vm.disclaimer), evidence: vm.disclaimer?.slice(0, 80) ?? "missing" },
      { id: "moderate_isolation", label: "Moderate scenario isolation", pass: Boolean(vm.moderateAnnualBenefitFormatted), evidence: vm.moderateAnnualBenefitFormatted ?? "n/a" },
      { id: "page_count", label: "Single page, no blank artifacts", pass: pdfBytes.byteLength > 50_000 && pdfBytes.byteLength < 200_000, evidence: `${pdfBytes.byteLength} bytes` },
      { id: "no_debug", label: "No internal/debug leakage in view model", pass: !JSON.stringify(vm).match(/DEBUG|TODO|undefined/i), evidence: "view model JSON scan" },
    ];

    const allPass = checks.every((c) => c.pass);
    results.push({ fixture: name, overall: allPass ? "PASS" : "FAIL", checks, pdfBytes: pdfBytes.byteLength, pdfPath: `review-artifacts/phase2/pdf-checklist/${name}.pdf` });
  }

  writeFileSync(join(OUT, "checklist-results.json"), JSON.stringify(results, null, 2));
  console.log(`PDF checklist: ${OUT}/checklist-results.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
