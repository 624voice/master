/**
 * Render the real AssessmentResults component with deterministic runAssessment
 * fixture output (no lead submit, no SMS, no external workflows).
 */
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import puppeteer from "puppeteer-core";
import { AssessmentResults } from "~/components/assessment/AssessmentResults";
import { runAssessment } from "~/lib/assessment/runAssessment";

const outDir = join(import.meta.dir, "../../review-artifacts/phase2/website-polish/screenshots");
mkdirSync(outDir, { recursive: true });

const fixtureAnswers = {
  trade: "HVAC" as const,
  fleetSize: "50+" as const,
  BP1: "HVAC",
  BP2: "50+",
  "GF-S": 2,
  "GF-F1": 1,
  "GF-F2": 2,
  "GF-F3": 0,
  "CV-S": 1,
  "CV-F1": "not_sure",
  "RG-S": 0,
  "RM-S": 3,
  "RM-F1": 2,
  "RM-F2": 2,
  "RM-F3": 2,
  "MI-S": 2,
  "MI-F1": 0,
  "MI-F2": 1,
  "MI-F3": 2,
};

const results = runAssessment(fixtureAnswers);
const markup = renderToStaticMarkup(
  <div className="bg-brand-accent-light px-6 py-16">
    <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <AssessmentResults results={results} />
    </div>
  </div>,
);

const cssDir = join(import.meta.dir, "../../dist/client/assets");
const appCss = readdirSync(cssDir).find((f) => f.startsWith("app-") && f.endsWith(".css"));
if (!appCss) throw new Error("Missing built app.css in dist/client/assets");

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><link rel="stylesheet" href="file://${join(cssDir, appCss)}"/></head><body class="pt-20">${markup}</body></html>`;

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.setContent(html, { waitUntil: "networkidle0" });
await page.screenshot({ path: join(outDir, "assessment-results-1280.png"), fullPage: true });
await browser.close();

console.log(
  JSON.stringify({
    ok: true,
    method: "react-dom/server AssessmentResults + runAssessment fixture",
    fixture: { trade: "HVAC", fleetSize: "50+" },
    out: "assessment-results-1280.png",
  }),
);
