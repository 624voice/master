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
  bodySample: string,
  rowUrl: string,
  canonical: string,
): string {
  if (status === 503 && bodySample.includes("authentication is not configured")) {
    return "fail-closed because of missing configuration";
  }
  if (status === 404) return "deleted or 404";
  if (label.includes("deleted")) return status === 404 ? "deleted or 404" : "unexpected_live";
  const canonicalBase = canonical.replace(/\/$/, "");
  if (rowUrl.replace(/\/$/, "").startsWith(canonicalBase)) {
    if (status === 200 && !wwwAuth) return "current authorized open owner-QA deployment";
    if (status === 401 && wwwAuth) return "protected";
  }
  if (label.includes("pr98") || rowUrl.includes("deploy-preview-98")) {
    if (status === 401 && wwwAuth) return "protected";
  }
  if (status === 401 && wwwAuth) return "protected";
  if (status === 200 && !wwwAuth) return "superseded and still anonymously accessible";
  return "unclassified";
}

function urlMatches(canonical: string, label: string): boolean {
  return label.includes("canonical") || label.includes("owner-qa");
}

const canonical =
  process.env.OWNER_QA_URL ?? "https://6ac567c4268f3b2f994edf33--624voice-phase2-owner-qa.netlify.app";
const pr98 = process.env.PR98_URL ?? "https://deploy-preview-98--624voice.netlify.app";

const prior = JSON.parse(readFileSync(IN, "utf8")) as { results?: Row[]; audited?: Row[] };
const unique = new Map<string, Row>();
for (const r of prior.audited ?? prior.results ?? []) {
  unique.set(`${r.url}${r.path}`, { label: r.label, url: r.url, path: r.path });
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
    classification: classify(
      row.label,
      live.status,
      live.wwwAuthenticate,
      live.bodySample,
      row.url,
      canonical,
    ),
  });
}

const conclusions = {
  supersededOwnerQaServesApplicationAnonymously:
    audited.filter(
      (r) =>
        r.classification === "superseded and still anonymously accessible" &&
        r.path === "/" &&
        !r.url.includes(canonical.replace(/\/$/, "")),
    ).length > 0,
  anySurfaceOtherThanCurrentOwnerQaServesAnonymously:
    audited.filter(
      (r) => r.path === "/" && r.classification === "superseded and still anonymously accessible",
    ).length > 0,
};

writeFileSync(
  OUT,
  JSON.stringify(
    {
      auditedAt: new Date().toISOString(),
      canonicalOwnerQa: canonical,
      pr98,
      taxonomy: [
        "current authorized open owner-QA deployment",
        "protected",
        "deleted or 404",
        "fail-closed because of missing configuration",
        "superseded and still anonymously accessible",
      ],
      inventoryConclusion: {
        supersededOwnerQaUrlServesApplicationAnonymously: conclusions.supersededOwnerQaServesApplicationAnonymously,
        anyNonCurrentSurfaceServesApplicationAnonymously:
          conclusions.anySurfaceOtherThanCurrentOwnerQaServesAnonymously,
        narrative:
          conclusions.anySurfaceOtherThanCurrentOwnerQaServesAnonymously === false
            ? "No audited URL other than the current authorized owner-QA deployment returned anonymous HTTP 200 HTML for / at audit time."
            : "At least one non-current URL returned anonymous HTTP 200 for /; see row classifications.",
      },
      audited,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ ok: true, out: OUT, count: audited.length }));
