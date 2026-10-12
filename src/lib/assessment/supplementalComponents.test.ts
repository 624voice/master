import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { selectModerateScenarioValue } from "~/lib/assessment/selectModerateScenario";
import { computeAllScenarios } from "~/lib/roi/computeRoi";

const REPO_ROOT = join(import.meta.dir, "../../..");

function readComponent(name: string): string {
  return readFileSync(join(REPO_ROOT, `src/components/assessment/${name}`), "utf8");
}

describe("assessment components supplemental S-CMP", () => {
  test("S-CMP-01: AssessmentGate component exports gate form", () => {
    const source = readComponent("AssessmentGate.tsx");
    expect(source).toContain("export function AssessmentGate");
    expect(source).toContain("smsConsent");
  });

  test("S-CMP-02: selectModerateScenarioValue picks scenarioIndex 1", () => {
    const scenarios = computeAllScenarios("HVAC", 700);
    expect(selectModerateScenarioValue(scenarios)).toBe(scenarios[1]!.totalAnnualBenefit);
  });

  test("S-CMP-03: AssessmentQuestion renders question types", () => {
    const source = readComponent("AssessmentQuestion.tsx");
    expect(source).toContain("export function AssessmentQuestion");
    expect(source).toMatch(/radio|select|number/);
  });

  test("S-CMP-04: AssessmentProgress tracks step state", () => {
    const source = readComponent("AssessmentProgress.tsx");
    expect(source).toContain("export function AssessmentProgress");
    expect(source).toContain("questionId");
    expect(source).toContain("areaIndexForQuestion");
  });

  test("S-CMP-05: AssessmentResults shows ranked groups", () => {
    const source = readComponent("AssessmentResults.tsx");
    expect(source).toContain("priorityGroups");
    expect(source).toContain("clarifyGroup");
  });

  test("S-CMP-06: RespondAssumptionsReview exposes respond inputs", () => {
    const source = readComponent("RespondAssumptionsReview.tsx");
    expect(source).toContain("RespondAssumptionsReview");
    expect(source).toMatch(/R1|R2|R3/);
  });

  test("S-CMP-07: assessment route wires step orchestration", () => {
    const route = readFileSync(join(REPO_ROOT, "src/routes/assessment.tsx"), "utf8");
    expect(route).toContain("AssessmentGate");
    expect(route).toContain("AssessmentQuestion");
    expect(route).toContain("AssessmentResults");
  });

  test("S-CMP-08: AssessmentGate includes separate SMS consent copy", () => {
    const source = readComponent("AssessmentGate.tsx");
    expect(source).toMatch(/smsConsent|SMS/i);
    expect(source).toContain("text messages");
  });

  test("S-CMP-09: moderate scenario selection uses scenarioIndex 1 in PDF view model", () => {
    const viewModel = readFileSync(
      join(REPO_ROOT, "src/lib/assessment/buildAssessmentReportViewModel.ts"),
      "utf8",
    );
    expect(viewModel).toContain("scenarioIndex === 1");
  });

  test("S-CMP-10: AssessmentResults includes disclaimer reference", () => {
    const source = readComponent("AssessmentResults.tsx");
    expect(source).toMatch(/disclaimer|Disclaimer|estimate/i);
  });
});
