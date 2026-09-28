import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isNetlifyDeployPreviewContext,
  isOwnerQaReportFailOnceEnabled,
  isPhase2HostedOwnerQaPreviewBoundary,
  isPhase2OwnerQaExecutionActive,
} from "~/server/phase2OwnerQaBoundary";

const REPO_ROOT = join(import.meta.dir, "../..");

describe("Phase 2 Netlify owner QA boundary", () => {
  test("X-NETLIFY-OWNER-QA-01: both PHASE2_OWNER_QA_PREVIEW and deploy-preview context required", () => {
    expect(
      isPhase2HostedOwnerQaPreviewBoundary({
        PHASE2_OWNER_QA_PREVIEW: "1",
        CONTEXT: "deploy-preview",
      }),
    ).toBe(true);
    expect(
      isPhase2HostedOwnerQaPreviewBoundary({
        PHASE2_OWNER_QA_PREVIEW: "1",
        CONTEXT: "production",
      }),
    ).toBe(false);
    expect(
      isPhase2HostedOwnerQaPreviewBoundary({
        CONTEXT: "deploy-preview",
      }),
    ).toBe(false);
    expect(isNetlifyDeployPreviewContext({ NETLIFY_CONTEXT: "deploy-preview" })).toBe(
      true,
    );
  });

  test("X-NETLIFY-OWNER-QA-02: missing credentials alone do not activate execution boundary", () => {
    expect(
      isPhase2OwnerQaExecutionActive({
        CONTEXT: "deploy-preview",
      }),
    ).toBe(false);
  });

  test("X-NETLIFY-OWNER-QA-03: visitor-controlled inputs are not read in assessment route", () => {
    const routes = readFileSync(join(REPO_ROOT, "src/routes/assessment.tsx"), "utf8");
    expect(routes).not.toMatch(
      /searchParams|query\.|PHASE2_OWNER_QA_PREVIEW|PHASE2_SAFE_PREVIEW|fixtureMode|qaMode/i,
    );
  });

  test("X-NETLIFY-OWNER-QA-04: report fail-once requires boundary plus explicit flag", () => {
    expect(
      isOwnerQaReportFailOnceEnabled({
        PHASE2_OWNER_QA_PREVIEW: "1",
        CONTEXT: "deploy-preview",
        PHASE2_OWNER_QA_REPORT_FAIL_ONCE: "1",
      }),
    ).toBe(true);
    expect(
      isOwnerQaReportFailOnceEnabled({
        PHASE2_OWNER_QA_PREVIEW: "1",
        CONTEXT: "deploy-preview",
        QUERY_PHASE2_OWNER_QA_REPORT_FAIL_ONCE: "1",
      }),
    ).toBe(false);
  });
});
