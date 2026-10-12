/**
 * Sanitized live security proofs. Never prints credentials.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

function loadPreviewBasicAuthCreds(): { user: string; pass: string } | undefined {
  const user = process.env.PHASE2_NETLIFY_PREVIEW_BASIC_AUTH_USER?.trim();
  const pass = process.env.PHASE2_NETLIFY_PREVIEW_BASIC_AUTH_PASSWORD?.trim();
  if (user && pass) return { user, pass };
  const artifact =
    process.env.PHASE2_PREVIEW_AUTH_ARTIFACT ??
    "/opt/cursor/artifacts/netlify-owner-qa-preview-basic-auth.txt";
  try {
    const text = readFileSync(artifact, "utf8");
    const map = Object.fromEntries(
      text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const i = line.indexOf("=");
          return [line.slice(0, i), line.slice(i + 1)] as const;
        }),
    );
    if (map.user && map.password) return { user: map.user, pass: map.password };
  } catch {
    /* optional artifact */
  }
  return undefined;
}

const OUT =
  process.argv[2] ??
  join(import.meta.dir, "../../review-artifacts/phase2/website-polish/pr98-deploy-preview-auth-proof.json");
const OWNER_QA_URL = (
  process.env.OWNER_QA_URL ?? "https://6ac567c4268f3b2f994edf33--624voice-phase2-owner-qa.netlify.app"
).replace(/\/$/, "");
const PR98_URL = (process.env.PR98_URL ?? "https://deploy-preview-98--624voice.netlify.app").replace(
  /\/$/,
  "",
);
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

const auth = loadPreviewBasicAuthCreds();

const homeHtml = auth
  ? execSync(`curl -sS -u '${auth.user.replace(/'/g, "'\\''")}:${auth.pass.replace(/'/g, "'\\''")}' '${PR98_URL}/'`, {
      encoding: "utf8",
    })
  : execSync(`curl -sS '${PR98_URL}/'`, { encoding: "utf8" });
const assetMatch = homeHtml.match(/\/assets\/[^"'\s]+\.js/);
const assetPath = assetMatch?.[0] ?? "/assets/index-2mKZHDUI.js";

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
