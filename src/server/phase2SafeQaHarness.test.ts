import { describe, expect, test } from "bun:test";
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");

describe("Phase 2 safe QA harness production isolation", () => {
  test("X-SAFE-QA-01: no fixture mode query param or public route in source", () => {
    const safeQaScript = readFileSync(
      join(REPO_ROOT, "scripts/phase2/safe-public-qa.ts"),
      "utf8",
    );
    expect(safeQaScript).toContain('PHASE2_SAFE_QA_HARNESS = "1"');
    expect(safeQaScript).not.toMatch(/searchParams|query\.fixture|fixtureMode/);

    const routes = readFileSync(join(REPO_ROOT, "src/routes/assessment.tsx"), "utf8");
    expect(routes).not.toMatch(/PHASE2_SAFE_QA|fixtureMode|qaMode/i);
  });

  test("X-SAFE-QA-02: harness requires explicit env; missing credential alone does not enable it", () => {
    expect(process.env.PHASE2_SAFE_QA_HARNESS).toBeUndefined();
  });

  test("X-SAFE-QA-03: safe QA script strips production provider credentials in child env", () => {
    const source = readFileSync(
      join(REPO_ROOT, "scripts/phase2/safe-public-qa.ts"),
      "utf8",
    );
    for (const key of [
      "TWILIO_ACCOUNT_SID",
      "UPSTASH_REDIS_REST_URL",
      "ASSESSMENT_SECURITY_HMAC_SECRET",
      "OPENAI_API_KEY",
    ]) {
      expect(source).toContain(key);
    }
    expect(source).toMatch(/delete env\[key\]/);
  });

  test("X-SAFE-QA-04A: missing credentials and unset harness do not enable fixture paths", () => {
    const childEnv: Record<string, string | undefined> = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
    };
    const probe = spawnSync(
      "bun",
      [
        "-e",
        `const fs=require('node:fs'); const src=fs.readFileSync('src/routes/assessment.tsx','utf8'); if(/fixtureMode|PHASE2_SAFE_QA_HARNESS/.test(src) && process.env.PHASE2_SAFE_QA_HARNESS){process.exit(2)}; if(process.env.PHASE2_SAFE_QA_HARNESS){process.exit(3)}; process.exit(0);`,
      ],
      { cwd: REPO_ROOT, env: childEnv, encoding: "utf8" },
    );
    expect(probe.status).toBe(0);
    expect(childEnv.PHASE2_SAFE_QA_HARNESS).toBeUndefined();
    expect(childEnv.TWILIO_ACCOUNT_SID).toBeUndefined();
  });

  test(
    "X-SAFE-QA-04B: production bundle ignores PHASE2_SAFE_QA_HARNESS",
    () => {
    execSync("bun run build", {
      cwd: REPO_ROOT,
      stdio: "pipe",
      timeout: 120_000,
    });
    const clientBundleDir = join(REPO_ROOT, "dist/client/assets");
    const bundleFiles = readdirSync(clientBundleDir).filter((f) =>
      f.endsWith(".js"),
    );
    const combined = bundleFiles
      .map((file) => readFileSync(join(clientBundleDir, file), "utf8"))
      .join("\n");
    expect(combined).not.toMatch(/PHASE2_SAFE_QA_HARNESS/);
    expect(combined).not.toMatch(/fixtureMode|qaMode|fakeLeadSink/i);

    const serverEntry = readFileSync(
      join(REPO_ROOT, "dist/server/server.js"),
      "utf8",
    );
    expect(serverEntry).not.toMatch(/PHASE2_SAFE_QA_HARNESS/);
    expect(serverEntry).not.toMatch(/fixtureMode|qaMode/i);
    },
    120_000,
  );
});
