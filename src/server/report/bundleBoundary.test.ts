import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");

const FORBIDDEN_PATTERNS: Array<{ id: string; pattern: RegExp; label: string }> = [
  {
    id: "S-BND-01",
    label: "puppeteer-core",
    pattern: /puppeteer-core|from\s+["']puppeteer/i,
  },
  {
    id: "S-BND-02",
    label: "@sparticuz/chromium",
    pattern: /@sparticuz\/chromium/,
  },
  {
    id: "S-BND-03",
    label: "assessment HMAC secret env",
    pattern: /ASSESSMENT_SECURITY_HMAC_SECRET/,
  },
  {
    id: "S-BND-04",
    label: "Upstash Redis credentials",
    pattern: /UPSTASH_REDIS_REST_(URL|TOKEN)/,
  },
  {
    id: "S-BND-05",
    label: "Redis client accessor",
    pattern: /\bgetRedis\b/,
  },
];

const CLIENT_IMPORTABLE_PATHS: Array<{ id: string; relativePath: string }> = [
  {
    id: "S-BND-06",
    relativePath: "components/report/AssessmentReport.tsx",
  },
  {
    id: "S-BND-07",
    relativePath: "lib/assessment/buildAssessmentReportViewModel.ts",
  },
  {
    id: "S-BND-08",
    relativePath: "lib/assessment/runAssessment.ts",
  },
  {
    id: "S-BND-09",
    relativePath: "lib/assessment/engine.ts",
  },
  {
    id: "S-BND-10",
    relativePath: "lib/assessment/questions.ts",
  },
  {
    id: "S-BND-11",
    relativePath: "lib/assessment/validateAssessmentAnswers.ts",
  },
  {
    id: "S-BND-12",
    relativePath: "lib/assessment/buildLeadSummary.ts",
  },
];

const SERVER_ONLY_IMPORT_PATTERN = /from\s+["']~\/[^"']+\.server(?:\.|$)/;

async function readSource(relativePath: string): Promise<string> {
  return Bun.file(join(REPO_ROOT, relativePath)).text();
}

describe("assessment PDF bundle boundary", () => {
  for (const { id, relativePath } of CLIENT_IMPORTABLE_PATHS) {
    test(`${id}: ${relativePath} avoids server-only imports`, async () => {
      const source = await readSource(relativePath);
      expect(source).not.toMatch(SERVER_ONLY_IMPORT_PATTERN);
    });
  }

  for (const clientPath of CLIENT_IMPORTABLE_PATHS) {
    for (const forbidden of FORBIDDEN_PATTERNS) {
      test(`${forbidden.id} (${forbidden.label}) not referenced in ${clientPath.relativePath}`, async () => {
        const source = await readSource(clientPath.relativePath);
        expect(source).not.toMatch(forbidden.pattern);
      });
    }
  }

  test("S-BND-13: assessment token route dynamically imports isolated server handler", async () => {
    const routeSource = await readSource("routes/assessment-report/$token.ts");
    const serveSource = await readSource("server/report/serveAssessmentTokenPdf.server.ts");
    const tokenSource = await readSource("server/assessment/reportTokens.ts");

    expect(routeSource).toContain("serveAssessmentTokenPdf");
    expect(routeSource).toContain("~/server/report/serveAssessmentTokenPdf.server");
    expect(serveSource).toContain("getAssessmentReportTokenData");
    expect(tokenSource).toContain("assessment:report:");
    expect(serveSource).not.toContain("getReportTokenData");
    expect(serveSource).not.toContain("renderReportPdf");
  });

  test("S-BND-14: assessment PDF bytes use isolated renderAssessmentPdf pipeline", async () => {
    const generateSource = await readSource(
      "server/report/generateAssessmentPdfBytes.server.ts",
    );
    const renderPdfSource = await readSource("server/report/renderAssessmentPdf.server.ts");
    const renderHtmlSource = await readSource(
      "server/report/renderAssessmentHtml.server.tsx",
    );

    expect(generateSource).toContain("buildAssessmentReportViewModel");
    expect(generateSource).toContain("renderAssessmentPdf");
    expect(generateSource).not.toContain("renderReportPdf");
    expect(renderPdfSource).toContain("renderAssessmentHtml");
    expect(renderHtmlSource).toContain("AssessmentReport");
  });
});
