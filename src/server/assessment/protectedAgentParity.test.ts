import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "../../../tests/fixtures/phase2-baseline/protected-manifest.json";

const REPO_ROOT = join(import.meta.dir, "../../..");

function sha256File(relativePath: string): string {
  const content = readFileSync(join(REPO_ROOT, relativePath));
  return createHash("sha256").update(content).digest("hex");
}

function snapshotProtectedHashes(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const relativePath of Object.keys(manifest.files)) {
    snapshot[relativePath] = sha256File(relativePath);
  }
  return snapshot;
}

function verifyManifestHashes(
  files: Record<string, string>,
): { pass: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  for (const [relativePath, expectedHash] of Object.entries(files)) {
    const actualHash = sha256File(relativePath);
    if (actualHash !== expectedHash) {
      mismatches.push(`${relativePath}: expected ${expectedHash}, got ${actualHash}`);
    }
  }
  return { pass: mismatches.length === 0, mismatches };
}

describe("S-PARITY protected agent regression", () => {
  test("S-PARITY-01: Contact Us startConversation contract unchanged", () => {
    const source = readFileSync(
      join(REPO_ROOT, "src/server/speed2Lead/agent/contactFlow/startConversation.ts"),
      "utf8",
    );
    expect(source).toContain("export async function startContactAgentConversation");
    expect(source).toContain("export type StartContactAgentInput");
    expect(source).toContain('source: "contact"');
    expect(source).not.toContain("assessment:");
  });

  test("S-PARITY-02: ROI Download startAgentConversation contract unchanged", () => {
    const source = readFileSync(
      join(REPO_ROOT, "src/server/speed2Lead/agent/startConversation.ts"),
      "utf8",
    );
    expect(source).toContain("export type StartAgentInput");
    expect(source).toContain("annualOpportunity: string");
    expect(source).toContain("reportUrl: string");
    expect(source).toContain('source: "roi"');
  });

  test("S-PARITY-03: Demo startConversation contract unchanged", () => {
    const source = readFileSync(
      join(REPO_ROOT, "src/server/speed2Lead/agent/demoFlow/startConversation.ts"),
      "utf8",
    );
    expect(source).toContain("export async function startDemoAgentConversation");
    expect(source).toContain("export type StartDemoAgentInput");
    expect(source).toContain('source: "demo"');
  });

  test("S-PARITY-04: webhook and dispatch entrypoints unchanged", () => {
    const demoLead = readFileSync(
      join(REPO_ROOT, "src/server/submitDemoLead.ts"),
      "utf8",
    );
    expect(demoLead).toContain('source: "voice_demo"');
    expect(demoLead).not.toContain("assessment:");

    const inbound = readFileSync(
      join(REPO_ROOT, "src/server/speed2Lead/agent/handleInbound.ts"),
      "utf8",
    );
    expect(inbound).toContain("handleInbound");
    expect(inbound).not.toContain("submitAssessmentLead");
  });

  test("S-PARITY-05: frozen-file-diff matches immutable Git-object baseline manifest", () => {
    const before = snapshotProtectedHashes();
    const result = verifyManifestHashes(manifest.files);
    const after = snapshotProtectedHashes();

    expect(result.pass).toBe(true);
    expect(result.mismatches).toEqual([]);
    expect(after).toEqual(before);
  });

  test("S-PARITY-05 negative control: deliberately incorrect in-memory hash fails without mutating files", () => {
    const before = snapshotProtectedHashes();
    const firstPath = Object.keys(manifest.files)[0]!;
    const tamperedManifest = {
      ...manifest,
      files: {
        ...manifest.files,
        [firstPath]: "0".repeat(64),
      },
    };

    const negative = verifyManifestHashes(tamperedManifest.files);
    expect(negative.pass).toBe(false);
    expect(negative.mismatches.length).toBeGreaterThan(0);

    const restored = verifyManifestHashes(manifest.files);
    expect(restored.pass).toBe(true);

    const after = snapshotProtectedHashes();
    expect(after).toEqual(before);
  });
});
