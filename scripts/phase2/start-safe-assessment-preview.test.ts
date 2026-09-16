import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOOTSTRAP_KEYS,
  PROHIBITED_EXACT_KEYS,
  assertSafePreviewEnvironment,
  buildIsolatedSafePreviewEnvironment,
  findProhibitedEnvKeys,
} from "./safePreviewEnvironment";
import { assertLoopbackUrl } from "./safePreviewNetworkGuard";

const REPO_ROOT = join(import.meta.dir, "../..");

const FAKE_PARENT_CREDENTIALS: Record<string, string> = {
  TWILIO_ACCOUNT_SID: "AC_PARENT_FAKE_DO_NOT_LEAK",
  TWILIO_AUTH_TOKEN: "parent_fake_twilio_token",
  TWILIO_FROM_NUMBER: "+15555550123",
  SENDGRID_API_KEY: "SG.parent_fake_sendgrid",
  UPSTASH_REDIS_REST_URL: "https://parent-fake.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "parent_fake_upstash_token",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "parent@fake.iam.gserviceaccount.com",
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----",
  OPENAI_API_KEY: "sk-parent-fake-openai",
  LEADS_WEBHOOK_URL: "https://parent-fake.example/leads",
  CRM_WEBHOOK_URL: "https://parent-fake.example/crm",
  ANALYTICS_WRITE_KEY: "parent_fake_analytics",
  ASSESSMENT_ROI_AGENT_LIVE_ENABLED: "true",
  SPEED2LEAD_ENABLED: "true",
};

function probeChildEnv(parentOverrides: Record<string, string>): {
  status: number | null;
  leakedKeys: string[];
  liveEnabled: string | undefined;
  speed2LeadEnabled: string | undefined;
  twilioPresent: boolean;
} {
  const probeScript = `
import {
  buildIsolatedSafePreviewEnvironment,
  assertSafePreviewEnvironment,
  findProhibitedEnvKeys,
} from "./scripts/phase2/safePreviewEnvironment.ts";

const child = buildIsolatedSafePreviewEnvironment(process.env);
try {
  assertSafePreviewEnvironment(child);
} catch (e) {
  console.error(String(e));
  process.exit(2);
}

const leaked = [];
for (const key of Object.keys(child)) {
  if (key.startsWith("TWILIO_") || key.startsWith("SENDGRID_") || key === "OPENAI_API_KEY") {
    leaked.push(key);
  }
}
if (child.UPSTASH_REDIS_REST_URL?.includes("parent-fake")) leaked.push("UPSTASH_REDIS_REST_URL");
if (child.LEADS_WEBHOOK_URL?.includes("parent-fake")) leaked.push("LEADS_WEBHOOK_URL");
if (child.ASSESSMENT_ROI_AGENT_LIVE_ENABLED === "true") leaked.push("ASSESSMENT_ROI_AGENT_LIVE_ENABLED");

console.log(JSON.stringify({
  leakedKeys: leaked,
  liveEnabled: child.ASSESSMENT_ROI_AGENT_LIVE_ENABLED,
  speed2LeadEnabled: child.SPEED2LEAD_ENABLED,
  twilioPresent: Boolean(child.TWILIO_ACCOUNT_SID),
  prohibitedInChild: findProhibitedEnvKeys(child),
}));
`;

  const result = spawnSync("bun", ["-e", probeScript], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...parentOverrides, PATH: process.env.PATH },
  });

  if (result.status !== 0) {
    return {
      status: result.status,
      leakedKeys: [],
      liveEnabled: undefined,
      speed2LeadEnabled: undefined,
      twilioPresent: true,
    };
  }

  const parsed = JSON.parse(result.stdout.trim()) as {
    leakedKeys: string[];
    liveEnabled: string;
    speed2LeadEnabled: string;
    twilioPresent: boolean;
    prohibitedInChild: string[];
  };

  return {
    status: result.status,
    leakedKeys: parsed.leakedKeys,
    liveEnabled: parsed.liveEnabled,
    speed2LeadEnabled: parsed.speed2LeadEnabled,
    twilioPresent: parsed.twilioPresent,
    ...(parsed.prohibitedInChild.length
      ? { prohibitedInChild: parsed.prohibitedInChild }
      : {}),
  };
}

