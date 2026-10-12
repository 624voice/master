/**
 * Preserves raw git diff --name-status for SHA reconciliation ranges.
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const OUT = join(ROOT, "review-artifacts/phase2");

function meta(sha: string) {
  const lines = execSync(`git show -s --format=%H%n%an%n%ae%n%ci%n%s ${sha}`, {
    cwd: ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  return { sha: lines[0], author: lines[1], email: lines[2], date: lines[3], subject: lines.slice(4).join("\n") };
}

function diffRange(from: string, to: string) {
  const raw = execSync(`git diff --name-status ${from}..${to}`, { cwd: ROOT, encoding: "utf8" }).trim();
  const files = raw
    ? raw.split("\n").map((line) => {
        const [status, ...rest] = line.split("\t");
        return { status, path: rest.join("\t") };
      })
    : [];
  return { command: `git diff --name-status ${from}..${to}`, raw, files };
}

function classify(path: string): string {
  if (path.startsWith("docs/")) return "report";
  if (path.startsWith("review-artifacts/")) return "review-artifact";
  if (path.startsWith("scripts/phase2/")) return "qa-script";
  if (path.startsWith("scripts/")) return "script";
  if (path.includes(".test.")) return "test-code";
  if (path.startsWith("src/")) return "production-code";
  if (path.startsWith("tsconfig")) return "configuration";
  if (path === "package.json" || path.includes("lock")) return "dependency-lockfile";
  if (path.includes("routeTree")) return "generated-route";
  if (path.startsWith("public/")) return "public-asset";
  return "other";
}

const PRIOR_VERIFICATION = "15a4a9ccfe90e80d32cfd3f83c75e3df09f4fb19";
const TS_RECON = "9d1412156746ae9e2dca635170f356e2d2fee825";
const FINAL_EXECUTABLE = execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();

const range1 = diffRange(PRIOR_VERIFICATION, TS_RECON);
const range2 = diffRange(TS_RECON, FINAL_EXECUTABLE);

const result = {
  priorVerificationSha: PRIOR_VERIFICATION,
  priorVerificationMeta: meta(PRIOR_VERIFICATION),
  typescriptReconciliationSha: TS_RECON,
  typescriptReconciliationMeta: meta(TS_RECON),
  finalExecutableSha: FINAL_EXECUTABLE,
  finalExecutableMeta: meta(FINAL_EXECUTABLE),
  range15a4a9cTo9d14121: {
    ...range1,
    fileClassification: range1.files.map((f) => ({ ...f, category: classify(f.path) })),
  },
  range9d14121ToFinalExecutable: {
    ...range2,
    fileClassification: range2.files.map((f) => ({ ...f, category: classify(f.path) })),
  },
  protectedManifestZeroDiff: JSON.parse(
    readFileSync(join(OUT, "protected-manifest-table.json"), "utf8"),
  ).every((r: { match: boolean }) => r.match),
};

writeFileSync(join(OUT, "git-sha-reconciliation.json"), JSON.stringify(result, null, 2));
writeFileSync(join(OUT, "git-diff-15a4a9c-to-9d14121.txt"), range1.raw);
writeFileSync(join(OUT, "git-diff-9d14121-to-final-executable.txt"), range2.raw);
console.log(JSON.stringify({ finalExecutableSha: FINAL_EXECUTABLE, range2Files: range2.files.length }, null, 2));
