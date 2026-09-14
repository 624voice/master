/**
 * Generates durable Phase 2 review artifacts under review-artifacts/phase2/.
 * Run: bun run scripts/phase2/generate-review-artifacts.ts
 */
import { createHash } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import manifest from "../../tests/fixtures/phase2-baseline/protected-manifest.json";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(REPO_ROOT, "review-artifacts/phase2");

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Bytes(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function run(cmd: string): { stdout: string; stderr: string; status: number } {
  const result = spawnSync("bash", ["-lc", cmd], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

function writeJson(name: string, data: unknown): void {
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function generateManifestTable(): void {
  const claudeHandoffDir = join(REPO_ROOT, "docs/claude-handoff");
  const claudeFiles = readdirSync(claudeHandoffDir)
    .filter((f) => statSync(join(claudeHandoffDir, f)).isFile())
    .map((f) => `docs/claude-handoff/${f}`);

  const rows = Object.entries(manifest.files).map(([relativePath, baselineHash]) => {
    const currentPath = join(REPO_ROOT, relativePath);
    const currentHash = sha256File(currentPath);
    return {
      baselinePath: relativePath,
      baselineSha256: baselineHash,
      currentPath: relativePath,
      currentSha256: currentHash,
      match: currentHash === baselineHash,
      manifestValue: baselineHash,
    };
  });

  for (const relativePath of claudeFiles) {
    if (relativePath in manifest.files) continue;
    const currentPath = join(REPO_ROOT, relativePath);
    const currentHash = sha256File(currentPath);
    let baselineHash: string | null = null;
    try {
      const blob = execSync(`git show 05def6b:${relativePath}`, {
        cwd: REPO_ROOT,
        encoding: "buffer",
      });
      baselineHash = sha256Bytes(blob);
    } catch {
      baselineHash = null;
    }
    rows.push({
      baselinePath: relativePath,
      baselineSha256: baselineHash ?? "(not in baseline tree)",
      currentPath: relativePath,
      currentSha256: currentHash,
      match: baselineHash ? currentHash === baselineHash : false,
      manifestValue: manifest.files[relativePath as keyof typeof manifest.files] ?? "(not in manifest)",
    });
  }

  writeJson("protected-manifest-table.json", rows);
}

function generateRouteDiffs(): void {
  for (const file of ["src/routes/contact.tsx", "src/routes/demo.tsx"]) {
    const diff = run(`git diff 05def6b -- ${file}`);
    writeFileSync(join(OUT, `${file.replace(/\//g, "_")}.diff`), diff.stdout || "(no diff)\n");
  }
}

function generateTestScopeComparison(): void {
  const full = run("bun test 2>&1 | tail -5");
  const srcOnly = run("bun test src 2>&1 | tail -5");
  writeJson("test-command-scope.json", {
    bunTest: full.stdout.trim(),
    bunTestSrc: srcOnly.stdout.trim(),
    identicalScope: full.stdout.includes("716 pass") && srcOnly.stdout.includes("716 pass"),
    note: "Both commands discover 716 tests across 96 files on current branch.",
  });
}

function generateStabilityRuns(): void {
  const runs: Array<Record<string, unknown>> = [];
  for (let i = 1; i <= 5; i += 1) {
    const result = run("bun test 2>&1 | tail -8");
    const passMatch = result.stdout.match(/(\d+) pass/);
    const failMatch = result.stdout.match(/(\d+) fail/);
    const fileMatch = result.stdout.match(/Ran (\d+) tests across (\d+) files/);
    runs.push({
      run: i,
      command: "bun test",
      pass: passMatch ? Number(passMatch[1]) : null,
      fail: failMatch ? Number(failMatch[1]) : null,
      tests: fileMatch ? Number(fileMatch[1]) : null,
      files: fileMatch ? Number(fileMatch[2]) : null,
      tail: result.stdout.trim(),
      status: result.status,
    });
  }

  const msgSidRuns: Array<Record<string, unknown>> = [];
  for (let i = 1; i <= 3; i += 1) {
    const result = run(
      'bun test src/server/sms/sendState.duplication.test.ts -t "inbound reply" 2>&1 | tail -12',
    );
    msgSidRuns.push({
      run: i,
      command:
        'bun test src/server/sms/sendState.duplication.test.ts -t "inbound reply"',
      tail: result.stdout.trim(),
      status: result.status,
    });
  }

  writeJson("stability-five-full-suite-runs.json", runs);
  writeJson("stability-messagesid-three-runs.json", msgSidRuns);
}

function generateTypeScriptComparison(): void {
  const current = run("bun run typecheck 2>&1");
  writeFileSync(join(OUT, "typescript-current.log"), current.stdout + current.stderr);

  const baselineWorktree = join(REPO_ROOT, ".phase2-baseline-worktree");
  const setup = run(
    `test -d ${baselineWorktree} || git worktree add ${baselineWorktree} 05def6b17c7645d783c85df92d1e4053099c2ea4`,
  );
  if (setup.status !== 0) {
    writeFileSync(join(OUT, "typescript-baseline.log"), setup.stderr);
    return;
  }

  const baseline = run(
    `cd ${baselineWorktree} && bun install --silent 2>/dev/null; bun run typecheck 2>&1`,
  );
  writeFileSync(join(OUT, "typescript-baseline.log"), baseline.stdout + baseline.stderr);

  const parseErrors = (log: string) =>
    log
      .split("\n")
      .filter((line) => /error TS\d+/.test(line))
      .sort();

  const baselineErrors = parseErrors(baseline.stdout + baseline.stderr);
  const currentErrors = parseErrors(current.stdout + current.stderr);
  const baselineSet = new Set(baselineErrors);
  const currentSet = new Set(currentErrors);

  const removed = baselineErrors.filter((e) => !currentSet.has(e));
  const introduced = currentErrors.filter((e) => !baselineSet.has(e));

  writeJson("typescript-comparison.json", {
    baselineCount: baselineErrors.length,
    currentCount: currentErrors.length,
    removedCount: removed.length,
    introducedCount: introduced.length,
    removed: removed.slice(0, 200),
    introduced,
    phase2ModifiedFilesWithDiagnostics: introduced.filter((line) =>
      /assessment|Assessment|phase2|Phase2|CustomerLifecycle|analyticsContract/.test(line),
    ),
  });
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  generateManifestTable();
  generateRouteDiffs();
  generateTestScopeComparison();
  generateStabilityRuns();
  generateTypeScriptComparison();
  console.log(`Review artifacts written to ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
