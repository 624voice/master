#!/usr/bin/env node
/**
 * A1/A2 measurement helper for V2 report on a Netlify deploy preview.
 *
 * Usage:
 *   node scripts/measure-v2-report-netlify.mjs https://deploy-preview-96--624voice.netlify.app
 *
 * Requires ROI_REPORT_PREVIEW_ENABLED=true on the target deploy.
 */
const baseUrl = process.argv[2]?.replace(/\/$/, "");
if (!baseUrl) {
  console.error("Usage: node scripts/measure-v2-report-netlify.mjs <deploy-preview-url>");
  process.exit(1);
}

async function timedFetch(path, init) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, init);
  const ttfbMs = Math.round(performance.now() - started);
  const body = await response.text();
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    json = { raw: body.slice(0, 500) };
  }
  return { status: response.status, ttfbMs, json, headers: Object.fromEntries(response.headers) };
}

async function measureTiming(mode) {
  return timedFetch(`/api/dev/report-timing?mode=${mode}&action=render`);
}

async function measureChromiumPrep(mode) {
  return timedFetch(`/api/dev/report-timing?mode=${mode}&action=prepare-chromium`);
}

async function main() {
  console.log(`\n=== V2 report measurements @ ${baseUrl} ===\n`);

  const cold = await measureTiming("cold");
  console.log("COLD render timing endpoint:");
  console.log(JSON.stringify({ status: cold.status, ttfbMs: cold.ttfbMs, ...cold.json }, null, 2));

  const warm = await measureTiming("warm");
  console.log("\nWARM render timing endpoint:");
  console.log(JSON.stringify({ status: warm.status, ttfbMs: warm.ttfbMs, ...warm.json }, null, 2));

  const coldPrep = await measureChromiumPrep("cold");
  console.log("\nCOLD chromium prep only:");
  console.log(JSON.stringify({ status: coldPrep.status, ttfbMs: coldPrep.ttfbMs, ...coldPrep.json }, null, 2));

  const warmPrep = await measureChromiumPrep("warm");
  console.log("\nWARM chromium prep only:");
  console.log(JSON.stringify({ status: warmPrep.status, ttfbMs: warmPrep.ttfbMs, ...warmPrep.json }, null, 2));

  console.log("\n=== A1 warmer experiment (chromium prep then immediate render) ===\n");
  const prepBeforeRender = await measureChromiumPrep("cold");
  const renderAfterPrep = await measureTiming("cold");
  console.log(
    JSON.stringify(
      {
        prepBeforeRenderMs: chromiumPrepMs(prepBeforeRender),
        renderAfterPrepTtfbMs: renderAfterPrep.ttfbMs,
        renderAfterPrepTiming: renderAfterPrep.json.timing ?? renderAfterPrep.json,
      },
      null,
      2,
    ),
  );
}

function chromiumPrepMs(result) {
  return result.json.chromiumPrepMs ?? result.ttfbMs;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
