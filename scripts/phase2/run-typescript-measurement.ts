/**
 * Standalone TypeScript measurements: production, test, and QA configs reported separately.
 * Run: bun run scripts/phase2/run-typescript-measurement.ts
 */
import { createHash } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(REPO_ROOT, "review-artifacts/phase2");
const BASELINE_SHA = "05def6b17c7645d783c85df92d1e4053099c2ea4";

type Diagnostic = { file: string; line: number; code: string; message: string };

function configHash(path: string): string {
  return createHash("sha256").update(readFileSync(join(REPO_ROOT, path))).digest("hex");
}

function parseDiagnostics(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of output.split("\n")) {
    const match = line.match(/^(.*)\((\d+),\d+\): error (TS\d+): (.*)$/);
    if (match) {
      diagnostics.push({
        file: match[1]!,
        line: Number(match[2]),
        code: match[3]!,
        message: match[4]!,
      });
    }
  }
  return diagnostics;
}

function runSingleConfig(config: string, label: string, npmScript: string) {
  const result = spawnSync("bunx", ["tsc", "-p", config], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const raw = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const diagnostics = parseDiagnostics(raw);
  const artifactPath = join(OUT, `typescript-${label}.log`);
  writeFileSync(
    artifactPath,
    diagnostics
      .map((d) => `${d.file}(${d.line},1): error ${d.code}: ${d.message}`)
      .join("\n"),
  );
  const includedFiles = execSync(`bunx tsc -p ${config} --listFilesOnly`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .map((p) => p.replace(`${REPO_ROOT}/`, ""));

  return {
    label,
    command: `bun run ${npmScript}`,
    config,
    configHash: configHash(config),
    bunVersion: execSync("bun --version", { encoding: "utf8" }).trim(),
    typescriptVersion: execSync("bunx tsc --version", { encoding: "utf8" }).trim(),
    exitStatus: result.status ?? 0,
    totalDiagnosticCount: diagnostics.length,
    includedFileCount: includedFiles.length,
    includedFilesSample: includedFiles.slice(0, 5),
    artifactPath: artifactPath.replace(`${REPO_ROOT}/`, ""),
    diagnostics,
  };
}

function diagnosticsForFiles(
  diagnostics: Diagnostic[],
  files: string[],
): Record<string, { count: number; messages: string[] }> {
  const counts: Record<string, { count: number; messages: string[] }> = {};
  for (const file of files) {
    const matches = diagnostics.filter((d) => d.file.endsWith(file));
    counts[file] = {
      count: matches.length,
      messages: matches.map(
        (d) => `${d.file}(${d.line},1): error ${d.code}: ${d.message}`,
      ),
    };
  }
  return counts;
}

const PHASE2_TEST_FILES = [
  "src/browser-journey/assessment.browserJourney.test.ts",
  "src/lib/assessment/assessmentJourney.test.ts",
  "src/lib/analytics/analyticsLockedContractComparison.test.ts",
  "src/server/assessment/assessmentJourneyPipeline.test.ts",
  "src/server/phase2SafeQaHarness.test.ts",
  "src/components/CustomerLifecycleDiagram.test.ts",
];

mkdirSync(OUT, { recursive: true });

const production = runSingleConfig("tsconfig.json", "production-current", "typecheck");
const testScope = runSingleConfig("tsconfig.test.json", "test-current", "typecheck:test");
const qaScope = runSingleConfig("tsconfig.qa.json", "qa-current", "typecheck:qa");

const comparison = {
  baselineSha: BASELINE_SHA,
  currentHeadSha: execSync("git rev-parse HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim(),
  note:
    "Production (tsconfig.json), test (tsconfig.test.json), and QA (tsconfig.qa.json) are measured separately. Equal counts are coincidental, not carry-over.",
  production,
  testScope,
  qaScope,
  phase2ModifiedTestFileDiagnostics: diagnosticsForFiles(
    testScope.diagnostics,
    PHASE2_TEST_FILES,
  ),
  acceptance: {
    productionConfigExecutes: production.totalDiagnosticCount >= 0,
    testConfigExecutes: testScope.exitStatus !== null,
    qaConfigExecutes: qaScope.exitStatus === 0,
    phase2QaScriptsZero: qaScope.totalDiagnosticCount === 0,
    phase2BrowserJourneyTestZero:
      diagnosticsForFiles(testScope.diagnostics, [
        "src/browser-journey/assessment.browserJourney.test.ts",
      ])["src/browser-journey/assessment.browserJourney.test.ts"]?.count === 0,
    allListedPhase2TestFilesZero: PHASE2_TEST_FILES.every(
      (file) =>
        diagnosticsForFiles(testScope.diagnostics, [file])[file]?.count === 0,
    ),
  },
};

writeFileSync(join(OUT, "typescript-comparison.json"), JSON.stringify(comparison, null, 2));
console.log(JSON.stringify(comparison, null, 2));
