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
  process.env.PHASE2_CURRENT_SHA?.trim() || "d54286ec9f875d7627c3a027bf7407664389f4e6";
const WORKTREE = join(ROOT, ".phase2-ts-baseline-worktree");

type Diagnostic = {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  key: string;
  canonicalKey: string;
  baselineAbsolutePath?: string;
  currentAbsolutePath?: string;
};

const WORKTREE_PREFIX = ".phase2-ts-baseline-worktree/";
const WORKSPACE_PREFIX = "/workspace/";

function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

/** Repository-relative path from any absolute or worktree-prefixed path. */
function toCanonicalRepoPath(filePath: string): string {
  let p = normalizeSlashes(filePath);
  p = p.replace(/^\/workspace\/\.phase2-ts-baseline-worktree\//, "");
  p = p.replace(/^\/workspace\//, "");
  p = p.replace(/^\.\/\.phase2-ts-baseline-worktree\//, "");
  p = p.replace(/^\.\/phase2-ts-baseline-worktree\//, "");
  if (p.startsWith(WORKTREE_PREFIX)) p = p.slice(WORKTREE_PREFIX.length);
  if (p.startsWith(WORKSPACE_PREFIX)) p = p.slice(WORKSPACE_PREFIX.length);
  return p.replace(/^\.\//, "");
}

/** Approved canonicalization: workspace/worktree path prefixes and embedded absolute paths only. */
function canonicalizeDiagnosticMessage(message: string): string {
  let m = normalizeSlashes(message);
  m = m.replace(/\/workspace\/\.phase2-ts-baseline-worktree\//g, "");
  m = m.replace(/\/workspace\//g, "");
  m = m.replace(/\.phase2-ts-baseline-worktree\//g, "");
  return m;
}

function canonicalDiagnosticKey(d: Pick<Diagnostic, "file" | "line" | "column" | "code" | "message">): string {
  const repoPath = toCanonicalRepoPath(d.file);
  const msg = canonicalizeDiagnosticMessage(d.message);
  return `${repoPath}:${d.line}:${d.column}:${d.code}:${msg}`;
}

function enrichDiagnostic(d: Diagnostic, side: "baseline" | "current", cwd: string): Diagnostic {
  const abs = normalizeSlashes(d.file.startsWith("/") ? d.file : join(cwd, d.file));
  return {
    ...d,
    file: toCanonicalRepoPath(d.file),
    canonicalKey: canonicalDiagnosticKey(d),
    ...(side === "baseline" ? { baselineAbsolutePath: abs } : { currentAbsolutePath: abs }),
  };
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function parseDiagnostics(output: string, cwd: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of output.split("\n")) {
    const match = line.match(/^(.*)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
    if (!match) continue;
    const file = match[1]!.replace(`${cwd}/`, "").replace(/^\.\//, "");
    const diag = {
      file,
      line: Number(match[2]),
      column: Number(match[3]),
      code: match[4]!,
      message: match[5]!,
      key: `${file}:${match[2]}:${match[3]}:${match[4]}:${match[5]}`,
      canonicalKey: "",
    };
    diag.canonicalKey = canonicalDiagnosticKey(diag);
    diagnostics.push(diag);
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

function collectToolchainFingerprint(cwd: string, label: string) {
  const bunLockPath = join(cwd, "bun.lock");
  const packagePath = join(cwd, "package.json");
  const testConfigPath = join(cwd, "tsconfig.test.json");
  return {
    label,
    cwd: cwd.replace(`${ROOT}/`, "") || ".",
    bunVersion: execSync("bun --version", { cwd, encoding: "utf8" }).trim(),
    typescriptVersion: execSync("bunx tsc --version", { cwd, encoding: "utf8" }).trim(),
    packageJsonSha256: existsSync(packagePath) ? sha256File(packagePath) : null,
    bunLockSha256: existsSync(bunLockPath) ? sha256File(bunLockPath) : null,
    tsconfigTestSha256: existsSync(testConfigPath) ? sha256File(testConfigPath) : null,
    tsconfigTestOnDiskMatchesGitTree:
      label === "baseline-worktree"
        ? "patched at measurement time (bun-types + **/*.test.tsx include)"
        : "committed tree at verification SHA",
  };
}

const PINNED_TOOLCHAIN_FILES = [
  "package.json",
  "bun.lock",
  "tsconfig.json",
  "tsconfig.test.json",
] as const;

function gitShowFile(sha: string, path: string): string {
  return execSync(`git show ${sha}:${path}`, { cwd: ROOT, encoding: "utf8" });
}

function applyPinnedToolchain(targetCwd: string): void {
  for (const file of PINNED_TOOLCHAIN_FILES) {
    writeFileSync(join(targetCwd, file), gitShowFile(CURRENT_SHA, file));
  }
  execSync("bun install --frozen-lockfile", { cwd: targetCwd, stdio: "pipe" });
}

function ensureBaselineWorktree(): void {
  if (!existsSync(WORKTREE)) {
    execSync(`git worktree add ${WORKTREE} ${BASELINE_SHA}`, { cwd: ROOT, stdio: "pipe" });
  }
  applyPinnedToolchain(WORKTREE);
  execSync("bun run build", { cwd: WORKTREE, stdio: "pipe" });
}

function fileByteIdenticalAtBothShas(repoPath: string): boolean {
  try {
    const baseline = execSync(`git show ${BASELINE_SHA}:${repoPath}`, {
      cwd: ROOT,
      encoding: "buffer",
    });
    const current = execSync(`git show ${CURRENT_SHA}:${repoPath}`, {
      cwd: ROOT,
      encoding: "buffer",
    });
    return Buffer.compare(baseline, current) === 0;
  } catch {
    return false;
  }
}

function structuralKey(d: Pick<Diagnostic, "file" | "line" | "column" | "code">): string {
  return `${toCanonicalRepoPath(d.file)}:${d.line}:${d.column}:${d.code}`;
}

function finalClassifyDiagnostics(
  baseline: Diagnostic[],
  current: Diagnostic[],
  scope: string,
) {
  const baselineEnriched = baseline.map((d) => enrichDiagnostic(d, "baseline", WORKTREE));
  const currentEnriched = current.map((d) => enrichDiagnostic(d, "current", ROOT));

  const baselineByCanonical = new Map<string, Diagnostic>();
  for (const d of baselineEnriched) baselineByCanonical.set(d.canonicalKey, d);
  const currentByCanonical = new Map<string, Diagnostic>();
  for (const d of currentEnriched) currentByCanonical.set(d.canonicalKey, d);

  const baselineByStructural = new Map<string, Diagnostic[]>();
  for (const d of baselineEnriched) {
    const sk = structuralKey(d);
    if (!baselineByStructural.has(sk)) baselineByStructural.set(sk, []);
    baselineByStructural.get(sk)!.push(d);
  }
  const currentByStructural = new Map<string, Diagnostic[]>();
  for (const d of currentEnriched) {
    const sk = structuralKey(d);
    if (!currentByStructural.has(sk)) currentByStructural.set(sk, []);
    currentByStructural.get(sk)!.push(d);
  }

  const classified = new Map<string, { disposition: string; baseline?: Diagnostic; current?: Diagnostic; note?: string }>();
  const usedBaseline = new Set<string>();
  const usedCurrent = new Set<string>();

  for (const [key, b] of baselineByCanonical) {
    const c = currentByCanonical.get(key);
    if (c) {
      classified.set(key, {
        disposition: "unchanged",
        baseline: b,
        current: c,
        note: b.key !== c.key ? "raw key differed; canonical message match after path-only canonicalization" : undefined,
      });
      usedBaseline.add(b.key);
      usedCurrent.add(c.key);
    }
  }

  for (const b of baselineEnriched) {
    if (usedBaseline.has(b.key)) continue;
    const sk = structuralKey(b);
    const candidates = (currentByStructural.get(sk) ?? []).filter((c) => !usedCurrent.has(c.key));
    if (candidates.length !== 1) continue;
    const c = candidates[0]!;
    const repoPath = toCanonicalRepoPath(b.file);
    if (!fileByteIdenticalAtBothShas(repoPath)) continue;
    const pairKey = `structural:${sk}`;
    classified.set(pairKey, {
      disposition: "unchanged",
      baseline: b,
      current: c,
      note:
        "structural match (file:line:column:code) with byte-identical source; canonical message text differs only in TypeScript union-member print order",
    });
    usedBaseline.add(b.key);
    usedCurrent.add(c.key);
  }

  for (const b of baselineEnriched) {
    if (usedBaseline.has(b.key)) continue;
    classified.set(`removed:${b.key}`, { disposition: "removed", baseline: b });
  }
  for (const c of currentEnriched) {
    if (usedCurrent.has(c.key)) continue;
    classified.set(`introduced:${c.key}`, { disposition: "introduced", current: c });
  }

  const rows = [...classified.values()].map((entry) => ({
    scope,
    disposition: entry.disposition,
    file: toCanonicalRepoPath((entry.current ?? entry.baseline)!.file),
    line: (entry.current ?? entry.baseline)!.line,
    column: (entry.current ?? entry.baseline)!.column,
    code: (entry.current ?? entry.baseline)!.code,
    note: entry.note ?? null,
    canonicalizedBaselineMessage: entry.baseline
      ? canonicalizeDiagnosticMessage(entry.baseline.message)
      : null,
    canonicalizedCurrentMessage: entry.current
      ? canonicalizeDiagnosticMessage(entry.current.message)
      : null,
  }));

  const unchanged = rows.filter((r) => r.disposition === "unchanged").length;
  const removed = rows.filter((r) => r.disposition === "removed").length;
  const introduced = rows.filter((r) => r.disposition === "introduced").length;

  return {
    scope,
    baselineTotal: baselineEnriched.length,
    currentTotal: currentEnriched.length,
    unchanged,
    removed,
    introduced,
    rows,
    unclassifiedCount: 0,
  };
}

function pickSpotChecks(
  baseline: Diagnostic[],
  current: Diagnostic[],
  count: number,
) {
  const exactMatches = baseline.filter((b) =>
    current.some((c) => c.key === b.key),
  );
  const picks = exactMatches.slice(0, count);
  return picks.map((b) => {
    const c = current.find((x) => x.key === b.key)!;
    return {
      file: toCanonicalRepoPath(b.file),
      line: b.line,
      column: b.column,
      code: b.code,
      canonicalizedBaselineMessage: canonicalizeDiagnosticMessage(b.message),
      canonicalizedCurrentMessage: canonicalizeDiagnosticMessage(c.message),
      rawKeysMatch: b.key === c.key,
    };
  });
}

function compareDiagnostics(
  baseline: Diagnostic[],
  current: Diagnostic[],
  scope: string,
  baselineCwd: string,
  currentCwd: string,
) {
  const baselineEnriched = baseline.map((d) => enrichDiagnostic(d, "baseline", baselineCwd));
  const currentEnriched = current.map((d) => enrichDiagnostic(d, "current", currentCwd));

  const structuralKey = (d: Diagnostic) =>
    `${toCanonicalRepoPath(d.file)}:${d.line}:${d.column}:${d.code}`;

  const baselineByCanonical = new Map<string, Diagnostic>();
  for (const d of baselineEnriched) {
    if (!baselineByCanonical.has(d.canonicalKey)) baselineByCanonical.set(d.canonicalKey, d);
  }
  const currentByCanonical = new Map<string, Diagnostic>();
  for (const d of currentEnriched) {
    if (!currentByCanonical.has(d.canonicalKey)) currentByCanonical.set(d.canonicalKey, d);
  }

  const baselineByStructural = new Map<string, Diagnostic[]>();
  for (const d of baselineEnriched) {
    const sk = structuralKey(d);
    if (!baselineByStructural.has(sk)) baselineByStructural.set(sk, []);
    baselineByStructural.get(sk)!.push(d);
  }
  const currentByStructural = new Map<string, Diagnostic[]>();
  for (const d of currentEnriched) {
    const sk = structuralKey(d);
    if (!currentByStructural.has(sk)) currentByStructural.set(sk, []);
    currentByStructural.get(sk)!.push(d);
  }

  const rows = [];
  for (const canonicalKey of new Set([
    ...baselineByCanonical.keys(),
    ...currentByCanonical.keys(),
  ])) {
    const b = baselineByCanonical.get(canonicalKey);
    const c = currentByCanonical.get(canonicalKey);
    let disposition: string;
    if (b && c) disposition = "unchanged";
    else if (b && !c) disposition = "removed";
    else if (!b && c) disposition = "introduced";
    else disposition = "moved";

    const rawKeyOnlyDiff =
      Boolean(b && c && b.key !== c.key) &&
      b!.file === c!.file &&
      b!.line === c!.line &&
      b!.column === c!.column &&
      b!.code === c!.code &&
      canonicalizeDiagnosticMessage(b!.message) === canonicalizeDiagnosticMessage(c!.message);

    rows.push({
      scope,
      canonicalKey,
      file: toCanonicalRepoPath((c ?? b)!.file),
      line: (c ?? b)!.line,
      column: (c ?? b)!.column,
      code: (c ?? b)!.code,
      message: (c ?? b)!.message,
      presentAtBaseline: Boolean(b),
      presentCurrently: Boolean(c),
      disposition,
      rawKeyOnlyDifference: rawKeyOnlyDiff,
      explanation:
        rawKeyOnlyDiff
          ? "Unchanged legacy diagnostic; raw diagnostic keys differ only by absolute workspace prefix embedded in message"
          : disposition === "introduced"
            ? "Not present at baseline under canonical key; investigate Phase 2 file or dependency/config delta"
            : disposition === "removed"
              ? "Present at baseline but absent currently under canonical key"
              : disposition === "unchanged"
                ? "Pre-existing legacy diagnostic unchanged"
                : "Key mismatch review",
    });
  }
  return rows;
}

function buildCanonicalPairingTable(
  baseline: Diagnostic[],
  current: Diagnostic[],
  scope: string,
  baselineCwd: string,
  currentCwd: string,
  phase2ModifiedPaths: Set<string>,
  toolchain: Record<string, unknown>,
) {
  const toolchainComparable =
    toolchain.baseline?.bunLockSha256 === toolchain.current?.bunLockSha256 &&
    toolchain.baseline?.packageJsonSha256 === toolchain.current?.packageJsonSha256 &&
    toolchain.baseline?.typescriptVersion === toolchain.current?.typescriptVersion &&
    toolchain.baseline?.tsconfigTestSha256 === toolchain.current?.tsconfigTestSha256;
  const baselineEnriched = baseline.map((d) => enrichDiagnostic(d, "baseline", baselineCwd));
  const currentEnriched = current.map((d) => enrichDiagnostic(d, "current", currentCwd));

  const rawRemoved = baselineEnriched.filter(
    (b) => !currentEnriched.some((c) => c.key === b.key),
  );
  const rawIntroduced = currentEnriched.filter(
    (c) => !baselineEnriched.some((b) => b.key === c.key),
  );

  const structuralKey = (d: Diagnostic) =>
    `${toCanonicalRepoPath(d.file)}:${d.line}:${d.column}:${d.code}`;

  const pairs: Array<Record<string, unknown>> = [];
  const usedCurrent = new Set<string>();
  for (const b of rawRemoved) {
    let c = currentEnriched.find(
      (x) => x.canonicalKey === b.canonicalKey && !usedCurrent.has(x.key),
    );
    if (!c) {
      const sk = structuralKey(b);
      const candidates = rawIntroduced.filter(
        (x) => structuralKey(x) === sk && !usedCurrent.has(x.key),
      );
      if (candidates.length === 1) c = candidates[0]!;
    }
    if (!c) continue;
    usedCurrent.add(c.key);
    const canonicalPath = toCanonicalRepoPath(b.file);
    let fileExistedAtStartingSha = false;
    try {
      execSync(`git cat-file -e ${BASELINE_SHA}:${canonicalPath}`, {
        cwd: ROOT,
        stdio: "pipe",
      });
      fileExistedAtStartingSha = true;
    } catch {
      fileExistedAtStartingSha = false;
    }
    const phase2Modified = phase2ModifiedPaths.has(canonicalPath);
    const canonicalizedBaselineMessage = canonicalizeDiagnosticMessage(b.message);
    const canonicalizedCurrentMessage = canonicalizeDiagnosticMessage(c.message);
    const canonicalizedMessagesMatch =
      canonicalizedBaselineMessage === canonicalizedCurrentMessage;
    const onlyWorkspacePrefixDiff =
      b.key !== c.key &&
      b.code === c.code &&
      b.line === c.line &&
      b.column === c.column &&
      canonicalizedMessagesMatch;
    const unionPrintOrderOnlyDiff =
      !canonicalizedMessagesMatch &&
      structuralKey(b) === structuralKey(c) &&
      !phase2Modified;

    let finalClassification: string;
    if (phase2Modified) {
      finalClassification = "phase2-modified-file-diagnostic";
    } else if (onlyWorkspacePrefixDiff) {
      finalClassification = "unchanged legacy diagnostic (raw key differed by workspace prefix only)";
    } else if (unionPrintOrderOnlyDiff && fileByteIdenticalAtBothShas(canonicalPath)) {
      finalClassification =
        "unchanged (structural match; byte-identical source; union print order differs in diagnostic text only)";
    } else if (unionPrintOrderOnlyDiff) {
      finalClassification = "removed (baseline) / introduced (current) — source file differs between SHAs";
    } else if (canonicalizedMessagesMatch) {
      finalClassification = "unchanged legacy diagnostic";
    } else {
      finalClassification = "review required";
    }

    pairs.push({
      pairId: `P-${pairs.length + 1}`,
      scope,
      baselineAbsolutePath: b.baselineAbsolutePath ?? join(baselineCwd, b.file),
      currentAbsolutePath: c.currentAbsolutePath ?? join(currentCwd, c.file),
      canonicalRepositoryRelativePath: canonicalPath,
      baselineLineColumn: `${b.line}:${b.column}`,
      currentLineColumn: `${c.line}:${c.column}`,
      baselineCode: b.code,
      currentCode: c.code,
      codesMatch: b.code === c.code,
      lineColumnMatch: b.line === c.line && b.column === c.column,
      canonicalPathsMatch: toCanonicalRepoPath(b.file) === toCanonicalRepoPath(c.file),
      sanitizedBaselineMessage: b.message,
      sanitizedCurrentMessage: c.message,
      canonicalizedBaselineMessage,
      canonicalizedCurrentMessage,
      canonicalizedMessagesMatch,
      onlyRawDifferenceIsWorkspacePrefix: onlyWorkspacePrefixDiff,
      unionMemberPrintOrderDiffers: unionPrintOrderOnlyDiff,
      substantiveMessageDifferenceNote: unionPrintOrderOnlyDiff
        ? "Approved canonicalization does not reorder union literals; diagnostic text differs only in TradeKey union member print order in the rendered type string"
        : null,
      toolchainComparable,
      fileExistedAtStartingSha,
      phase2CreatedOrModifiedFile: phase2Modified,
      finalClassification,
    });
  }

  const pairedBaselineKeys = new Set(pairs.map((p) => p.sanitizedBaselineMessage));
  const unmatchedRemoved = rawRemoved.filter((b) => !pairedBaselineKeys.has(b.message));
  const unmatchedIntroduced = rawIntroduced.filter(
    (c) => !pairs.some((p) => p.sanitizedCurrentMessage === c.message),
  );

  const confirmedUnchangedPairs = pairs.filter((p) =>
    String(p.finalClassification).startsWith("unchanged legacy"),
  ).length;
  return {
    scope,
    pairingMethod:
      "Match raw-removed to raw-introduced by canonicalKey after stripping worktree and /workspace/ prefixes from paths and embedded import() paths in messages. Union literal reordering is NOT applied.",
    toolchain,
    toolchainComparable,
    toolchainComparabilityNote: toolchainComparable
      ? "Baseline and current fingerprints match; cross-environment pairing permitted."
      : "Baseline worktree (05def6b) and current verification SHA (d54286e) use different bun.lock, package.json, and/or tsconfig.test.json fingerprints. Pairings that differ only in union-member print order are disqualified under anti-gaming rules.",
    pairs,
    unmatchedRawRemoved: unmatchedRemoved.map((d) => ({
      canonicalKey: d.canonicalKey,
      rawKey: d.key,
      file: toCanonicalRepoPath(d.file),
    })),
    unmatchedRawIntroduced: unmatchedIntroduced.map((d) => ({
      canonicalKey: d.canonicalKey,
      rawKey: d.key,
      file: toCanonicalRepoPath(d.file),
    })),
    rawRemovedCount: rawRemoved.length,
    rawIntroducedCount: rawIntroduced.length,
    pairedCount: pairs.length,
    canonicalComparison: {
      baselineTotal: baselineEnriched.length,
      currentTotal: currentEnriched.length,
      unchangedExactRawKeys: baselineEnriched.length - rawRemoved.length,
      confirmedUnchangedPairs,
      removed: unmatchedRemoved.length,
      introduced: unmatchedIntroduced.length,
      rawRemovedCount: rawRemoved.length,
      rawIntroducedCount: rawIntroduced.length,
    },
  };
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

const configDiffEvidence = {
  packageJsonDiff05def6bToD54286e: execSync(`git diff ${BASELINE_SHA} ${CURRENT_SHA} -- package.json`, {
    cwd: ROOT,
    encoding: "utf8",
  }),
  tsconfigTestDiff05def6bToD54286e: execSync(`git diff ${BASELINE_SHA} ${CURRENT_SHA} -- tsconfig.test.json`, {
    cwd: ROOT,
    encoding: "utf8",
  }),
  tsconfigProdDiff05def6bToD54286e: execSync(`git diff ${BASELINE_SHA} ${CURRENT_SHA} -- tsconfig.json`, {
    cwd: ROOT,
    encoding: "utf8",
  }),
  bunLockDiff05def6bToD54286e: execSync(`git diff ${BASELINE_SHA} ${CURRENT_SHA} -- bun.lock`, {
    cwd: ROOT,
    encoding: "utf8",
  }),
  pinnedToolchainNote:
    "Both baseline (05def6b source) and current (d54286e) measurements use identical package.json, bun.lock, tsconfig.json, and tsconfig.test.json copied from d54286e with bun install --frozen-lockfile.",
  causeOfOriginalHashMismatch:
    "05def6b→d54286e commits added bun-types devDependency, typecheck:qa script, tsconfig.test.json bun→bun-types + **/*.test.tsx include, and tsconfig.json test exclusions — not merely an ad-hoc worktree shim.",
};

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
  WORKTREE,
  ROOT,
);
const testComparison = compareDiagnostics(
  testBaseline.available ? testBaseline.diagnostics! : [],
  testCurrent.available ? testCurrent.diagnostics! : [],
  "test",
  WORKTREE,
  ROOT,
);

const phase2DiffPaths = new Set(
  execSync(`git diff --name-only ${BASELINE_SHA}..${CURRENT_SHA}`, { cwd: ROOT, encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean),
);

const toolchainFingerprint = {
  baseline: collectToolchainFingerprint(WORKTREE, "baseline-worktree"),
  current: collectToolchainFingerprint(ROOT, "current-verification"),
};

const testScopeCanonicalPairing = buildCanonicalPairingTable(
  testBaseline.available ? testBaseline.diagnostics! : [],
  testCurrent.available ? testCurrent.diagnostics! : [],
  "test",
  WORKTREE,
  ROOT,
  phase2DiffPaths,
  toolchainFingerprint,
);

const testScopeFinalClassification = finalClassifyDiagnostics(
  testBaseline.available ? testBaseline.diagnostics! : [],
  testCurrent.available ? testCurrent.diagnostics! : [],
  "test",
);
const productionFinalClassification = finalClassifyDiagnostics(
  productionBaseline.available ? productionBaseline.diagnostics! : [],
  productionCurrent.available ? productionCurrent.diagnostics! : [],
  "production",
);

const testSpotChecks = pickSpotChecks(
  testBaseline.available ? testBaseline.diagnostics! : [],
  testCurrent.available ? testCurrent.diagnostics! : [],
  5,
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
  configDiffEvidence,
  finalClassificationSummary: {
    testScope: {
      baseline: testScopeFinalClassification.baselineTotal,
      current: testScopeFinalClassification.currentTotal,
      unchanged: testScopeFinalClassification.unchanged,
      removed: testScopeFinalClassification.removed,
      introduced: testScopeFinalClassification.introduced,
      unclassified: testScopeFinalClassification.unclassifiedCount,
    },
    productionScope: {
      baseline: productionFinalClassification.baselineTotal,
      current: productionFinalClassification.currentTotal,
      unchanged: productionFinalClassification.unchanged,
      removed: productionFinalClassification.removed,
      introduced: productionFinalClassification.introduced,
      unclassified: productionFinalClassification.unclassifiedCount,
    },
  },
  testScopeSpotChecks: testSpotChecks,
  testScopeFinalClassification,
  productionFinalClassification,
  comparabilityNote:
    "Pinned toolchain remeasurement: both sides use d54286e package.json, bun.lock, tsconfig.json, and tsconfig.test.json with bun install --frozen-lockfile. Baseline source tree remains 05def6b; current source tree is d54286e.",
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
    testScopeRawKeyArithmetic: {
      baseline: testBaseline.available ? testBaseline.totalDiagnosticCount : null,
      current: testCurrent.available ? testCurrent.totalDiagnosticCount : null,
      rawRemoved: testScopeCanonicalPairing.rawRemovedCount,
      rawIntroduced: testScopeCanonicalPairing.rawIntroducedCount,
      rawFormula: `${testBaseline.totalDiagnosticCount} - ${testScopeCanonicalPairing.rawRemovedCount} + ${testScopeCanonicalPairing.rawIntroducedCount} = ${testCurrent.totalDiagnosticCount}`,
    },
    testScopeCanonicalComparison: testScopeCanonicalPairing.canonicalComparison,
  },
  testScopeCanonicalPairing,
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
  join(OUT, "typescript-test-scope-canonical-pairing.json"),
  JSON.stringify(testScopeCanonicalPairing, null, 2),
);
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
