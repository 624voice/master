import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isNetlifyDeployPreviewContext,
  isOwnerQaReportFailOnceEnabled,
  isPhase2HostedOwnerQaPreviewBoundary,
  isPhase2OwnerQaExecutionActive,
} from "~/server/phase2OwnerQaBoundary";
import { getSiteOrigin } from "~/server/speed2Lead/config";

const REPO_ROOT = join(import.meta.dir, "../..");

describe("Phase 2 Netlify owner QA boundary", () => {
  test("X-NETLIFY-OWNER-QA-01 positive: both PHASE2_OWNER_QA_PREVIEW and deploy-preview context activate boundary", () => {
    expect(
      isPhase2HostedOwnerQaPreviewBoundary({
        PHASE2_OWNER_QA_PREVIEW: "1",
        CONTEXT: "deploy-preview",
      }),
    ).toBe(true);
    expect(isNetlifyDeployPreviewContext({ NETLIFY_CONTEXT: "deploy-preview" })).toBe(
      true,
    );
  });

  test("X-NETLIFY-OWNER-QA-02 negative: flag without deploy-preview context does not activate boundary", () => {
    expect(
      isPhase2HostedOwnerQaPreviewBoundary({
        PHASE2_OWNER_QA_PREVIEW: "1",
        CONTEXT: "production",
      }),
    ).toBe(false);
  });

  test("X-NETLIFY-OWNER-QA-03 negative: deploy-preview context without flag does not activate boundary", () => {
    expect(
      isPhase2HostedOwnerQaPreviewBoundary({
        CONTEXT: "deploy-preview",
      }),
    ).toBe(false);
  });

  test("X-NETLIFY-OWNER-QA-04 negative: missing credentials/flags alone do not activate execution boundary", () => {
    expect(
      isPhase2OwnerQaExecutionActive({
        CONTEXT: "deploy-preview",
      }),
    ).toBe(false);
  });

  test("X-NETLIFY-OWNER-QA-05: visitor-controlled inputs cannot set boundary env keys", () => {
    const boundarySource = readFileSync(
      join(REPO_ROOT, "src/server/phase2OwnerQaBoundary.ts"),
      "utf8",
    );
    expect(boundarySource).toMatch(/process\.env|NodeJS\.ProcessEnv/);
    expect(boundarySource).not.toMatch(
      /\b(searchParams|localStorage|getCookie|req\.query|request\.headers)\b/i,
    );
    const assessmentRoute = readFileSync(join(REPO_ROOT, "src/routes/assessment.tsx"), "utf8");
    expect(assessmentRoute).not.toMatch(/process\.env\.(PHASE2_OWNER_QA_PREVIEW|CONTEXT)\s*=/);
  });

  test("X-NETLIFY-OWNER-QA-06: assessment route does not read visitor QA switches", () => {
    const routes = readFileSync(join(REPO_ROOT, "src/routes/assessment.tsx"), "utf8");
    expect(routes).not.toMatch(
      /searchParams|query\.|PHASE2_OWNER_QA_PREVIEW|PHASE2_SAFE_PREVIEW|fixtureMode|qaMode/i,
    );
  });

  test("X-NETLIFY-OWNER-QA-07: hosted preview report URLs use deploy origin not production default", () => {
    const priorSite = process.env.SITE_ORIGIN;
    const priorDeploy = process.env.DEPLOY_PRIME_URL;
    process.env.PHASE2_OWNER_QA_PREVIEW = "1";
    process.env.CONTEXT = "deploy-preview";
    process.env.DEPLOY_PRIME_URL = "https://abc123--624voice-phase2-owner-qa.netlify.app";
    delete process.env.SITE_ORIGIN;
    expect(getSiteOrigin()).toBe("https://abc123--624voice-phase2-owner-qa.netlify.app");
    if (priorSite === undefined) delete process.env.SITE_ORIGIN;
    else process.env.SITE_ORIGIN = priorSite;
    if (priorDeploy === undefined) delete process.env.DEPLOY_PRIME_URL;
    else process.env.DEPLOY_PRIME_URL = priorDeploy;
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
