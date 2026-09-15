/**
 * Isolated child-process environment for Phase 2 owner keyboard preview.
 * Constructs a fresh env object — never passes parent credentials through.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL("../..", import.meta.url)));

export const SAFE_PREVIEW_BASE_URL = "http://127.0.0.1:3000";
export const REDIS_STUB_PORT = 8787;
export const REDIS_STUB_URL = `http://127.0.0.1:${REDIS_STUB_PORT}`;

/** Bootstrap keys copied from parent (non-secret runtime plumbing only). */
const BOOTSTRAP_KEYS = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "TMPDIR",
  "PWD",
  "BUN_INSTALL",
  "XDG_RUNTIME_DIR",
  "DISPLAY",
] as const;

/** Exact env keys that must never reach the preview child. */
export const PROHIBITED_EXACT_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "TWILIO_WEBHOOK_URL",
  "TWILIO_MESSAGING_SERVICE_SID",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "GOOGLE_CALENDAR_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "OPENAI_API_KEY",
  "VAPI_API_KEY",
  "VAPI_ASSISTANT_ID",
  "LEADS_WEBHOOK_URL",
  "CRM_WEBHOOK_URL",
  "HUBSPOT_API_KEY",
  "SALESFORCE_CLIENT_ID",
  "SALESFORCE_CLIENT_SECRET",
  "ANALYTICS_WRITE_KEY",
  "SEGMENT_WRITE_KEY",
  "POSTHOG_API_KEY",
  "MIXPANEL_TOKEN",
  "NETLIFY_DATABASE_URL",
  "DATABASE_URL",
  "REDIS_URL",
  "ASSESSMENT_SECURITY_HMAC_SECRET",
  "ASSESSMENT_ROI_AGENT_LIVE_ENABLED",
  "SPEED2LEAD_LIVE_SMOKE",
  "SPEED2LEAD_ENABLED",
  "PHASE2_SAFE_QA_HARNESS",
] as const;

/** Prefixes that must never appear in the child env (values are never logged). */
export const PROHIBITED_PREFIXES = [
  "TWILIO_",
  "SENDGRID_",
  "UPSTASH_",
  "GOOGLE_",
  "OPENAI_",
  "VAPI_",
  "HUBSPOT_",
  "SALESFORCE_",
  "POSTHOG_",
  "MIXPANEL_",
  "SEGMENT_",
  "CRM_",
  "WEBHOOK_",
  "ANALYTICS_",
] as const;

export type SafePreviewAdapterSummary = {
  leadSubmission: "in-memory / stub webhook at local Redis stub";
  redis: "scripts/phase2/upstash-redis-stub.ts in-memory Map";
  reportTokensPdf: "local HMAC secret only; no external PDF delivery";
  sms: "disabled — SPEED2LEAD_ENABLED=false, Twilio credentials absent";
  email: "disabled — SendGrid credentials absent";
  crm: "disabled — CRM/webhook credentials absent";
  webhooks: "LEADS_WEBHOOK_URL points to local stub only";
  analytics: "browser-only trackEvent; no external analytics keys in child env";
  agentProvider: "ASSESSMENT_ROI_AGENT_LIVE_ENABLED forced false; OpenAI absent";
};

export const SAFE_PREVIEW_ADAPTERS: SafePreviewAdapterSummary = {
  leadSubmission: "in-memory / stub webhook at local Redis stub",
  redis: "scripts/phase2/upstash-redis-stub.ts in-memory Map",
  reportTokensPdf: "local HMAC secret only; no external PDF delivery",
  sms: "disabled — SPEED2LEAD_ENABLED=false, Twilio credentials absent",
  email: "disabled — SendGrid credentials absent",
  crm: "disabled — CRM/webhook credentials absent",
  webhooks: "LEADS_WEBHOOK_URL points to local stub only",
  analytics: "browser-only trackEvent; no external analytics keys in child env",
  agentProvider: "ASSESSMENT_ROI_AGENT_LIVE_ENABLED forced false; OpenAI absent",
};

const FORCED_SAFE_VALUES: Record<string, string> = {
  NODE_ENV: "production",
  SITE_ORIGIN: SAFE_PREVIEW_BASE_URL,
  UPSTASH_REDIS_REST_URL: REDIS_STUB_URL,
  UPSTASH_REDIS_REST_TOKEN: "phase2-safe-preview-stub-token",
  LEADS_WEBHOOK_URL: `${REDIS_STUB_URL}/leads-webhook`,
  ASSESSMENT_SECURITY_HMAC_SECRET: "phase2-safe-preview-local-hmac-secret-0123456789abcdef",
  ASSESSMENT_ROI_AGENT_LIVE_ENABLED: "false",
  SPEED2LEAD_ENABLED: "false",
  SPEED2LEAD_LLM_ENABLED: "false",
  PHASE2_SAFE_PREVIEW: "1",
};

