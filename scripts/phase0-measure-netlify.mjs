#!/usr/bin/env node
/**
 * Measure Phase 0 spike endpoints on a live Netlify deploy.
 * Usage: node scripts/phase0-measure-netlify.mjs <deploy-base-url>
 */
const base = process.argv[2];
if (!base) {
  console.error("Usage: node scripts/phase0-measure-netlify.mjs <deploy-base-url>");
  process.exit(1);
}

async function measure(label, path) {
  const url = `${base}${path}`;
  const started = performance.now();
  const res = await fetch(url, { redirect: "follow" });
  const ttfbMs = performance.now() - started;
  const body = await res.arrayBuffer();
  const totalMs = performance.now() - started;

  let json = null;
  try {
    json = JSON.parse(new TextDecoder().decode(body));
  } catch {
    // pdf response
  }

  return {
    label,
    url,
    status: res.status,
    ok: res.ok,
    ttfbMs: Math.round(ttfbMs),
    totalMs: Math.round(totalMs),
    contentType: res.headers.get("content-type"),
    handlerMs: res.headers.get("x-spike-handler-ms"),
    spikeTotalMs: res.headers.get("x-spike-total-ms"),
    pdfBytes: json ? json.metrics?.pdfBytes : body.byteLength,
    pageCount: json?.metrics?.pageCount,
    launchMs: json?.metrics?.launchMs,
    renderMs: json?.metrics?.renderMs,
    metrics: json?.metrics,
    error: json?.error,
  };
}

const tests = [
  ["generate cold (function likely cold on 1st site request)", "/api/dev/pdf-spike/generate?format=json&mode=cold"],
  ["generate warm", "/api/dev/pdf-spike/generate?format=json&mode=warm"],
  ["report warm browser after generate", "/api/dev/pdf-spike/report?format=json&mode=warm"],
  ["report cold browser", "/api/dev/pdf-spike/report?format=json&mode=cold"],
];

const results = [];
for (const [label, path] of tests) {
  results.push({ ...(await measure(label, path)) });
}

console.log(JSON.stringify({ base, measuredAt: new Date().toISOString(), results }, null, 2));
