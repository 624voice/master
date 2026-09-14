/**
 * Standalone test/QA TypeScript measurement for baseline vs current comparison.
 * Run: bun run scripts/phase2/run-typescript-measurement.ts [--baseline-sha SHA]
 */
import { createHash } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(REPO_ROOT, "review-artifacts/phase2");
const BASELINE_SHA = process.argv.includes("--baseline-sha")
  ? process.argv[process.argv.indexOf("--baseline-sha") + 1]
  : "05def6b17c7645d783c85df92d1e4053099c2ea4";

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

function runTypecheck(label: string, configs: string[]): {
  label: string;
  command: string;
  bunVersion: string;
  typescriptVersion: string;
  configHashes: Record<string, string>;
  includedFiles: Record<string, string[]>;
  exitStatus: number;
  totalDiagnosticCount: number;
  diagnostics: Diagnostic[];
  artifactPath: string;
} {
  const commands = configs.map((cfg) => `tsc -p ${cfg}`);
  const command = commands.join(" && ");
  const results: Diagnostic[] = [];
  let exitStatus = 0;
  for (const cfg of configs) {
    const result = spawnSync("bunx", ["tsc", "-p", cfg], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    const chunk = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    results.push(...parseDiagnostics(chunk));
    if (result.status !== 0) exitStatus = result.status ?? 1;
  }
  const artifactPath = join(OUT, `typescript-${label}.log`);
  const body = results
    .map((d) => `${d.file}(${d.line},1): error ${d.code}: ${d.message}`)
    .join("\n");
  writeFileSync(artifactPath, body);

  const includedFiles: Record<string, string[]> = {};
  for (const cfg of configs) {
    includedFiles[cfg] = execSync(`bunx tsc -p ${cfg} --listFilesOnly`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean)
      .map((p) => p.replace(`${REPO_ROOT}/`, ""));
  }

  return {
    label,
    command: configs.map((cfg) => `bun run typecheck${cfg.includes("qa") ? ":qa" : cfg.includes("test") ? ":test" : ""}`).join(" ; "),
    bunVersion: execSync("bun --version", { encoding: "utf8" }).trim(),
    typescriptVersion: execSync("bunx tsc --version", { encoding: "utf8" }).trim(),
    configHashes: Object.fromEntries(configs.map((cfg) => [cfg, configHash(cfg)])),
    includedFiles,
    exitStatus,
    totalDiagnosticCount: results.length,
    diagnostics: results,
    artifactPath: artifactPath.replace(`${REPO_ROOT}/`, ""),
  };
}

function phase2ChangedFiles(): string[] {
  const diff = execSync(`git diff --name-only ${BASELINE_SHA}..HEAD`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return diff
    .split("\n")
    .filter(Boolean)
    .filter(
      (f) =>
        (f.startsWith("src/") && f.endsWith(".ts")) ||
        (f.startsWith("src/") && f.endsWith(".tsx")) ||
        f.startsWith("scripts/phase2/"),
    );
}

function diagnosticsForFiles(
  diagnostics: Diagnostic[],
  files: string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of files) {
    counts[file] = diagnostics.filter((d) => d.file.endsWith(file)).length;
  }
  return counts;
}

mkdirSync(OUT, { recursive: true });
const configs = ["tsconfig.test.json", "tsconfig.qa.json"];
const current = runTypecheck("current", configs);
const changed = phase2ChangedFiles();
const phase2Prod = changed.filter((f) => f.startsWith("src/") && !f.includes(".test."));
const phase2Tests = changed.filter((f) => f.includes(".test."));
const phase2Qa = changed.filter((f) => f.startsWith("scripts/phase2/"));

const prodTypecheck = spawnSync("bun", ["run", "typecheck"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
});
const prodDiagnostics = parseDiagnostics(
  `${prodTypecheck.stdout ?? ""}${prodTypecheck.stderr ?? ""}`,
);

const comparison = {
  baselineSha: BASELINE_SHA,
  currentHeadSha: execSync("git rev-parse HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim(),
  measurementCommand: "bun run typecheck:test && bun run typecheck:qa",
  current,
  phase2FileDiagnostics: {
    production: diagnosticsForFiles(prodDiagnostics, phase2Prod),
    tests: diagnosticsForFiles(current.diagnostics, phase2Tests),
    qaScripts: diagnosticsForFiles(current.diagnostics, phase2Qa),
  },
  acceptance: {
    phase2ProductionZero: Object.values(
      diagnosticsForFiles(prodDiagnostics, phase2Prod),
    ).every((n) => n === 0),
    phase2TestsZero: Object.values(
      diagnosticsForFiles(current.diagnostics, phase2Tests),
    ).every((n) => n === 0),
    phase2QaZero: Object.values(
      diagnosticsForFiles(current.diagnostics, phase2Qa),
    ).every((n) => n === 0),
  },
};

writeFileSync(join(OUT, "typescript-comparison.json"), JSON.stringify(comparison, null, 2));
console.log(JSON.stringify(comparison, null, 2));