export function isProhibitedEnvKey(key: string): boolean {
  if ((PROHIBITED_EXACT_KEYS as readonly string[]).includes(key)) return true;
  return PROHIBITED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function buildIsolatedSafePreviewEnvironment(
  parentEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const child: Record<string, string> = {};
  for (const key of BOOTSTRAP_KEYS) {
    const value = parentEnv[key];
    if (value != null && value !== "") child[key] = value;
  }
  Object.assign(child, FORCED_SAFE_VALUES);
  return child;
}

function isAllowedSafeOverride(key: string, value: string): boolean {
  if (key === "UPSTASH_REDIS_REST_URL") return value === REDIS_STUB_URL;
  if (key === "UPSTASH_REDIS_REST_TOKEN") return value === FORCED_SAFE_VALUES.UPSTASH_REDIS_REST_TOKEN;
  if (key === "LEADS_WEBHOOK_URL") return value === FORCED_SAFE_VALUES.LEADS_WEBHOOK_URL;
  if (key === "ASSESSMENT_SECURITY_HMAC_SECRET") {
    return value === FORCED_SAFE_VALUES.ASSESSMENT_SECURITY_HMAC_SECRET;
  }
  if (key === "ASSESSMENT_ROI_AGENT_LIVE_ENABLED") return value === "false";
  if (key === "SPEED2LEAD_ENABLED") return value === "false";
  if (key === "SPEED2LEAD_LLM_ENABLED") return value === "false";
  if (key === "PHASE2_SAFE_PREVIEW") return value === "1";
  if (key === "SITE_ORIGIN") return value === SAFE_PREVIEW_BASE_URL;
  return false;
}

export function findProhibitedEnvKeys(env: Record<string, string>): string[] {
  const violations: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    if (isAllowedSafeOverride(key, value)) continue;
    if (isProhibitedEnvKey(key)) violations.push(key);
  }
  if (env.ASSESSMENT_ROI_AGENT_LIVE_ENABLED !== "false") {
    violations.push("ASSESSMENT_ROI_AGENT_LIVE_ENABLED");
  }
  return [...new Set(violations)].sort();
}

export function assertSafePreviewEnvironment(env: Record<string, string>): void {
  const violations = findProhibitedEnvKeys(env);
  if (violations.length > 0) {
    throw new Error(
      `Safe preview environment check failed: prohibited variable(s) present after sanitization: ${violations.join(", ")}`,
    );
  }
  if (env.PHASE2_SAFE_PREVIEW !== "1") {
    throw new Error("Safe preview boundary marker PHASE2_SAFE_PREVIEW=1 missing");
  }
}

let redisStubProcess: ChildProcess | null = null;

export function stopRedisStub(): void {
  if (redisStubProcess?.pid) {
    try {
      process.kill(redisStubProcess.pid);
    } catch {
      /* already stopped */
    }
    redisStubProcess = null;
  }
  spawnSync("bash", [
    "-lc",
    `pids=$(lsof -t -iTCP:${REDIS_STUB_PORT} -sTCP:LISTEN 2>/dev/null || true); if [ -n "$pids" ]; then kill $pids 2>/dev/null || true; fi`,
  ]);
}

export function startRedisStub(): void {
  stopRedisStub();
  const stubEnv = buildIsolatedSafePreviewEnvironment(process.env);
  stubEnv.PHASE2_REDIS_STUB_PORT = String(REDIS_STUB_PORT);
  redisStubProcess = spawn("bun", ["scripts/phase2/upstash-redis-stub.ts"], {
    cwd: REPO_ROOT,
    stdio: "ignore",
    env: stubEnv,
  });
}

export function stopPreviewServer(): void {
  spawnSync("bash", [
    "-lc",
    "pids=$(lsof -t -iTCP:3000 -sTCP:LISTEN 2>/dev/null || true); if [ -n \"$pids\" ]; then kill $pids 2>/dev/null || true; fi",
  ]);
}

export function spawnSafePreviewServer(
  childEnv: Record<string, string>,
): ChildProcess {
  assertSafePreviewEnvironment(childEnv);
  stopPreviewServer();
  startRedisStub();
  return spawn("bun", ["run", "start"], {
    cwd: REPO_ROOT,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Test hook: assert sanitization even when a prohibited key is injected post-build. */
export function assertSafePreviewEnvironmentStrict(
  env: Record<string, string>,
  options?: { allowInjectionTest?: boolean },
): void {
  if (!options?.allowInjectionTest) {
    assertSafePreviewEnvironment(env);
    return;
  }
  const violations = findProhibitedEnvKeys(env);
  if (violations.length === 0) return;
  throw new Error(
    `Expected failure-path detection: prohibited variable(s): ${violations.join(", ")}`,
  );
}
