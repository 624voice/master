/**
 * Mechanical audit for owner walkthrough procedure JSON.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROC = join(import.meta.dir, "../../review-artifacts/phase2/owner-keyboard-walkthrough-procedure.json");
const data = JSON.parse(readFileSync(PROC, "utf8"));

const banned = [
  /Tab×\d+/i,
  /Tab×/i,
  /Tab through/i,
  /Press Tab to\b/i,
  /\.\s*Tab to\b/i,
  /Same reachability/i,
  /\buntil\b/i,
  /\betc\.?\b/i,
  /remaining questions/i,
  /\boptional\b/i,
  /or equivalent/i,
  /with or without/i,
];

const failures: string[] = [];
for (const check of data.checks as Array<{ id: number; steps: string[]; pass?: string; fail?: string }>) {
  const blob = JSON.stringify(check);
  for (const re of banned) {
    if (re.test(blob)) failures.push(`Check ${check.id}: banned pattern ${re}`);
  }
  if (!check.pass || !check.fail) failures.push(`Check ${check.id}: missing PASS or FAIL`);
}

if ((data.checks as unknown[]).length !== data.totalChecks) {
  failures.push(`totalChecks ${data.totalChecks} != checks.length ${(data.checks as unknown[]).length}`);
}

const ids = (data.checks as Array<{ id: number }>).map((c) => c.id);
for (let i = 1; i <= ids.length; i += 1) {
  if (ids[i - 1] !== i) failures.push(`Check numbering gap at index ${i}`);
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, totalChecks: data.totalChecks }, null, 2));
