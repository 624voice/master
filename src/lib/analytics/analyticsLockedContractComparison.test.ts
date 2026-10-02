import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ANALYTICS_EVENT_CONTRACT,
  assertAnalyticsPropsAllowed,
} from "~/lib/analytics/analyticsContract";
import { ANALYTICS_EVENTS } from "~/lib/analytics/trackEvent";

const REPO_ROOT = join(import.meta.dir, "../../..");
const COMPARISON_PATH = join(
  REPO_ROOT,
  "review-artifacts/phase2/analytics-locked-contract-comparison.json",
);

const LIMITED_EVENTS = [
  ANALYTICS_EVENTS.lead_gate_complete,
  ANALYTICS_EVENTS.sms_consent_opt_in,
  ANALYTICS_EVENTS.assessment_complete,
  ANALYTICS_EVENTS.roi_agent_triggered,
] as const;

function lineOf(pattern: RegExp, file: string): number {
  const lines = readFileSync(join(REPO_ROOT, file), "utf8").split("\n");
  const index = lines.findIndex((line) => pattern.test(line));
  return index >= 0 ? index + 1 : -1;
}

describe("analytics locked contract comparison X-AN-CMP", () => {
  for (const event of LIMITED_EVENTS) {
    test(`X-AN-CMP positive ${event}: dispatched fields satisfy locked contract`, () => {
      const row = ANALYTICS_EVENT_CONTRACT.find((entry) => entry.event === event)!;
      const permittedKeys = Object.keys(row.permittedProperties);
      const props = Object.fromEntries(
        permittedKeys.map((key) => {
          if (key === "hasEstimate") return [key, "true"];
          if (key === "source") return [key, "assessment"];
          return [key, "ok"];
        }),
      );
      expect(() => assertAnalyticsPropsAllowed(event, props)).not.toThrow();
    });

    test(`X-AN-CMP negative ${event}: prohibited contact fields rejected`, () => {
      for (const forbidden of ["email", "phone", "firstName", "token"]) {
        expect(() =>
          assertAnalyticsPropsAllowed(event, { [forbidden]: "x" }),
        ).toThrow(/unapproved property|forbidden/i);
      }
    });
  }

  test("X-AN-CMP-05: durable comparison artifact exists for four limited events", () => {
    const comparison = JSON.parse(readFileSync(COMPARISON_PATH, "utf8")) as Array<{
      event: string;
      satisfiesLockedContract: boolean;
    }>;
    expect(comparison).toHaveLength(4);
    for (const event of LIMITED_EVENTS) {
      const row = comparison.find((entry) => entry.event === event);
      expect(row?.satisfiesLockedContract).toBe(true);
    }
  });

  test("X-AN-CMP-06: submit handler call-site lines recorded", () => {
    const assessmentCompleteLine = lineOf(
      /trackEvent\(ANALYTICS_EVENTS\.assessment_complete/,
      "src/server/submitAssessmentLead.server.ts",
    );
    const leadGateLine = lineOf(
      /trackEvent\(ANALYTICS_EVENTS\.lead_gate_complete/,
      "src/server/submitAssessmentLead.server.ts",
    );
    expect(assessmentCompleteLine).toBeGreaterThan(0);
    expect(leadGateLine).toBeGreaterThan(0);
  });
});
