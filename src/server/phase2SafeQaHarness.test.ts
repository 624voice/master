import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
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
  });
});
