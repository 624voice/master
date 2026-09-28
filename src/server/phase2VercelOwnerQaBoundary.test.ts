import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isOwnerQaReportFailOnceEnabled,
  isPhase2OwnerQaExecutionActive,
  isPhase2VercelOwnerQaBoundary,
} from "~/server/phase2OwnerQaBoundary";

const REPO_ROOT = join(import.meta.dir, "../..");

describe("Phase 2 Vercel owner QA boundary", () => {
  test("X-VERCEL-OWNER-QA-01: boundary requires PHASE2_VERCEL_OWNER_QA and VERCEL_ENV=preview", () => {
    expect(
      isPhase2VercelOwnerQaBoundary({
        PHASE2_VERCEL_OWNER_QA: "1",
        VERCEL_ENV: "preview",
      }),
    ).toBe(true);
    expect(
      isPhase2VercelOwnerQaBoundary({
        PHASE2_VERCEL_OWNER_QA: "1",
        VERCEL_ENV: "production",
      }),
    ).toBe(false);
    expect(
      isPhase2VercelOwnerQaBoundary({
        VERCEL_ENV: "preview",
      }),
    ).toBe(false);
  });

  test("X-VERCEL-OWNER-QA-02: missing credentials alone do not activate execution boundary", () => {
    expect(
      isPhase2OwnerQaExecutionActive({
        VERCEL_ENV: "preview",
      }),
    ).toBe(false);
  });

  test("X-VERCEL-OWNER-QA-03: visitor-controlled env keys are not read in assessment route", () => {
    const routes = readFileSync(join(REPO_ROOT, "src/routes/assessment.tsx"), "utf8");
    expect(routes).not.toMatch(/searchParams|query\.|PHASE2_VERCEL|PHASE2_SAFE_PREVIEW|fixtureMode|qaMode/i);
  });

  test("X-VERCEL-OWNER-QA-04: report fail-once requires boundary plus explicit flag", () => {
    expect(
      isOwnerQaReportFailOnceEnabled({
        PHASE2_VERCEL_OWNER_QA: "1",
        VERCEL_ENV: "preview",
        PHASE2_OWNER_QA_REPORT_FAIL_ONCE: "1",
      }),
    ).toBe(true);
    expect(
      isOwnerQaReportFailOnceEnabled({
        PHASE2_VERCEL_OWNER_QA: "1",
        VERCEL_ENV: "preview",
        QUERY_PHASE2_OWNER_QA_REPORT_FAIL_ONCE: "1",
      }),
    ).toBe(false);
  });
});
