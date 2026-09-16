/**
 * Generate checkout diff classification, frozen install proof, and preview SHA verification.
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const OUT = join(ROOT, "review-artifacts/phase2");
const APP_SHA = "d54286ec9f875d7627c3a027bf7407664389f4e6";
const PREVIEW_SHA = execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function classifyPath(path: string): string {
  if (path.startsWith("docs/") && path.includes("PHASE2")) return "final report";
  if (path.startsWith("review-artifacts/phase2/")) return "sanitized review artifact";
  if (path.startsWith("scripts/phase2/")) return "QA script";
  if (path.startsWith("src/") && path.includes(".test.")) return "test";
  if (path.startsWith("src/")) return "production source";
  if (path === "package.json" || path === "bun.lock") return "dependency manifest/lockfile";
  if (path.startsWith("tsconfig") || path.endsWith(".config.ts")) return "configuration";
  if (path.startsWith("public/")) return "public asset";
  return "other";
}

const diffCommand = `git diff --name-status ${APP_SHA}..${PREVIEW_SHA}`;
const diffOutput = execSync(diffCommand, { cwd: ROOT, encoding: "utf8" }).trim();
const diffLines = diffOutput ? diffOutput.split("\n") : [];

const classified = diffLines.map((line) => {
  const [status, ...rest] = line.split("\t");
  const path = rest.join("\t");
  return {
    status,
    path,
    category: classifyPath(path),
    altersKeyboardTestedRoutes: path.startsWith("src/routes/") || path.startsWith("src/components/"),
  };
});

const lockBefore = sha256File(join(ROOT, "bun.lock"));
execSync("bun install --frozen-lockfile", { cwd: ROOT, stdio: "pipe" });
const lockAfter = sha256File(join(ROOT, "bun.lock"));
const porcelain = execSync("git status --porcelain", { cwd: ROOT, encoding: "utf8" }).trim();

const previewEnvSource = readFileSync(join(ROOT, "scripts/phase2/safePreviewEnvironment.ts"), "utf8");
const previewScriptSource = readFileSync(
  join(ROOT, "scripts/phase2/start-safe-assessment-preview.ts"),
  "utf8",
);

const testSource = readFileSync(
  join(ROOT, "scripts/phase2/start-safe-assessment-preview.test.ts"),
  "utf8",
);
const testNames = [...testSource.matchAll(/test\("([^"]+)"/g)].map((m) => m[1]);

const bootstrapMatch = previewEnvSource.match(
  /const BOOTSTRAP_KEYS = \[([\s\S]*?)\] as const;/,
);
const bootstrapKeys = bootstrapMatch
  ? [...bootstrapMatch[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1])
  : [];

const result = {
  applicationBehaviorSha: APP_SHA,
  finalPreviewSha: PREVIEW_SHA,
  diffCommandExecuted: diffCommand,
  diffOutputRaw: diffOutput,
  classifiedFiles: classified,
  srcTreeDiffEmpty: execSync(`git diff --name-only ${APP_SHA}..${PREVIEW_SHA} -- src/`, {
    cwd: ROOT,
    encoding: "utf8",
  }).trim() === "",
  keyboardRouteBehaviorUnchanged: classified.every((f) => !f.altersKeyboardTestedRoutes),
  frozenInstallProof: {
    command: "bun install --frozen-lockfile",
    bunLockSha256Before: lockBefore,
    bunLockSha256After: lockAfter,
    lockfileUnchanged: lockBefore === lockAfter,
    gitStatusPorcelainAfter: porcelain,
    workingTreeClean: porcelain === "",
  },
  enforcedPreviewFiles: {
    safePreviewEnvironment: {
      path: "scripts/phase2/safePreviewEnvironment.ts",
      sha256: sha256File(join(ROOT, "scripts/phase2/safePreviewEnvironment.ts")),
      usesAllowlist: previewEnvSource.includes("BOOTSTRAP_KEYS"),
      bootstrapKeys,
      containsBuildIsolatedSafePreviewEnvironment: previewEnvSource.includes(
        "buildIsolatedSafePreviewEnvironment",
      ),
      containsNetworkGuardReference: previewEnvSource.includes("safePreviewNetworkGuard"),
    },
    startSafeAssessmentPreview: {
      path: "scripts/phase2/start-safe-assessment-preview.ts",
      sha256: sha256File(join(ROOT, "scripts/phase2/start-safe-assessment-preview.ts")),
      containsAssertBeforeSpawn: previewScriptSource.includes("assertSafePreviewEnvironment"),
      lacksManualUnsetComment: !previewScriptSource.includes("Unset production credentials"),
    },
  },
  testInventory: {
    file: "scripts/phase2/start-safe-assessment-preview.test.ts",
    testNames,
    hasNegativeInjectionTest: testNames.some((n) => n.includes("X-SAFE-PREVIEW-02")),
    hasFailurePathTest: testNames.some((n) => n.includes("X-SAFE-PREVIEW-03")),
    hasNetworkBlockTest: testNames.some((n) => n.includes("X-SAFE-PREVIEW-09")),
  },
};

writeFileSync(join(OUT, "preview-checkout-verification.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ previewSha: PREVIEW_SHA, filesChanged: classified.length }, null, 2));
