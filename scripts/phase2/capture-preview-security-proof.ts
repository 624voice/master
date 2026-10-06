/**
 * Sanitized live security proofs. Never prints credentials.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const OUT =
  process.argv[2] ??
  join(import.meta.dir, "../../review-artifacts/phase2/website-polish/pr98-deploy-preview-auth-proof.json");
const OWNER_QA_URL = (
  process.env.OWNER_QA_URL ?? "https://6ac53bbaacc0499e7f834096--624voice-phase2-owner-qa.netlify.app"
).replace(/\/$/, "");
const PR98_URL = (process.env.PR98_URL ?? "https://deploy-preview-98--624voice.netlify.app").replace(
  /\/$/,
  "",
);
const MAIN_SITE_ID = process.env.PHASE2_NETLIFY_MAIN_SITE_ID ?? "4a60ce60-c975-4c5f-901e-451adcbb16ab";

type Capture = {
  label: string;
  url: string;
  status: number;
  headers: {
    wwwAuthenticate: string | null;
    xRobotsTag: string | null;
    contentType: string | null;
  };
  bodySample: string;
};

function capture(label: string, url: string, auth?: { user: string; pass: string }): Capture {
  const authFlag = auth ? `-u '${auth.user.replace(/'/g, "'\\''")}:${auth.pass.replace(/'/g, "'\\''")}'` : "";
  const hdr = execSync(`curl -sSI ${authFlag} '${url.replace(/'/g, "'\\''")}'`, {
    encoding: "utf8",
  }).replace(/\r/g, "");
  const status = Number((hdr.match(/^HTTP\/\S+ (\d+)/m) ?? [])[1] ?? 0);
  const pick = (name: string) => {
    const m = hdr.match(new RegExp(`^${name}: (.+)$`, "im"));
    return m?.[1]?.trim() ?? null;
  };
  const body = execSync(`curl -sS ${authFlag} '${url.replace(/'/g, "'\\''")}'`, {
    encoding: "utf8",
  }).slice(0, 500);
  return {
    label,
    url,
    status,
    headers: {
      wwwAuthenticate: pick("www-authenticate"),
      xRobotsTag: pick("x-robots-tag"),
      contentType: pick("content-type"),
    },
    bodySample: body.replace(/\s+/g, " ").trim(),
  };
}

execSync("netlify unlink >/dev/null 2>&1 || true", { stdio: "ignore" });
execSync(`netlify link --id ${MAIN_SITE_ID}`, { stdio: "ignore" });
const user = execSync("netlify env:get PHASE2_OWNER_QA_EDGE_BASIC_AUTH_USER --context deploy-preview", {
  encoding: "utf8",
}).trim();
const pass = execSync("netlify env:get PHASE2_OWNER_QA_EDGE_BASIC_AUTH_PASS --context deploy-preview", {
  encoding: "utf8",
}).trim();

const homeHtml = execSync(`curl -sS '${PR98_URL}/'`, { encoding: "utf8" });
const assetMatch = homeHtml.match(/\/assets\/[^"'\s]+\.js/);
const assetPath = assetMatch?.[0] ?? "/assets/";

const auth = user && pass ? { user, pass } : undefined;

const results = {
  capturedAt: new Date().toISOString(),
  pr98DeployPreview: {
    anonymousRoot: capture("pr98-anonymous-root", `${PR98_URL}/`),
    anonymousHealth: capture("pr98-anonymous-health", `${PR98_URL}/api/health`),
    anonymousAsset: capture("pr98-anonymous-asset", `${PR98_URL}${assetPath}`),
    badCredentialsRoot: capture("pr98-bad-credentials-root", `${PR98_URL}/`, {
      user: "bad",
      pass: "creds",
    }),
    goodCredentialsRoot: auth
      ? capture("pr98-good-credentials-root", `${PR98_URL}/`, auth)
      : { skipped: true },
    goodCredentialsHealth: auth
      ? capture("pr98-good-credentials-health", `${PR98_URL}/api/health`, auth)
      : { skipped: true },
  },
  ownerQaOpen: {
    anonymousRoot: capture("owner-qa-anonymous-root", `${OWNER_QA_URL}/`),
    anonymousHealth: capture("owner-qa-anonymous-health", `${OWNER_QA_URL}/api/health`),
    anonymous404: capture("owner-qa-anonymous-404", `${OWNER_QA_URL}/does-not-exist-404`),
  },
};

mkdirSync(join(OUT, ".."), { recursive: true });
writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ ok: true, out: OUT }));
