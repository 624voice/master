/**
 * Capture 1280px and 375px screenshots for polish evidence.
 */
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const base =
  process.env.POLISH_SCREENSHOT_BASE?.replace(/\/$/, "") ??
  "http://127.0.0.1:4173";
const outDir = "/opt/cursor/artifacts/website-polish-screenshots";
mkdirSync(outDir, { recursive: true });

const desktopRoutes = [
  "/",
  "/what-we-do",
  "/how-we-work",
  "/demo",
  "/assessment",
  "/about",
  "/contact",
  "/book",
  "/roi-calculator",
  "/does-not-exist-404",
];

const mobileRoutes = ["/", "/what-we-do", "/assessment", "/contact", "/book"];

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();

for (const route of desktopRoutes) {
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}${route}`, { waitUntil: "networkidle2", timeout: 120_000 });
  const slug = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "-");
  await page.screenshot({
    path: `${outDir}/desktop-1280-${slug}.png`,
    fullPage: true,
  });
}

for (const route of mobileRoutes) {
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(`${base}${route}`, { waitUntil: "networkidle2", timeout: 120_000 });
  const slug = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "-");
  await page.screenshot({
    path: `${outDir}/mobile-375-${slug}.png`,
    fullPage: true,
  });
}

await browser.close();
console.log(JSON.stringify({ ok: true, outDir, desktop: desktopRoutes.length, mobile: mobileRoutes.length }));