describe("start-safe-assessment-preview isolation", () => {
  test("X-SAFE-PREVIEW-01: builds fresh child env without parent credentials", () => {
    const child = buildIsolatedSafePreviewEnvironment({
      ...process.env,
      ...FAKE_PARENT_CREDENTIALS,
    });
    expect(child.TWILIO_ACCOUNT_SID).toBeUndefined();
    expect(child.SENDGRID_API_KEY).toBeUndefined();
    expect(child.OPENAI_API_KEY).toBeUndefined();
    expect(child.ASSESSMENT_ROI_AGENT_LIVE_ENABLED).toBe("false");
    expect(child.SPEED2LEAD_ENABLED).toBe("false");
    expect(child.UPSTASH_REDIS_REST_URL).toMatch(/^http:\/\/127\.0\.0\.1:8787$/);
    assertSafePreviewEnvironment(child);
  });

  test("X-SAFE-PREVIEW-02: negative probe — parent fake credentials do not reach child", () => {
    const probe = probeChildEnv(FAKE_PARENT_CREDENTIALS);
    expect(probe.status).toBe(0);
    expect(probe.leakedKeys).toEqual([]);
    expect(probe.liveEnabled).toBe("false");
    expect(probe.speed2LeadEnabled).toBe("false");
    expect(probe.twilioPresent).toBe(false);

    const child = buildIsolatedSafePreviewEnvironment({
      ...process.env,
      ...FAKE_PARENT_CREDENTIALS,
    });
    const liveAdapterProbe = spawnSync(
      "bun",
      [
        "-e",
        `import { isSpeed2LeadEnabled } from "./src/server/speed2Lead/config.ts"; process.exit(isSpeed2LeadEnabled() ? 1 : 0);`,
      ],
      { cwd: REPO_ROOT, env: child, encoding: "utf8" },
    );
    expect(liveAdapterProbe.status).toBe(0);
  });

  test("X-SAFE-PREVIEW-03: fail closed when prohibited variable injected after sanitization", () => {
    const child = buildIsolatedSafePreviewEnvironment(process.env);
    child.TWILIO_ACCOUNT_SID = "injected_after_sanitize";
    expect(() => assertSafePreviewEnvironment(child)).toThrow(
      /prohibited variable\(s\) present after sanitization/,
    );
  });

  test("X-SAFE-PREVIEW-04: caller cannot override ASSESSMENT_ROI_AGENT_LIVE_ENABLED via parent", () => {
    const child = buildIsolatedSafePreviewEnvironment({
      ...process.env,
      ASSESSMENT_ROI_AGENT_LIVE_ENABLED: "true",
    });
    expect(child.ASSESSMENT_ROI_AGENT_LIVE_ENABLED).toBe("false");
    assertSafePreviewEnvironment(child);
  });

  test("X-SAFE-PREVIEW-05: script source constructs isolated env and asserts before spawn", () => {
    const source = readFileSync(
      join(REPO_ROOT, "scripts/phase2/start-safe-assessment-preview.ts"),
      "utf8",
    );
    expect(source).toContain("buildIsolatedSafePreviewEnvironment");
    expect(source).toContain("assertSafePreviewEnvironment");
    expect(source).toContain("spawnSafePreviewServer");
    expect(source).not.toMatch(/Unset production credentials/);
  });

  test("X-SAFE-PREVIEW-06: missing credentials alone do not activate safe preview adapters", () => {
    const bareProbe = spawnSync(
      "bun",
      [
        "-e",
        `import { isSpeed2LeadEnabled } from "./src/server/speed2Lead/config.ts";
if (process.env.PHASE2_SAFE_PREVIEW) process.exit(3);
if (isSpeed2LeadEnabled()) process.exit(4);
process.exit(0);`,
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: { PATH: process.env.PATH, HOME: process.env.HOME },
      },
    );
    expect(bareProbe.status).toBe(0);

    const child = buildIsolatedSafePreviewEnvironment({
      PATH: process.env.PATH,
      HOME: process.env.HOME,
    });
    expect(child.PHASE2_SAFE_PREVIEW).toBe("1");
    assertSafePreviewEnvironment(child);
  });

  test("X-SAFE-PREVIEW-07: no visitor-controlled activation path in assessment route", () => {
    const routes = readFileSync(join(REPO_ROOT, "src/routes/assessment.tsx"), "utf8");
    expect(routes).not.toMatch(/PHASE2_SAFE_PREVIEW|fixtureMode|qaMode/i);
    expect(routes).not.toMatch(/searchParams.*safe|query.*preview/i);
  });

  test("X-SAFE-PREVIEW-09: outbound non-loopback network is blocked in safe preview child", () => {
    expect(() => assertLoopbackUrl("https://example.com", "fetch")).toThrow(
      /Egress blocked.*non-loopback host example\.com/,
    );
    expect(() => assertLoopbackUrl("http://127.0.0.1:8787/leads-webhook", "fetch")).not.toThrow();
    expect(() => assertLoopbackUrl("http://localhost:3000/assessment", "fetch")).not.toThrow();

    const preloadGuard = readFileSync(
      join(REPO_ROOT, "scripts/phase2/safePreviewNetworkGuard.ts"),
      "utf8",
    );
    expect(preloadGuard).toContain("assertLoopbackUrl");
    expect(preloadGuard).toMatch(/globalThis\.fetch/);
    const spawnSource = readFileSync(join(REPO_ROOT, "scripts/phase2/safePreviewEnvironment.ts"), "utf8");
    expect(spawnSource).toContain("--preload");
    expect(spawnSource).toContain("safePreviewNetworkGuard.ts");
  });

  test("X-SAFE-PREVIEW-10: startup fails when PHASE2_SAFE_PREVIEW boundary missing after build", () => {
    const child = buildIsolatedSafePreviewEnvironment(process.env);
    delete child.PHASE2_SAFE_PREVIEW;
    expect(() => assertSafePreviewEnvironment(child)).toThrow(/PHASE2_SAFE_PREVIEW=1 missing/);
  });

  test("X-SAFE-PREVIEW-11: env construction uses allowlist bootstrap keys only", () => {
    const child = buildIsolatedSafePreviewEnvironment({
      ...process.env,
      ...FAKE_PARENT_CREDENTIALS,
      RANDOM_PARENT_ONLY: "must-not-pass",
    });
    expect(Object.keys(child)).not.toContain("RANDOM_PARENT_ONLY");
    for (const key of Object.keys(child)) {
      const allowed =
        (BOOTSTRAP_KEYS as readonly string[]).includes(key) ||
        [
          "NODE_ENV",
          "SITE_ORIGIN",
          "UPSTASH_REDIS_REST_URL",
          "UPSTASH_REDIS_REST_TOKEN",
          "LEADS_WEBHOOK_URL",
          "ASSESSMENT_SECURITY_HMAC_SECRET",
          "ASSESSMENT_ROI_AGENT_LIVE_ENABLED",
          "SPEED2LEAD_ENABLED",
          "SPEED2LEAD_LLM_ENABLED",
          "PHASE2_SAFE_PREVIEW",
        ].includes(key);
      expect(allowed).toBe(true);
    }
  });

  test("X-SAFE-PREVIEW-08: prohibited key catalog covers integration env vars", () => {
    for (const key of [
      "TWILIO_ACCOUNT_SID",
      "SENDGRID_API_KEY",
      "UPSTASH_REDIS_REST_URL",
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "OPENAI_API_KEY",
      "LEADS_WEBHOOK_URL",
      "ASSESSMENT_ROI_AGENT_LIVE_ENABLED",
    ]) {
      expect(PROHIBITED_EXACT_KEYS).toContain(key);
    }
    const child = buildIsolatedSafePreviewEnvironment(FAKE_PARENT_CREDENTIALS);
    expect(findProhibitedEnvKeys(child)).toEqual([]);
  });
});
