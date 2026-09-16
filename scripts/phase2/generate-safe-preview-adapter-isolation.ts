/**
 * Generate safe-preview adapter isolation proof artifact.
 */
import { createHash } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const OUT = join(ROOT, "review-artifacts/phase2");
const SHA = execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(join(ROOT, path))).digest("hex");
}

const testRun = spawnSync("bun", ["test", "scripts/phase2/start-safe-assessment-preview.test.ts"], {
  cwd: ROOT,
  encoding: "utf8",
});
const transportRun = spawnSync("bun", ["scripts/phase2/safePreviewTransportProbes.ts"], {
  cwd: ROOT,
  encoding: "utf8",
});

const envSource = readFileSync(join(ROOT, "scripts/phase2/safePreviewEnvironment.ts"), "utf8");
const bootstrapMatch = envSource.match(/export const BOOTSTRAP_KEYS = \[([\s\S]*?)\] as const;/);
const bootstrapKeys = bootstrapMatch
  ? [...bootstrapMatch[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1])
  : [];

const forcedKeys = [
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
];

const adapterTable = [
  {
    integration: "Twilio/SMS",
    productionAdapter: "Twilio REST via TWILIO_* env + isSpeed2LeadEnabled()",
    safeAdapter: "SPEED2LEAD_ENABLED=false; Twilio keys stripped; SMS paths gated",
    forcedSelection: "buildIsolatedSafePreviewEnvironment + assertSafePreviewEnvironment",
    visitorCannotChange: "No route/query/body flag selects Twilio; config reads process.env only",
    selectionTest: "X-SAFE-PREVIEW-02, X-SAFE-PREVIEW-04",
    networkTest: "X-SAFE-PREVIEW-09, X-SAFE-PREVIEW-18, transport probes",
  },
  {
    integration: "SendGrid/email",
    productionAdapter: "SENDGRID_API_KEY",
    safeAdapter: "Key absent; email send paths unreachable without credentials",
    forcedSelection: "Prohibited env key list",
    visitorCannotChange: "No visitor-facing email provider toggle",
    selectionTest: "X-SAFE-PREVIEW-01, X-SAFE-PREVIEW-08",
    networkTest: "transport probes",
  },
  {
    integration: "Redis/Upstash",
    productionAdapter: "UPSTASH_REDIS_REST_URL/TOKEN production values",
    safeAdapter: "Local stub http://127.0.0.1:8787 + phase2-safe-preview-stub-token",
    forcedSelection: "Forced safe values override parent",
    visitorCannotChange: "Redis URL not client-controlled",
    selectionTest: "X-SAFE-PREVIEW-01",
    networkTest: "loopback probe + X-SAFE-PREVIEW-09",
  },
  {
    integration: "CRM",
    productionAdapter: "CRM_WEBHOOK_URL / HUBSPOT_* / SALESFORCE_*",
    safeAdapter: "CRM keys stripped; webhooks disabled",
    forcedSelection: "Prohibited prefixes CRM_, HUBSPOT_, SALESFORCE_",
    visitorCannotChange: "No assessment route CRM override",
    selectionTest: "X-SAFE-PREVIEW-02",
    networkTest: "transport probes",
  },
  {
    integration: "Webhooks",
    productionAdapter: "LEADS_WEBHOOK_URL external URL",
    safeAdapter: "http://127.0.0.1:8787/leads-webhook local stub",
    forcedSelection: "Forced LEADS_WEBHOOK_URL safe value",
    visitorCannotChange: "Server-side env only",
    selectionTest: "X-SAFE-PREVIEW-02",
    networkTest: "X-SAFE-PREVIEW-15–18",
  },
  {
    integration: "Analytics",
    productionAdapter: "External analytics keys (SEGMENT_/POSTHOG_/etc.)",
    safeAdapter: "trackEvent default sink: console.info in DEV only; production build no-op; no keys in child env",
    forcedSelection: "Analytics keys prohibited; NODE_ENV=production in safe preview",
    visitorCannotChange: "No setAnalyticsSink from routes",
    selectionTest: "X-SAFE-PREVIEW-20",
    networkTest: "CSP connect-src loopback-only in safe-preview-serve.ts",
  },
  {
    integration: "Google APIs",
    productionAdapter: "GOOGLE_* service account / calendar env",
    safeAdapter: "All GOOGLE_* keys stripped",
    forcedSelection: "Prohibited GOOGLE_ prefix",
    visitorCannotChange: "No client calendar override",
    selectionTest: "X-SAFE-PREVIEW-08, X-SAFE-PREVIEW-12",
    networkTest: "transport probes",
  },
  {
    integration: "Report tokens",
    productionAdapter: "Production ASSESSMENT_SECURITY_HMAC_SECRET",
    safeAdapter: "Local-only phase2-safe-preview-local-hmac-secret",
    forcedSelection: "Forced safe HMAC secret",
    visitorCannotChange: "Token minting server-side only",
    selectionTest: "X-SAFE-PREVIEW-01",
    networkTest: "loopback-only serving",
  },
  {
    integration: "PDF generation/delivery",
    productionAdapter: "Server PDF bytes + optional external delivery",
    safeAdapter: "Local render; no external PDF delivery credentials",
    forcedSelection: "No SendGrid/Twilio for PDF path in safe preview",
    visitorCannotChange: "Download route uses server env only",
    selectionTest: "X-SAFE-PREVIEW-06",
    networkTest: "transport probes",
  },
  {
    integration: "Agent/LLM providers",
    productionAdapter: "OPENAI_API_KEY + ASSESSMENT_ROI_AGENT_LIVE_ENABLED",
    safeAdapter: "ASSESSMENT_ROI_AGENT_LIVE_ENABLED=false; OPENAI absent; SPEED2LEAD_LLM_ENABLED=false",
    forcedSelection: "Forced false live flag + prohibited OPENAI_ keys",
    visitorCannotChange: "No visitor agent-live toggle in assessment route",
    selectionTest: "X-SAFE-PREVIEW-04, X-SAFE-PREVIEW-07",
    networkTest: "transport probes",
  },
];

