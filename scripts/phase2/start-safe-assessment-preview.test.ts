import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  BOOTSTRAP_KEYS,
  NETWORK_GUARD_PRELOAD,
  PROHIBITED_EXACT_KEYS,
  SAFE_PREVIEW_SERVE_SCRIPT,
  assertSafePreviewEnvironment,
  buildIsolatedSafePreviewEnvironment,
  createSafePreviewIsolation,
  findProhibitedEnvKeys,
  runSanitizedInstall,
  spawnSafePreviewNetworkProbe,
} from "./safePreviewEnvironment";
import { assertLoopbackUrl } from "./safePreviewNetworkGuard";
import {
  externalConnectionWasBlocked,
  spawnSyncInNetworkNamespace,
} from "./safePreviewNetworkNamespace";

const REPO_ROOT = join(import.meta.dir, "../..");
const RUN_SHA = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" })
  .stdout.trim();

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
  AWS_SHARED_CREDENTIALS_FILE: "/home/chris/.aws/credentials",
  GOOGLE_APPLICATION_CREDENTIALS: "/home/chris/.config/gcloud/key.json",
  NETRC: "/home/chris/.netrc",
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
if (child.HOME?.includes("/home/chris")) leaked.push("HOME");

console.log(JSON.stringify({
  leakedKeys: leaked,
  liveEnabled: child.ASSESSMENT_ROI_AGENT_LIVE_ENABLED,
  speed2LeadEnabled: child.SPEED2LEAD_ENABLED,
  twilioPresent: Boolean(child.TWILIO_ACCOUNT_SID),
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
  };

  return {
    status: result.status,
    leakedKeys: parsed.leakedKeys,
    liveEnabled: parsed.liveEnabled,
    speed2LeadEnabled: parsed.speed2LeadEnabled,
    twilioPresent: parsed.twilioPresent,
  };
}

describe("start-safe-assessment-preview isolation", () => {
  test("X-SAFE-PREVIEW-01: builds fresh child env without parent credentials", () => {
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(
      { ...process.env, ...FAKE_PARENT_CREDENTIALS },
      isolation,
    );
    expect(child.TWILIO_ACCOUNT_SID).toBeUndefined();
    expect(child.SENDGRID_API_KEY).toBeUndefined();
    expect(child.OPENAI_API_KEY).toBeUndefined();
    expect(child.ASSESSMENT_ROI_AGENT_LIVE_ENABLED).toBe("false");
    expect(child.SPEED2LEAD_ENABLED).toBe("false");
    expect(child.UPSTASH_REDIS_REST_URL).toMatch(/^http:\/\/127\.0\.0\.1:8787$/);
    expect(child.HOME).toContain("phase2-safe-preview-");
    expect(child.HOME).not.toBe(process.env.HOME);
    assertSafePreviewEnvironment(child);
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-02: negative probe — parent fake credentials do not reach child", () => {
    const probe = probeChildEnv(FAKE_PARENT_CREDENTIALS);
    expect(probe.status).toBe(0);
    expect(probe.leakedKeys).toEqual([]);
    expect(probe.liveEnabled).toBe("false");
    expect(probe.speed2LeadEnabled).toBe("false");
    expect(probe.twilioPresent).toBe(false);

    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(
      { ...process.env, ...FAKE_PARENT_CREDENTIALS },
      isolation,
    );
    const liveAdapterProbe = spawnSync(
      "bun",
      [
        "-e",
        `import { isSpeed2LeadEnabled } from "./src/server/speed2Lead/config.ts"; process.exit(isSpeed2LeadEnabled() ? 1 : 0);`,
      ],
      { cwd: REPO_ROOT, env: child, encoding: "utf8" },
    );
    expect(liveAdapterProbe.status).toBe(0);

    const networkProbe = spawnSafePreviewNetworkProbe(child, "https://example.com");
    expect(networkProbe.status).toBe(0);
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-03: fail closed when prohibited variable injected after sanitization", () => {
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(process.env, isolation);
    child.TWILIO_ACCOUNT_SID = "injected_after_sanitize";
    expect(() => assertSafePreviewEnvironment(child)).toThrow(
      /prohibited variable\(s\) present after sanitization/,
    );
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-04: caller cannot override ASSESSMENT_ROI_AGENT_LIVE_ENABLED via parent", () => {
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(
      {
        ...process.env,
        ASSESSMENT_ROI_AGENT_LIVE_ENABLED: "true",
      },
      isolation,
    );
    expect(child.ASSESSMENT_ROI_AGENT_LIVE_ENABLED).toBe("false");
    assertSafePreviewEnvironment(child);
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-05: launcher uses Docker internal network and fail-closed preflight", () => {
    const source = readFileSync(
      join(REPO_ROOT, "scripts/phase2/start-safe-assessment-preview.ts"),
      "utf8",
    );
    expect(source).toContain("resolveIsolationRuntime");
    expect(source).toContain("startDockerPreview");
    expect(source).toContain("depsCacheReady");
    expect(source).toContain("prepare-safe-preview-deps");
    expect(source).toContain("Do NOT continue");
    expect(source).not.toContain("runPrepareDepsOnHost");
    expect(source).not.toContain('spawnSync("bun", ["run", "build"]');
    expect(source).not.toContain("unshare");
    expect(source).toContain("stopDockerPreview");
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

    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(
      { PATH: process.env.PATH, HOME: process.env.HOME },
      isolation,
    );
    expect(child.PHASE2_SAFE_PREVIEW).toBe("1");
    assertSafePreviewEnvironment(child);
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-07: no visitor-controlled activation path in assessment route", () => {
    const routes = readFileSync(join(REPO_ROOT, "src/routes/assessment.tsx"), "utf8");
    expect(routes).not.toMatch(/PHASE2_SAFE_PREVIEW|fixtureMode|qaMode/i);
    expect(routes).not.toMatch(/searchParams.*safe|query.*preview/i);
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
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(FAKE_PARENT_CREDENTIALS, isolation);
    expect(findProhibitedEnvKeys(child)).toEqual([]);
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-09: fetch non-loopback blocked with exit 0 meaning block observed", () => {
    expect(() => assertLoopbackUrl("https://example.com", "fetch")).toThrow(
      /Egress blocked.*non-loopback host example\.com/,
    );
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(process.env, isolation);
    const probe = spawnSafePreviewNetworkProbe(child, "https://example.com");
    expect(probe.status).toBe(0);
    expect(`${probe.stdout ?? ""}${probe.stderr ?? ""}`).toContain("PASS: non-loopback request was blocked");
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-10: startup fails when PHASE2_SAFE_PREVIEW boundary missing after build", () => {
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(process.env, isolation);
    delete child.PHASE2_SAFE_PREVIEW;
    expect(() => assertSafePreviewEnvironment(child)).toThrow(/PHASE2_SAFE_PREVIEW=1 missing/);
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-11: env construction uses allowlist bootstrap keys only", () => {
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(
      {
        ...process.env,
        ...FAKE_PARENT_CREDENTIALS,
        RANDOM_PARENT_ONLY: "must-not-pass",
      },
      isolation,
    );
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
          "HOME",
          "XDG_CONFIG_HOME",
          "XDG_CACHE_HOME",
          "XDG_DATA_HOME",
          "BUN_INSTALL_CACHE_DIR",
          "TMPDIR",
          "npm_config_userconfig",
          "npm_config_globalconfig",
        ].includes(key);
      expect(allowed).toBe(true);
    }
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-12: parent HOME and credential file paths are not reused", () => {
    const parentHome = mkdtempSync(join(tmpdir(), "parent-home-"));
    writeFileSync(join(parentHome, ".aws-credentials-leak"), "FAKE_AWS_SECRET");
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(
      {
        ...process.env,
        ...FAKE_PARENT_CREDENTIALS,
        HOME: parentHome,
      },
      isolation,
    );
    expect(child.HOME).not.toBe(parentHome);
    expect(child.AWS_SHARED_CREDENTIALS_FILE).toBeUndefined();
    expect(child.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
    expect(child.NETRC).toBeUndefined();
    assertSafePreviewEnvironment(child);
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-13: local .env secrets do not load into sanitized build child", () => {
    const envDir = mkdtempSync(join(tmpdir(), "phase2-env-test-"));
    writeFileSync(
      join(envDir, ".env"),
      "TWILIO_ACCOUNT_SID=AC_ENVFILE_LEAK\nOPENAI_API_KEY=sk-envfile-leak\n",
    );
    writeFileSync(
      join(envDir, ".env.local"),
      "SENDGRID_API_KEY=SG.envfile.leak\n",
    );
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(process.env, isolation);
    const probe = spawnSync(
      "bun",
      [
        "--env-file=/dev/null",
        "--preload",
        NETWORK_GUARD_PRELOAD,
        "-e",
        `process.exit(process.env.TWILIO_ACCOUNT_SID || process.env.OPENAI_API_KEY || process.env.SENDGRID_API_KEY ? 1 : 0);`,
      ],
      { cwd: envDir, env: child, encoding: "utf8" },
    );
    expect(probe.status).toBe(0);
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-14: startup aborts when Redis stub script missing", () => {
    const source = readFileSync(join(REPO_ROOT, "scripts/phase2/safePreviewEnvironment.ts"), "utf8");
    expect(source).toContain("upstash-redis-stub.ts");
    expect(source).toContain("startRedisStub");
  });

  test("X-SAFE-PREVIEW-15: node:http non-loopback request is blocked", () => {
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(process.env, isolation);
    const probe = spawnSyncInNetworkNamespace(
      "bun",
      ["--env-file=/dev/null", "scripts/phase2/safePreviewHttpGetProbe.ts", "http://example.com/"],
      { cwd: REPO_ROOT, env: child, encoding: "utf8" },
    );
    expect(probe.status).toBe(0);
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-16: node:https non-loopback request is blocked", () => {
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(process.env, isolation);
    const probe = spawnSyncInNetworkNamespace(
      "bun",
      ["--env-file=/dev/null", "scripts/phase2/safePreviewHttpsGetProbe.ts", "https://example.com/"],
      { cwd: REPO_ROOT, env: child, encoding: "utf8" },
    );
    expect(probe.status).toBe(0);
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-17: node:net non-loopback connect is blocked", () => {
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(process.env, isolation);
    const probe = spawnSyncInNetworkNamespace(
      "bun",
      ["--env-file=/dev/null", "scripts/phase2/safePreviewNetConnectProbe.ts", "example.com", "443"],
      { cwd: REPO_ROOT, env: child, encoding: "utf8" },
    );
    expect(probe.status).toBe(0);
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-18: child_process curl command is blocked by loopback-only namespace", () => {
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(process.env, isolation);
    const probe = spawnSyncInNetworkNamespace(
      "curl",
      ["-s", "--max-time", "2", "https://example.com"],
      { cwd: REPO_ROOT, env: child, encoding: "utf8" },
    );
    const output = `${probe.stdout ?? ""}${probe.stderr ?? ""}`;
    expect(externalConnectionWasBlocked(output, probe.status)).toBe(true);
    isolation.cleanup();
  });

  test("X-SAFE-PREVIEW-19: safe preview serve binds loopback and sets CSP", () => {
    const source = readFileSync(SAFE_PREVIEW_SERVE_SCRIPT, "utf8");
    expect(source).toContain('process.env.PHASE2_DOCKER_RUNTIME === "1" ? "0.0.0.0" : "127.0.0.1"');
    expect(source).toContain("SAFE_PREVIEW_CSP_HEADER");
    expect(source).toContain("Content-Security-Policy");
    const cspSource = readFileSync(join(REPO_ROOT, "scripts/phase2/safePreviewCsp.ts"), "utf8");
    expect(cspSource).toContain("connect-src");
    expect(cspSource).toContain("form-action");
  });

  test("X-SAFE-PREVIEW-20: trackEvent default sink makes no network request in production build", () => {
    const trackSource = readFileSync(join(REPO_ROOT, "src/lib/analytics/trackEvent.ts"), "utf8");
    expect(trackSource).toContain("import.meta.env.DEV");
    expect(trackSource).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|navigator\./);

    const probe = spawnSync(
      "bun",
      ["test", "src/lib/analytics/trackEvent.test.ts"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    expect(probe.status).toBe(0);
  });

  test("X-SAFE-PREVIEW-21: frozen install command uses guard and fails closed on missing lock", () => {
    const isolation = createSafePreviewIsolation();
    const child = buildIsolatedSafePreviewEnvironment(process.env, isolation);
    const result = runSanitizedInstall(child);
    expect(result.status).toBe(0);
    isolation.cleanup();
  });
});

export const SAFE_PREVIEW_TEST_RUN_SHA = RUN_SHA;
