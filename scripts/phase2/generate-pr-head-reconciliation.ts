/**
 * Proves PR HEAD commit is evidence-only relative to verification SHA.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const OUT = join(ROOT, "review-artifacts/phase2");
const VERIFICATION_SHA =
  process.env.PHASE2_VERIFICATION_SHA?.trim() ||
  "15a4a9ccfe90e80d32cfd3f83c75e3df09f4fb19";
const PR_HEAD_SHA =
  process.env.PHASE2_PR_HEAD_SHA?.trim() ||
  execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();

function meta(sha: string) {
  const format = execSync(`git show -s --format=%H%n%an%n%ae%n%ci%n%s ${sha}`, {
    cwd: ROOT,
    encoding: "utf8",
  }).trim().split("\n");
  return {
    sha: format[0],
    author: format[1],
    email: format[2],
    date: format[3],
    subject: format.slice(4).join("\n"),
  };
}

const diff = execSync(`git diff --name-status ${VERIFICATION_SHA}..${PR_HEAD_SHA}`, {
  cwd: ROOT,
  encoding: "utf8",
}).trim();

const changedFiles = diff
  ? diff.split("\n").map((line) => {
      const [status, ...rest] = line.split("\t");
      return { status, path: rest.join("\t") };
    })
  : [];

const allowedPrefixes = ["docs/PHASE2_PRIVATE_IMPLEMENTATION_REPORT.md", "review-artifacts/phase2/"];
const forbiddenPrefixes = [
  "src/",
  "tests/",
  "scripts/",
  "tsconfig",
  "package.json",
  "package-lock.json",
  "bun.lock",
  "vite.config",
  "public/",
  "dist/",
];

const evidenceOnly =
  changedFiles.length > 0 &&
  changedFiles.every(
    (f) =>
      f.path === "docs/PHASE2_PRIVATE_IMPLEMENTATION_REPORT.md" ||
      f.path.startsWith("review-artifacts/phase2/"),
  ) &&
  !changedFiles.some((f) =>
    forbiddenPrefixes.some((p) => f.path.startsWith(p) || f.path === p.replace(/\/$/, "")),
  );

const manifest = JSON.parse(
  readFileSync(join(OUT, "protected-manifest-table.json"), "utf8"),
) as Array<{ match: boolean }>;

const result = {
  verificationSha: VERIFICATION_SHA,
  verificationMeta: meta(VERIFICATION_SHA),
  prHeadSha: PR_HEAD_SHA,
  prHeadMeta: meta(PR_HEAD_SHA),
  diffCommand: `git diff --name-status ${VERIFICATION_SHA}..${PR_HEAD_SHA}`,
  changedFiles,
  evidenceOnly,
  executablePathsChanged: changedFiles.filter((f) =>
    forbiddenPrefixes.some((p) => f.path.startsWith(p)),
  ),
  protectedManifestZeroDiffAtPrHead: manifest.every((r) => r.match),
  conclusion: evidenceOnly
    ? "PR HEAD difference is strictly reports and sanitized review artifacts; verification results at 15a4a9c remain valid."
    : "PR HEAD contains executable changes; rerun applicable gates at PR HEAD.",
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "pr-head-reconciliation.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
