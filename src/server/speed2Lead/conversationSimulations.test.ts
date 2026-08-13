import { describe, expect, test } from "bun:test";
import {
  runAllSimulations,
  SIMULATION_SCENARIOS,
  simulateScenario,
} from "~/server/speed2Lead/conversationSimulation";
import { initialMessage as roiInitialMessage } from "~/server/speed2Lead/messages";
import type { ConversationContext } from "~/server/speed2Lead/types";

describe("Speed2Lead conversation simulation audit", () => {
  const results = runAllSimulations();
  const failures = results.filter((r) => r.violations.length > 0);

  test(`runs ${SIMULATION_SCENARIOS.length} scenarios across all flows`, () => {
    expect(SIMULATION_SCENARIOS.length).toBeGreaterThanOrEqual(50);

    const roiCount = SIMULATION_SCENARIOS.filter((s) => s.flow === "roi").length;
    const contactCount = SIMULATION_SCENARIOS.filter((s) => s.flow === "contact").length;
    const demoCount = SIMULATION_SCENARIOS.filter((s) => s.flow === "demo").length;

    expect(roiCount).toBeGreaterThanOrEqual(15);
    expect(contactCount).toBeGreaterThanOrEqual(15);
    expect(demoCount).toBeGreaterThanOrEqual(15);
  });

  for (const scenario of SIMULATION_SCENARIOS) {
    test(`${scenario.flow.toUpperCase()}: ${scenario.name}`, () => {
      const result = simulateScenario(scenario);
      expect(result.violations).toEqual([]);
    });
  }

  test("summary: no scenario violations", () => {
    if (failures.length > 0) {
      const detail = failures
        .map((f) => `${f.name}: ${f.violations.join("; ")}`)
        .join("\n");
      throw new Error(`${failures.length} scenario(s) failed:\n${detail}`);
    }
    expect(failures.length).toBe(0);
  });
});

describe("ROI opening behavior", () => {
  test("always uses standard conversational opening regardless of ROI value", () => {
    const context: ConversationContext = {
      phone: "+15551234567",
      firstName: "Alex",
      businessName: "Test Plumbing",
      annualOpportunity: "$1,806,780",
      primaryOpportunity: "Missed calls",
      reportUrl: "https://624voice.com/report/test",
      bookingUrl: "https://calendar.app.google/test",
      state: "awaiting_problem",
      updatedAt: new Date().toISOString(),
    };

    const opening = roiInitialMessage(context);
    expect(opening).toContain("where do you think you're losing the most opportunities");
    expect(opening).not.toContain("calendar.app.google");
    expect(opening).not.toContain("jumped out at me");
  });
});

describe("meeting readiness nuance", () => {
  test("ROI: interested alone asks one question before calendar", () => {
    const result = simulateScenario({
      flow: "roi",
      name: "nuance-check-interested",
      steps: ["interested", "missed calls after hours"],
      expect: { maxQuestions: 1, expectCalendar: true },
    });
    expect(result.violations).toEqual([]);
    expect(result.questionCount).toBe(1);
  });

  test("ROI: can we talk sends calendar with zero questions", () => {
    const result = simulateScenario({
      flow: "roi",
      name: "nuance-check-explicit",
      steps: ["can we talk?"],
      expect: { maxQuestions: 0, expectCalendar: true },
    });
    expect(result.violations).toEqual([]);
    expect(result.questionCount).toBe(0);
  });

  test("Demo: pretty cool asks workload question before calendar", () => {
    const result = simulateScenario({
      flow: "demo",
      name: "nuance-check-mild-demo",
      steps: ["pretty cool", "scheduling"],
      expect: { maxQuestions: 1, expectCalendar: true },
    });
    expect(result.violations).toEqual([]);
  });
});
