import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildAssessmentReportViewModel } from "~/lib/assessment/buildAssessmentReportViewModel";
import { runAssessment } from "~/lib/assessment/runAssessment";

const REPO_ROOT = join(import.meta.dir, "../../..");
const FIXED_DATE = new Date("2026-09-13T12:00:00.000Z");

const sampleAnswers = {
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
};

describe("assessment PDF supplemental S-PDF", () => {
  const assessment = runAssessment(sampleAnswers);
  const viewModel = buildAssessmentReportViewModel(assessment, FIXED_DATE);

  test("S-PDF-04: view model includes reportGeneratedAt when provided", () => {
    expect(viewModel.generatedAtIso).toBe(FIXED_DATE.toISOString());
  });

  test("S-PDF-05: view model formats moderate annual benefit", () => {
    expect(viewModel.moderateAnnualBenefitFormatted).toBeTruthy();
    expect(viewModel.moderateAnnualBenefitFormatted).toMatch(/\$/);
  });

  test("S-PDF-06: token PDF handler uses private no-store cache control", () => {
    const serve = readFileSync(
      join(REPO_ROOT, "src/server/report/serveAssessmentTokenPdf.server.ts"),
      "utf8",
    );
    expect(serve).toMatch(/Cache-Control.*no-store/i);
  });

  test("S-PDF-07: assessment report tokens use isolated prefix", () => {
    const tokens = readFileSync(
      join(REPO_ROOT, "src/server/assessment/reportTokens.ts"),
      "utf8",
    );
    expect(tokens).toContain("assessment:report:");
    expect(tokens).not.toContain("report:token:");
  });

  test("S-PDF-08: AssessmentReport component avoids server imports", () => {
    const report = readFileSync(
      join(REPO_ROOT, "src/components/report/AssessmentReport.tsx"),
      "utf8",
    );
    expect(report).not.toMatch(/\.server['"]/);
    expect(report).toContain("export function AssessmentReport");
  });
});
