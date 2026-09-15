/**
 * Final verification at current HEAD — writes review-artifacts/phase2/final-verification.json
 * Run: bun run scripts/phase2/run-final-verification.ts
 */
import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const OUT = join(ROOT, "review-artifacts/phase2");

function run(cmd: string) {
  const started = Date.now();
  const result = spawnSync("bash", ["-lc", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const passMatch = output.match(/(\d+) pass/);
  const failMatch = output.match(/(\d+) fail/);
  const skipMatch = output.match(/(\d+) skip/);
  const timeoutMatch = output.match(/(\d+) timeout/);
  const fileMatch = output.match(/Ran (\d+) tests across (\d+) files\. \[([\d.]+)s\]/);
  return {
    command: cmd,
    status: result.status ?? 1,
    durationMs: fileMatch
      ? Math.round(Number(fileMatch[3]) * 1000)
      : Date.now() - started,
    pass: passMatch ? Number(passMatch[1]) : 0,
    fail: failMatch ? Number(failMatch[1]) : 0,
    skip: skipMatch ? Number(skipMatch[1]) : 0,
    timeout: timeoutMatch ? Number(timeoutMatch[1]) : 0,
    tests: fileMatch ? Number(fileMatch[1]) : null,
    files: fileMatch ? Number(fileMatch[2]) : null,
    tail: output.split("\n").slice(-10).join("\n").trim(),
  };
}

mkdirSync(OUT, { recursive: true });
const endingSha = execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
writeFileSync(join(OUT, "ending-sha.txt"), `${endingSha}\n`);

execSync("bun run scripts/phase2/run-human-keyboard-qa.ts", { cwd: ROOT, stdio: "inherit" });
execSync("bun run scripts/phase2/run-accessibility-qa.ts", { cwd: ROOT, stdio: "inherit" });
execSync("bun run scripts/phase2/generate-accessibility-reconciliation.ts", { cwd: ROOT, stdio: "inherit" });
execSync("bun run scripts/phase2/run-typescript-measurement.ts", { cwd: ROOT, stdio: "inherit" });
execSync("bun run scripts/phase2/run-typescript-baseline-reconciliation.ts", { cwd: ROOT, stdio: "inherit" });
execSync("bun run scripts/phase2/run-typescript-measurement-chronology.ts", { cwd: ROOT, stdio: "inherit" });
execSync("bun run scripts/phase2/generate-x-test-inventory.ts", { cwd: ROOT, stdio: "inherit" });
execSync("bun run scripts/phase2/reconcile-x-inventory-delta.ts", { cwd: ROOT, stdio: "inherit" });
execSync("bun run scripts/phase2/generate-git-sha-reconciliation.ts", { cwd: ROOT, stdio: "inherit" });

const fiveRuns = [];
for (let i = 1; i <= 5; i += 1) {
  fiveRuns.push({ run: i, gitSha: endingSha, ...run("bun test 2>&1") });
}
writeFileSync(join(OUT, "stability-five-full-suite-runs.json"), JSON.stringify(fiveRuns, null, 2));

const msgSidRuns = [];
for (let i = 1; i <= 3; i += 1) {
  msgSidRuns.push({
    run: i,
    gitSha: endingSha,
    ...run('bun test src/server/sms/sendState.duplication.test.ts -t "inbound reply" 2>&1'),
  });
}
writeFileSync(join(OUT, "stability-messagesid-three-runs.json"), JSON.stringify(msgSidRuns, null, 2));

execSync("bun run scripts/phase2/run-safe-qa-build-evidence.ts", { cwd: ROOT, stdio: "inherit" });
execSync("bun run scripts/phase2/generate-approved-id-reconciliation.ts", { cwd: ROOT, stdio: "inherit" });

execSync(
  `bun -e "import m from './tests/fixtures/phase2-baseline/protected-manifest.json'; import {createHash} from 'crypto'; import {readFileSync,writeFileSync} from 'fs'; const rows=Object.entries(m.files).map(([p,h])=>{const c=createHash('sha256').update(readFileSync(p)).digest('hex'); return {baselinePath:p,baselineSha256:h,currentSha256:c,match:c===h};}); writeFileSync('review-artifacts/phase2/protected-manifest-table.json', JSON.stringify(rows,null,2));"`,
  { cwd: ROOT, stdio: "pipe" },
);

const manifestRows = JSON.parse(
  readFileSync(join(OUT, "protected-manifest-table.json"), "utf8"),
) as Array<{ match: boolean }>;
const protectedManifest = manifestRows.every((r) => r.match);

const bundleBoundary = run("bun test src/server/report/bundleBoundary.test.ts 2>&1");
const parity = run("bun test src/server/assessment/protectedAgentParity.test.ts 2>&1");
const prodTypecheck = run("bun run typecheck 2>&1");
const cleanBuild = run("NODE_ENV=production bun run build 2>&1");

const tsComparison = JSON.parse(
  readFileSync(join(OUT, "typescript-comparison.json"), "utf8"),
);
const a11y = JSON.parse(readFileSync(join(OUT, "accessibility-inline-results.json"), "utf8"));
const approvedIds = JSON.parse(readFileSync(join(OUT, "approved-id-reconciliation.json"), "utf8"));
const additionalTests = JSON.parse(readFileSync(join(OUT, "additional-tests-table.json"), "utf8"));

const result = {
  endingSha,
  fiveConsecutiveFullSuites: fiveRuns,
  messageSidThreeRuns: msgSidRuns,
  productionTypecheck: {
    command: "bun run typecheck",
    exitStatus: prodTypecheck.status,
    diagnosticCount: tsComparison.production?.totalDiagnosticCount,
  },
  testScopeTypecheck: {
    command: "bun run typecheck:test",
    exitStatus: tsComparison.testScope?.exitStatus,
    diagnosticCount: tsComparison.testScope?.totalDiagnosticCount,
    phase2ModifiedTestFileDiagnostics: tsComparison.phase2ModifiedTestFileDiagnostics,
  },
  qaScopeTypecheck: {
    command: "bun run typecheck:qa",
    exitStatus: tsComparison.qaScope?.exitStatus,
    diagnosticCount: tsComparison.qaScope?.totalDiagnosticCount,
  },
  productionBuildClean: {
    command: "NODE_ENV=production bun run build",
    exitStatus: cleanBuild.status,
  },
  sBnd: bundleBoundary,
  sParity: parity,
  protectedManifestZeroDiff: protectedManifest,
  approvedIdReconciliation: { rowCount: approvedIds.length, exact: approvedIds.length === 162 },
  xTestsOutside162: {
    rowCount: additionalTests.length,
    uniqueIds: new Set(additionalTests.map((r: { id: string }) => r.id)).size,
    confirmed: additionalTests.length >= 78,
  },
  accessibility: {
    passCount: a11y.requirements.filter((r: { result: string }) => r.result === "pass").length,
    failCount: a11y.requirements.filter((r: { result: string }) => r.result === "fail").length,
    deferredCount: a11y.requirements.filter((r: { result: string }) => r.result === "unexecuted (deferred)").length,
    remainingObjectiveDefects: a11y.summary.remainingDefects,
    screenReaderDeferred: a11y.summary.actualScreenReaderChecksUnexecuted,
  },
  allGatesPass:
    fiveRuns.every((r) => r.status === 0 && r.fail === 0) &&
    msgSidRuns.every((r) => r.status === 0 && r.fail === 0) &&
    tsComparison.acceptance?.phase2QaScriptsZero &&
    tsComparison.acceptance?.allListedPhase2TestFilesZero &&
    cleanBuild.status === 0 &&
    bundleBoundary.status === 0 &&
    parity.status === 0 &&
    protectedManifest &&
    approvedIds.length === 162 &&
    a11y.summary.remainingDefects === 0 &&
    a11y.requirements.filter((r: { result: string }) => r.result === "pass").length === 89 &&
    a11y.requirements.filter((r: { result: string }) => r.result === "fail").length === 0,
};

writeFileSync(join(OUT, "final-verification.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(result.allGatesPass ? 0 : 1);
