/**
 * Baseline/current TypeScript reconciliation at comparable measurement conditions.
 * Baseline SHA: 05def6b | Current verification SHA: 15a4a9c
 */
import { createHash } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const OUT = join(ROOT, "review-artifacts/phase2");
const BASELINE_SHA = "05def6b17c7645d783c85df92d1e4053099c2ea4";
const CURRENT_SHA =
  process.env.PHASE2_CURRENT_SHA?.trim() ||
  execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
const WORKTREE = join(ROOT, ".phase2-ts-baseline-worktree");

type Diagnostic = {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  key: string;
};

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function parseDiagnostics(output: string, cwd: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of output.split("\n")) {
    const match = line.match(/^(.*)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
    if (!match) continue;
    const file = match[1]!.replace(`${cwd}/`, "").replace(/^\.\//, "");
    diagnostics.push({
      file,
      line: Number(match[2]),
      column: Number(match[3]),
      code: match[4]!,
      message: match[5]!,
      key: `${file}:${match[2]}:${match[3]}:${match[4]}:${match[5]}`,
    });
  }
  return diagnostics;
}

function measureScope(cwd: string, config: string, label: string, npmScript: string) {
  const configPath = join(cwd, config);
  if (!existsSync(configPath)) {
    return {
      available: false,
      label,
      config,
      reason: `${config} did not exist at this revision`,
    };
  }
  const result = spawnSync("bunx", ["tsc", "-p", config], { cwd, encoding: "utf8" });
  const raw = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const diagnostics = parseDiagnostics(raw, cwd);
  const logPath = join(OUT, `typescript-${label}.log`);
  writeFileSync(logPath, raw);
  const includedFiles = spawnSync("bunx", ["tsc", "-p", config, "--listFilesOnly"], {
    cwd,
    encoding: "utf8",
  });
  const files = (includedFiles.stdout ?? "")
    .split("\n")
    .filter(Boolean)
    .map((p) => p.replace(`${cwd}/`, ""));
  writeFileSync(join(OUT, `typescript-${label}-included-files.txt`), files.join("\n"));
  return {
    available: true,
    label,
    command: `bun run ${npmScript}`,
    workingDirectory: cwd.replace(`${ROOT}/`, "") || ".",
    bunVersion: execSync("bun --version", { cwd, encoding: "utf8" }).trim(),
    typescriptVersion: execSync("bunx tsc --version", { cwd, encoding: "utf8" }).trim(),
    config,
    configSha256: sha256File(configPath),
    dependencyConditions:
      label.includes("baseline")
        ? "Baseline package.json/lockfile; bun-types added in worktree only for comparability (not committed to baseline SHA)"
        : "Current package.json/lockfile including bun-types devDependency",
    includedFileCount: files.length,
    exitStatus: result.status ?? 0,
    totalDiagnosticCount: diagnostics.length,
    artifactLogPath: logPath.replace(`${ROOT}/`, ""),
    includedFilesInventoryPath: `review-artifacts/phase2/typescript-${label}-included-files.txt`,
    diagnostics,
  };
}

function ensureBaselineWorktree(): void {
  if (!existsSync(WORKTREE)) {
    execSync(`git worktree add ${WORKTREE} ${BASELINE_SHA}`, { cwd: ROOT, stdio: "pipe" });
  }
  execSync("bun install --silent", { cwd: WORKTREE, stdio: "pipe" });
  const pkg = JSON.parse(readFileSync(join(WORKTREE, "package.json"), "utf8")) as {
    devDependencies?: Record<string, string>;
  };
  if (!pkg.devDependencies?.["bun-types"]) {
    execSync("bun add -d bun-types@1.3.14", { cwd: WORKTREE, stdio: "pipe" });
  }
  const testConfigPath = join(WORKTREE, "tsconfig.test.json");
  if (existsSync(testConfigPath)) {
    let testConfig = readFileSync(testConfigPath, "utf8");
    testConfig = testConfig.replace(/"types": \["bun"\]/, '"types": ["bun-types"]');
    if (!testConfig.includes("**/*.test.tsx")) {
      testConfig = testConfig.replace(
        '"src/**/*.test.ts"',
        '"src/**/*.test.ts",\n    "src/**/*.test.tsx"',
      );
    }
    writeFileSync(testConfigPath, testConfig);
  }
  const prodConfigPath = join(WORKTREE, "tsconfig.json");
  if (existsSync(prodConfigPath)) {
    let prodConfig = readFileSync(prodConfigPath, "utf8");
    if (!prodConfig.includes("**/*.test.tsx")) {
      prodConfig = prodConfig.replace(
        '"**/*.test.ts"',
        '"**/*.test.ts",\n    "**/*.test.tsx"',
      );
    }
    if (!prodConfig.includes("**/testSupport/**")) {
      prodConfig = prodConfig.replace(
        '"**/*.integration.test.ts"',
        '"**/*.integration.test.ts",\n    "**/testSupport/**"',
      );
    }
    writeFileSync(prodConfigPath, prodConfig);
  }
  execSync("bun run build", { cwd: WORKTREE, stdio: "pipe" });
}

function compareDiagnostics(
  baseline: Diagnostic[],
  current: Diagnostic[],
  scope: string,
) {
  const baselineSet = new Set(baseline.map((d) => d.key));
  const currentSet = new Set(current.map((d) => d.key));
  const rows = [];
  for (const key of new Set([...baselineSet, ...currentSet])) {
    const b = baseline.find((d) => d.key === key);
    const c = current.find((d) => d.key === key);
    let disposition: string;
    if (b && c) disposition = "unchanged";
    else if (b && !c) disposition = "removed";
    else if (!b && c) disposition = "introduced";
    else disposition = "moved";
    rows.push({
      scope,
      file: (c ?? b)!.file,
      line: (c ?? b)!.line,
      column: (c ?? b)!.column,
      code: (c ?? b)!.code,
      message: (c ?? b)!.message,
      presentAtBaseline: Boolean(b),
      presentCurrently: Boolean(c),
      disposition,
      explanation:
        disposition === "introduced"
          ? "Not present at baseline SHA; investigate Phase 2 file or dependency/config delta"
          : disposition === "removed"
            ? "Present at baseline but absent currently"
            : disposition === "unchanged"
              ? "Pre-existing legacy diagnostic unchanged"
              : "Key mismatch review",
    });
  }
  return rows;
}

function diagnosticsForFile(
  filePath: string,
  productionDiagnostics: Diagnostic[],
  testDiagnostics: Diagnostic[],
  qaDiagnostics: Diagnostic[],
  config: string,
): number {
  const match = (d: Diagnostic) => d.file.endsWith(filePath) || d.file === filePath;
  if (config === "tsconfig.qa.json") return qaDiagnostics.filter(match).length;
  if (config === "tsconfig.test.json") return testDiagnostics.filter(match).length;
  return productionDiagnostics.filter(match).length;
}

function phase2Inventory(
  productionDiagnostics: Diagnostic[],
  testDiagnostics: Diagnostic[],
  qaDiagnostics: Diagnostic[],
) {
  const diff = execSync(`git diff --name-status ${BASELINE_SHA}..${CURRENT_SHA}`, {
    cwd: ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split("\t");
      return { status, path: rest.join("\t") };
    });

  const categories = {
    production: [] as string[],
    test: [] as string[],
    browserJourney: [] as string[],
    qaScript: [] as string[],
  };

  for (const { path } of diff) {
    if (!path.endsWith(".ts") && !path.endsWith(".tsx")) continue;
    if (path.startsWith("scripts/phase2/")) categories.qaScript.push(path);
    else if (path.startsWith("src/browser-journey/")) categories.browserJourney.push(path);
    else if (path.includes(".test.")) categories.test.push(path);
    else if (path.startsWith("src/")) categories.production.push(path);
  }

  const allPaths = [
    ...categories.production.map((p) => ({ path: p, kind: "production", config: "tsconfig.json" })),
    ...categories.test.map((p) => ({ path: p, kind: "test", config: "tsconfig.test.json" })),
    ...categories.browserJourney.map((p) => ({ path: p, kind: "browser-journey", config: "tsconfig.test.json" })),
    ...categories.qaScript.map((p) => ({ path: p, kind: "qa-script", config: "tsconfig.qa.json" })),
  ];

  return allPaths.map(({ path, kind, config }) => {
    const statusLine = diff.find((d) => d.path === path)?.status ?? "M";
    const prodCount = diagnosticsForFile(
      path,
      productionDiagnostics,
      testDiagnostics,
      qaDiagnostics,
      config,
    );
    const testResult = spawnSync("bunx", ["tsc", "-p", config, "--listFilesOnly"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const included = (testResult.stdout ?? "").includes(join(ROOT, path));
    return {
      path,
      newOrModified: statusLine.startsWith("A") ? "new" : "modified",
      category: kind,
      coveringConfiguration: config,
      includedInMeasurement: included ? "yes" : "no",
      diagnosticCount: prodCount,
      result: prodCount === 0 ? "pass" : "fail",
    };
  });
}

mkdirSync(OUT, { recursive: true });
ensureBaselineWorktree();

const productionBaseline = measureScope(WORKTREE, "tsconfig.json", "production-baseline", "typecheck");
const productionCurrent = measureScope(ROOT, "tsconfig.json", "production-current", "typecheck");
const testBaseline = measureScope(WORKTREE, "tsconfig.test.json", "test-baseline", "typecheck:test");
const testCurrent = measureScope(ROOT, "tsconfig.test.json", "test-current", "typecheck:test");
const qaCurrent = measureScope(ROOT, "tsconfig.qa.json", "qa-current", "typecheck:qa");
const qaBaseline = {
  available: false,
  label: "qa-baseline",
  config: "tsconfig.qa.json",
  reason: "tsconfig.qa.json and scripts/phase2/** did not exist at starting SHA 05def6b; no direct baseline diagnostic count",
  currentFilesCovered: existsSync(join(ROOT, "tsconfig.qa.json"))
    ? readFileSync(join(ROOT, "tsconfig.qa.json"), "utf8")
    : "",
  currentDiagnosticCount: qaCurrent.available ? qaCurrent.totalDiagnosticCount : null,
};

const prodComparison = compareDiagnostics(
  productionBaseline.available ? productionBaseline.diagnostics! : [],
  productionCurrent.available ? productionCurrent.diagnostics! : [],
  "production",
);
const testComparison = compareDiagnostics(
  testBaseline.available ? testBaseline.diagnostics! : [],
  testCurrent.available ? testCurrent.diagnostics! : [],
  "test",
);

const introduced = [...prodComparison, ...testComparison].filter((r) => r.disposition === "introduced");
const removed = [...prodComparison, ...testComparison].filter((r) => r.disposition === "removed");
const unchanged = [...prodComparison, ...testComparison].filter((r) => r.disposition === "unchanged");

const phase2Files = phase2Inventory(
  productionCurrent.available ? productionCurrent.diagnostics! : [],
  testCurrent.available ? testCurrent.diagnostics! : [],
  qaCurrent.available ? qaCurrent.diagnostics! : [],
);

const phase2Paths = new Set(phase2Files.map((f) => f.path));
const phase2Introduced = introduced.filter(
  (r) =>
    phase2Paths.has(r.file) ||
    [...phase2Paths].some((p) => r.file.endsWith(p)),
);

const result = {
  baselineSha: BASELINE_SHA,
  currentVerificationSha: CURRENT_SHA,
  comparabilityNote:
    "Baseline measurements run in detached worktree at 05def6b with bun install and temporary bun-types@1.3.14 added only in the worktree (baseline Git tree unmodified). Current measurements run at verification SHA with existing bun-types devDependency. Same bun 1.3.14 and tsc invocation for both sides.",
  production: { baseline: productionBaseline, current: productionCurrent },
  testScope: { baseline: testBaseline, current: testCurrent },
  qaScope: { baseline: qaBaseline, current: qaCurrent },
  diagnosticComparison: {
    unchangedCount: unchanged.length,
    removedCount: removed.length,
    introducedCount: introduced.length,
    introduced,
    removed,
    rows: [...prodComparison, ...testComparison],
  },
  phase2TypeScriptInventory: phase2Files,
  acceptance: {
    zeroPhase2Introduced: phase2Introduced.length === 0,
    phase2IntroducedDiagnostics: phase2Introduced,
    allPhase2ProductionFilesZero: phase2Files
      .filter((f) => f.category === "production")
      .every((f) => f.diagnosticCount === 0),
    allPhase2TestFilesZero: phase2Files
      .filter((f) => f.category === "test" || f.category === "browser-journey")
      .every((f) => f.diagnosticCount === 0),
    allPhase2QaScriptFilesZero: phase2Files
      .filter((f) => f.category === "qa-script")
      .every((f) => f.diagnosticCount === 0),
  },
};

writeFileSync(join(OUT, "typescript-baseline-reconciliation.json"), JSON.stringify(result, null, 2));
writeFileSync(
  join(OUT, "typescript-comparison.json"),
  JSON.stringify(
    {
      baselineSha: BASELINE_SHA,
      currentHeadSha: CURRENT_SHA,
      note: result.comparabilityNote,
      production: productionCurrent,
      testScope: testCurrent,
      qaScope: qaCurrent,
      baselineProductionCount: productionBaseline.available
        ? productionBaseline.totalDiagnosticCount
        : null,
      baselineTestCount: testBaseline.available ? testBaseline.totalDiagnosticCount : null,
      introducedCount: introduced.length,
      phase2IntroducedCount: phase2Introduced.length,
      acceptance: result.acceptance,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      production: {
        baseline: productionBaseline.totalDiagnosticCount,
        current: productionCurrent.totalDiagnosticCount,
      },
      test: { baseline: testBaseline.totalDiagnosticCount, current: testCurrent.totalDiagnosticCount },
      qa: { baseline: "N/A", current: qaCurrent.totalDiagnosticCount },
      introduced: introduced.length,
      phase2Introduced: phase2Introduced.length,
      phase2InventoryFiles: phase2Files.length,
    },
    null,
    2,
  ),
);
