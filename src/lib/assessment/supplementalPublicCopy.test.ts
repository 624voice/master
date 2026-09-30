import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LIFECYCLE_HEADLINE,
  LIFECYCLE_NOTE,
} from "~/components/CustomerLifecycleDiagram";

const REPO_ROOT = join(import.meta.dir, "../../..");

function readRoute(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

/** Strip JSX/block comments so S-RT-10 checks visitor-facing copy only. */
function stripJsxComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("public copy supplemental S-RT", () => {
  test("S-RT-07: homepage route exists with approved hero headline", () => {
    const source = readRoute("src/routes/index.tsx");
    expect(source).toContain(
      "Turn More Leads Into Booked Work and Keep Customers Coming Back",
    );
  });

  test("S-RT-08: assessment route is registered in generated route tree", () => {
    const routeTree = readRoute("src/routeTree.gen.ts");
    expect(routeTree).toContain("path: '/assessment'");
    expect(readRoute("src/routes/assessment.tsx")).toContain(
      'createFileRoute("/assessment")',
    );
  });

  test("S-RT-09: what-we-do route uses approved H1", () => {
    const source = readRoute("src/routes/what-we-do.tsx");
    expect(source).toContain("Improve the Customer Journey");
    expect(source).toContain("One Priority at a Time");
  });

  test("S-RT-10: visitor-facing lifecycle and homepage copy contain no em dashes", () => {
    const homepage = stripJsxComments(readRoute("src/routes/index.tsx"));
    const combined = `${homepage}\n${LIFECYCLE_HEADLINE}\n${LIFECYCLE_NOTE}`;
    expect(combined).not.toMatch(/[\u2013\u2014]/);
  });

  test("S-RT-11: nav includes Free Assessment link", () => {
    const root = readRoute("src/routes/__root.tsx");
    expect(root).toContain('href="/assessment"');
    expect(root).toContain("Free Assessment");
  });

  test("S-RT-12: assessment report route uses server handler import", () => {
    const route = readRoute("src/routes/assessment-report/$token.ts");
    expect(route).toContain("serveAssessmentTokenPdf");
    expect(route).not.toContain("getReportTokenData");
  });
});
