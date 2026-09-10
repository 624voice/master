#!/usr/bin/env node
/**
 * Measure unzipped Netlify function bundle sizes after `npm run build`.
 * Phase 0 feasibility gate helper.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CANDIDATES = [
  join(ROOT, ".netlify", "functions"),
  join(ROOT, "dist", "server"),
  join(ROOT, ".netlify", "functions-internal"),
];

function dirSizeBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += dirSizeBytes(full);
    } else if (entry.isFile()) {
      total += statSync(full).size;
    }
  }
  return total;
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

let found = false;
for (const base of CANDIDATES) {
  if (!existsSync(base)) continue;
  found = true;
  console.log(`\n=== ${base} ===`);
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const full = join(base, entry.name);
    if (entry.isDirectory()) {
      console.log(`${entry.name}/\t${formatMb(dirSizeBytes(full))}`);
    } else {
      console.log(`${entry.name}\t${formatMb(statSync(full).size)}`);
    }
  }
  console.log(`TOTAL\t${formatMb(dirSizeBytes(base))}`);
}

if (!found) {
  console.error("No Netlify function output found. Run build first.");
  process.exit(1);
}
