import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../../..");

function collectTsFiles(dir: string, acc: string[] = []): string[] {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectTsFiles(full, acc);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("S2LSource / flow-identity boundary", () => {
  test("multi_touch and unknown are never written into LeadIndexEntry.source, AgentSession.flow, or S2LSource", () => {
    const files = collectTsFiles(join(ROOT, "src"));
    const violations: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/source:\s*["']multi_touch["']/.test(text) || /source:\s*["']unknown["']/.test(text)) {
        violations.push(`${file}: writes multi_touch/unknown into a source: field`);
      }
      if (/flow:\s*["']multi_touch["']/.test(text) || /flow:\s*["']unknown["']/.test(text)) {
        violations.push(`${file}: writes multi_touch/unknown into a flow: field`);
      }
      if (/export type S2LSource =/.test(text) && /multi_touch|unknown/.test(text.split("export type S2LSource")[1]?.split("\n")[0] ?? "")) {
        violations.push(`${file}: S2LSource union includes multi_touch/unknown`);
      }
    }
    expect(violations).toEqual([]);
  });

  test("S2LSource type stays roi|contact|demo", () => {
    const types = readFileSync(join(ROOT, "src/server/appointmentLifecycle/types.ts"), "utf8");
    const match = types.match(/export type S2LSource = ([^;]+);/);
    expect(match?.[1].replace(/\s/g, "")).toBe('"roi"|"contact"|"demo"');
    expect(types).toContain('export type BookingAttributionSource = "roi" | "contact" | "demo" | "multi_touch" | "unknown"');
  });

  test("enterHumanFollowUp is the only stage handoff assignment in agent code", () => {
    const files = collectTsFiles(join(ROOT, "src/server/speed2Lead/agent"));
    const assignments: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const rel = file.slice(ROOT.length + 1);
      if (rel.endsWith("humanFollowUp.ts")) continue;
      if (/stage:\s*["']handoff["']/.test(text) || /stage\s*=\s*["']handoff["']/.test(text)) {
        assignments.push(rel);
      }
    }
    expect(assignments).toEqual([]);
  });
});
