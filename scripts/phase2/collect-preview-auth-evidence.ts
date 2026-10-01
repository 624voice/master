/**
 * Sanitized live Basic Auth evidence for protected previews (reads creds from env or auth artifact).
 */
import { readFileSync } from "node:fs";

function loadCreds(): { user: string; pass: string } {
  const user = process.env.PHASE2_NETLIFY_PREVIEW_BASIC_AUTH_USER?.trim();
  const pass = process.env.PHASE2_NETLIFY_PREVIEW_BASIC_AUTH_PASSWORD?.trim();
  if (user && pass) return { user, pass };
  const artifact = process.env.PHASE2_PREVIEW_AUTH_ARTIFACT ?? "/opt/cursor/artifacts/netlify-owner-qa-preview-basic-auth.txt";
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
  if (!map.user || !map.password) throw new Error("Auth artifact missing user/password");
  return { user: map.user, pass: map.password };
}

async function probe(
  label: string,
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, { ...init, redirect: "manual" });
  const body = await res.text();
  return {
    label,
    path,
    status: res.status,
    xRobotsTag: res.headers.get("x-robots-tag"),
    wwwAuthenticate: res.headers.get("www-authenticate") ? "present" : "absent",
    contentType: res.headers.get("content-type"),
    bodySample: body.slice(0, 80).replace(/\s+/g, " "),
  };
}

const ownerQa = process.env.PHASE2_NETLIFY_OWNER_QA_SMOKE_URL;
const prPreview = process.env.PHASE2_PR98_DEPLOY_PREVIEW_URL ?? "https://deploy-preview-98--624voice.netlify.app";
if (!ownerQa) {
  console.error("PHASE2_NETLIFY_OWNER_QA_SMOKE_URL required");
  process.exit(1);
}

const { user, pass } = loadCreds();
const goodAuth = Buffer.from(`${user}:${pass}`).toString("base64");
const badAuth = Buffer.from("wrong:wrong").toString("base64");

const results: Record<string, unknown>[] = [];

for (const [name, base] of [
  ["owner-qa", ownerQa],
  ["pr98-deploy-preview", prPreview],
] as const) {
  results.push(await probe(`${name}-anonymous-root`, base, "/"));
  results.push(await probe(`${name}-anonymous-health`, base, "/api/health"));
  results.push(await probe(`${name}-wrong-creds-root`, base, "/", { headers: { Authorization: `Basic ${badAuth}` } }));
  results.push(
    await probe(`${name}-good-creds-root`, base, "/", { headers: { Authorization: `Basic ${goodAuth}` } }),
  );
  results.push(
    await probe(`${name}-good-creds-health`, base, "/api/health", {
      headers: { Authorization: `Basic ${goodAuth}` },
    }),
  );
}

console.log(JSON.stringify({ results }, null, 2));

const bad = results.filter((r) => {
  const label = String(r.label);
  if (label.includes("anonymous") || label.includes("wrong-creds")) {
    return r.status === 200 && String(r.contentType ?? "").includes("text/html");
  }
  if (label.includes("good-creds-root")) {
    return r.status !== 200;
  }
  if (label.includes("good-creds-health")) {
    const sample = String(r.bodySample ?? "");
    return r.status !== 200 || !sample.includes("gitCommitSha");
  }
  return false;
});
if (bad.length > 0) process.exit(1);
