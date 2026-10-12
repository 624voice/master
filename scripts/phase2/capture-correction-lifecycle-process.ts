import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const base = process.env.SCREENSHOT_BASE?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";
const outDir = "/opt/cursor/artifacts/owner-qa-correction-round";
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.goto(`${base}/`, { waitUntil: "networkidle2", timeout: 120_000 });

for (const [name, width] of [
  ["desktop", 1280],
  ["mobile", 375],
] as const) {
  await page.setViewport({ width, height: 900 });
  await page.goto(`${base}/`, { waitUntil: "networkidle2", timeout: 120_000 });

  const lifecycle = await page.$("section:nth-of-type(5)");
  if (lifecycle) {
    await lifecycle.screenshot({
      path: `${outDir}/${name}-home-lifecycle-section.png`,
    });
  }

  const process = await page.$("section:nth-of-type(6)");
  if (process) {
    await process.screenshot({
      path: `${outDir}/${name}-home-process-section.png`,
    });
  }
}

await page.setViewport({ width: 1280, height: 900 });
await page.goto(`${base}/what-we-do`, { waitUntil: "networkidle2", timeout: 120_000 });
const diagram = await page.$("figure");
if (diagram) {
  await diagram.screenshot({ path: `${outDir}/desktop-what-we-do-lifecycle-diagram.png` });
}

await browser.close();
console.log(JSON.stringify({ ok: true, outDir }));
