import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ANALYTICS_EVENT_CONTRACT,
  assertAnalyticsPropsAllowed,
  CONTACT_ANSWER_PROHIBITED_EVENTS,
  LIMITED_PAYLOAD_ANALYTICS_EVENTS,
} from "~/lib/analytics/analyticsContract";
import {
  ANALYTICS_EVENTS,
  isLimitedPayloadAnalyticsEvent,
} from "~/lib/analytics/trackEvent";

const REPO_ROOT = join(import.meta.dir, "../../..");

function readSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("analytics privacy contract", () => {
  test("S-AN-02: exactly four limited-payload events; six prohibit contact/answer/token props", () => {
    expect(LIMITED_PAYLOAD_ANALYTICS_EVENTS.size).toBe(4);
    expect(CONTACT_ANSWER_PROHIBITED_EVENTS.size).toBe(6);
    for (const event of Object.values(ANALYTICS_EVENTS)) {
      expect(isLimitedPayloadAnalyticsEvent(event)).toBe(
        LIMITED_PAYLOAD_ANALYTICS_EVENTS.has(event),
      );
    }
  });

  test("S-AN-03: contract defines all ten events with dispatch points", () => {
    expect(ANALYTICS_EVENT_CONTRACT).toHaveLength(10);
    const events = ANALYTICS_EVENT_CONTRACT.map((row) => row.event).sort();
    expect(events).toEqual(Object.values(ANALYTICS_EVENTS).sort());
  });

  for (const row of ANALYTICS_EVENT_CONTRACT) {
    test(`S-AN-04 positive ${row.event}: permitted props pass allowlist`, () => {
      const props = Object.fromEntries(
        Object.keys(row.permittedProperties).map((key) => {
          if (key === "followUpCount") return [key, 2];
          if (key === "hasEstimate") return [key, "true"];
          if (key === "dimension") return [key, "GF"];
          if (key === "questionId") return [key, "GF-S"];
          if (key === "source") return [key, "assessment"];
          return [key, "ok"];
        }),
      );
      expect(() => assertAnalyticsPropsAllowed(row.event, props)).not.toThrow();
    });

    test(`S-AN-05 negative ${row.event}: forbidden contact/answer/token props rejected`, () => {
      for (const forbidden of ["email", "phone", "firstName", "token"]) {
        expect(() =>
          assertAnalyticsPropsAllowed(row.event, { [forbidden]: "x" }),
        ).toThrow(/unapproved property|forbidden/i);
      }
    });
  }

  test("X-AN-01: assessment route trackEvent calls exclude raw contact fields", () => {
    const source = readSource("src/routes/assessment.tsx");
    expect(source).not.toMatch(/trackEvent\([^)]*email/i);
    expect(source).not.toMatch(/trackEvent\([^)]*phone/i);
    expect(source).not.toMatch(/trackEvent\([^)]*firstName/i);
    expect(source).not.toMatch(/trackEvent\([^)]*reportToken/i);
  });

  test("X-AN-02: server submit handler trackEvent calls exclude raw contact fields", () => {
    const source = readSource("src/server/submitAssessmentLead.server.ts");
    expect(source).not.toMatch(/trackEvent\([^)]*email/i);
    expect(source).not.toMatch(/trackEvent\([^)]*phone/i);
    expect(source).not.toMatch(/trackEvent\([^)]*firstName/i);
  });
});
