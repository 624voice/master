/**
 * Mechanical audit for the owner-facing markdown handoff (not JSON).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MD = join(import.meta.dir, "../../review-artifacts/phase2/owner-keyboard-walkthrough-v5.md");
const md = readFileSync(MD, "utf8");
const sha256 = createHash("sha256").update(md).digest("hex");

const banned = [
  /Tab×\d+/i,
  /Tab×/i,
  /Shift\+Tab×\d+/i,
  /Shift\+Tab×/i,
  /Tab through/i,
  /Press Tab to\b/i,
  /\.\.\./,
  /Same pattern/i,
  /Same reachability pattern/i,
  /Forward answers/i,
  /wide enough/i,
  /close DevTools for checks/i,
  /close DevTools after/i,
];

const failures: string[] = [];
for (const re of banned) {
  if (re.test(md)) failures.push(`Document: banned pattern ${re}`);
}

const checkBlocks = md.split(/^### Check (\d+) —/m).slice(1);
const parsedChecks: number[] = [];
for (let i = 0; i < checkBlocks.length; i += 2) {
  const id = Number(checkBlocks[i]);
  const body = checkBlocks[i + 1] ?? "";
  parsedChecks.push(id);

  for (const field of ["Viewport:", "Starting focused element:", "PASS:", "FAIL:", "Final focused element:"]) {
    if (!body.includes(field)) failures.push(`Check ${id}: missing field ${field}`);
  }
  if (!body.includes("Literal bounded key sequence:")) {
    failures.push(`Check ${id}: missing Literal bounded key sequence`);
  }
  if (!body.includes("Expected rendered state:")) {
    failures.push(`Check ${id}: missing Expected rendered state`);
  }
  if (!body.includes("State deliberately left for next check:")) {
    failures.push(`Check ${id}: missing State deliberately left for next check`);
  }
  for (const re of banned) {
    if (re.test(body)) failures.push(`Check ${id}: banned pattern ${re}`);
  }
}

const totalMatch = md.match(/\*\*Total checks: (\d+)\*\*/);
const statedTotal = totalMatch ? Number(totalMatch[1]) : -1;
if (statedTotal !== parsedChecks.length) {
  failures.push(`totalChecks ${statedTotal} != parsed ${parsedChecks.length}`);
}

for (let i = 1; i <= parsedChecks.length; i += 1) {
  if (parsedChecks[i - 1] !== i) failures.push(`Check numbering gap at index ${i}`);
}

const result = {
  ok: failures.length === 0,
  auditedFile: MD,
  sha256,
  statedTotal,
  parsedCheckCount: parsedChecks.length,
  failures,
};

console.log(JSON.stringify(result, null, 2));
process.exit(failures.length ? 1 : 0);
