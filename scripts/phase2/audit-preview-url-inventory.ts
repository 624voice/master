/**
 * Live audit of every owner-QA / PR preview URL recorded in preview-url-inventory.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const IN = join(import.meta.dir, "../../review-artifacts/phase2/website-polish/preview-url-inventory.json");
const OUT = join(import.meta.dir, "../../review-artifacts/phase2/website-polish/preview-url-inventory-live.json");

type Row = {
  label: string;
  url: string;
  path: string;
};

async function probe(base: string, path: string) {
  const url = `${base.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, { redirect: "manual" });
  const body = (await res.text()).slice(0, 120);
  return {
    url,
    status: res.status,
    wwwAuthenticate: res.headers.get("www-authenticate"),
    xRobotsTag: res.headers.get("x-robots-tag"),
    contentType: res.headers.get("content-type"),
    bodySample: body.replace(/\s+/g, " ").trim(),
  };
}

function classify(
  label: string,
  status: number,
  wwwAuth: string | null,
  canonical: string,
): string {
  if (status === 404) return "deleted_or_404";
  if (label.includes("deleted")) return status === 404 ? "deleted_or_404" : "unexpected_live";
  if (urlMatches(canonical, label)) {
    if (status === 200 && !wwwAuth) return "current_authorized_owner_qa_open";
    if (status === 401 && wwwAuth) return "fail_closed_protected";
  }
  if (status === 401 && wwwAuth) return "superseded_but_protected";
  if (status === 200 && !wwwAuth) return "superseded_and_anonymously_accessible";
  return "unknown";
}

function urlMatches(canonical: string, label: string): boolean {
  return label.includes("canonical") || label.includes("owner-qa");
}

const canonical =
  process.env.OWNER_QA_URL ?? "https://6ac567c4268f3b2f994edf33--624voice-phase2-owner-qa.netlify.app";
const pr98 = process.env.PR98_URL ?? "https://deploy-preview-98--624voice.netlify.app";

const prior = JSON.parse(readFileSync(IN, "utf8")) as { results: Row[] };
const unique = new Map<string, Row>();
for (const r of prior.results) {
  unique.set(`${r.url}${r.path}`, r);
}
unique.set(`${pr98}/`, { label: "pr98-deploy-preview", url: pr98, path: "/" });
unique.set(`${pr98}/api/health`, { label: "pr98-deploy-preview", url: pr98, path: "/api/health" });
unique.set(`${canonical}/`, { label: "canonical-owner-qa-current", url: canonical, path: "/" });
unique.set(`${canonical}/api/health`, {
  label: "canonical-owner-qa-current",
  url: canonical,
  path: "/api/health",
});

const audited = [];
for (const row of unique.values()) {
  const live = await probe(row.url, row.path);
  audited.push({
    ...row,
    live,
    classification: classify(row.label, live.status, live.wwwAuthenticate, canonical),
  });
}

writeFileSync(
  OUT,
  JSON.stringify({ auditedAt: new Date().toISOString(), canonicalOwnerQa: canonical, pr98, audited }, null, 2),
);
console.log(JSON.stringify({ ok: true, out: OUT, count: audited.length }));
