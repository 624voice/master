/**
 * Owner-accessible brand color comparison PNG under review-artifacts/phase2/website-polish/
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const outDir = join(import.meta.dir, "../../review-artifacts/phase2/website-polish");
mkdirSync(outDir, { recursive: true });

const htmlPath = join(outDir, "brand-color-comparison.html");
const pngPath = join(outDir, "brand-color-comparison.png");

writeFileSync(
  htmlPath,
  `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><style>
  body{font-family:Inter,sans-serif;margin:24px;background:#f8fafc;color:#0f172a}
  h1{font-size:20px;margin:0 0 16px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  .swatch{border-radius:12px;padding:16px;border:1px solid #e2e8f0;background:#fff}
  .chip{height:48px;border-radius:8px;margin-bottom:8px}
  .label{font-size:13px;font-weight:600}
  .hex{font-size:12px;color:#64748b;font-family:monospace}
  .navy{background:#0f172a;padding:20px;border-radius:12px;margin-top:16px}
  .btn{display:inline-block;padding:12px 20px;border-radius:10px;font-weight:600;margin:8px 8px 0 0}
  .card{background:linear-gradient(135deg,#fff,#ecfdf5);border:1px solid #d1fae5;padding:16px;border-radius:12px;margin-top:16px}
  .icon{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center}
</style></head><body>
<h1>624 Voice — brand green comparison (website polish)</h1>
<div class="grid">
  <div class="swatch"><div class="chip" style="background:#047857"></div><div class="label">Previous website green</div><div class="hex">#047857</div></div>
  <div class="swatch"><div class="chip" style="background:#10b880"></div><div class="label">Proposed website green</div><div class="hex">#10b880</div></div>
  <div class="swatch"><div class="chip" style="background:#1dbf9a"></div><div class="label">Report/PDF green (existing)</div><div class="hex">#1dbf9a</div></div>
</div>
<div class="swatch" style="margin-top:16px"><img src="file://${join(import.meta.dir, "../../public/logo.png")}" alt="logo" height="64"/><div class="label" style="margin-top:8px">Source logo (public/logo.png)</div></div>
<div class="navy">
  <div class="btn" style="background:#10b880;color:#fff">Primary button on navy</div>
  <div style="margin-top:12px;font-size:28px;font-weight:800;color:#fff">Headline <span style="color:#10b880">accent</span> on navy</div>
</div>
<div style="margin-top:16px;background:#fff;padding:20px;border-radius:12px;border:1px solid #e2e8f0">
  <div class="btn" style="background:#10b880;color:#fff">Primary button on white</div>
  <div class="card"><div class="icon" style="background:rgba(16,184,128,.15);color:#047857">★</div><div class="label" style="margin-top:8px">Icon/accent on light card (#10b880 / mint)</div></div>
</div>
<p style="margin-top:16px;font-size:13px;color:#475569">Report/PDF #1dbf9a is pre-existing assessment/report styling drift — not changed in this polish pass (no separate authorization).</p>
</body></html>`,
  "utf8",
);

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle2" });
await page.screenshot({ path: pngPath, fullPage: true });
await browser.close();
console.log(JSON.stringify({ htmlPath, pngPath }));