const result = {
  gitSha: SHA,
  safePreviewTestSuite: {
    file: "scripts/phase2/start-safe-assessment-preview.test.ts",
    command: "bun test scripts/phase2/start-safe-assessment-preview.test.ts",
    exitStatus: testRun.status,
    pass: testRun.status === 0,
    outputTail: `${testRun.stdout ?? ""}${testRun.stderr ?? ""}`.split("\n").slice(-8).join("\n"),
  },
  transportProbes: {
    command: "bun scripts/phase2/safePreviewTransportProbes.ts",
    exitStatus: transportRun.status,
    pass: transportRun.status === 0,
    output: `${transportRun.stdout ?? ""}${transportRun.stderr ?? ""}`.trim(),
  },
  environmentAllowlist: {
    bootstrapKeys,
    forcedSafeKeys: forcedKeys,
    note: "HOME and XDG_* must point to isolated temporary directories created by createSafePreviewIsolation(), never the parent HOME.",
  },
  adapterTable,
  fileHashes: {
    safePreviewEnvironment: sha256("scripts/phase2/safePreviewEnvironment.ts"),
    safePreviewIsolation: sha256("scripts/phase2/safePreviewIsolation.ts"),
    safePreviewNetworkGuard: sha256("scripts/phase2/safePreviewNetworkGuard.ts"),
    safePreviewNetworkNamespace: sha256("scripts/phase2/safePreviewNetworkNamespace.ts"),
    startSafeAssessmentPreview: sha256("scripts/phase2/start-safe-assessment-preview.ts"),
    safePreviewServe: sha256("scripts/phase2/safe-preview-serve.ts"),
    safePreviewTests: sha256("scripts/phase2/start-safe-assessment-preview.test.ts"),
  },
};

writeFileSync(join(OUT, "safe-preview-adapter-isolation.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ sha: SHA, testsPass: testRun.status === 0, transportPass: transportRun.status === 0 }, null, 2));
