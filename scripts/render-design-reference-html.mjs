#!/usr/bin/env bun
/**
 * Rasterize the v3 design-reference HTML pages for visual QA.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] ?? join(process.cwd(), "artifacts/report-qa-i8");
mkdirSync(outDir, { recursive: true });

const htmlPath = join(process.cwd(), "design-reference/Revenue Report.dc.html");
const logoSrc = join(process.cwd(), "design-reference/uploads/logo_option2_slate_green_ring.png");
const logoDest = join(outDir, "reference-logo.png");
copyFileSync(logoSrc, logoDest);

const fontDir = join(process.cwd(), "public/fonts/inter");
const fontCss = [400, 500, 600, 700, 800]
  .map((weight) => {
    const file =
      weight === 400
        ? "Inter-Regular.woff2"
        : weight === 500
          ? "Inter-Medium.woff2"
          : weight === 600
            ? "Inter-SemiBold.woff2"
            : weight === 700
              ? "Inter-Bold.woff2"
              : "Inter-ExtraBold.woff2";
    return `@font-face{font-family:'Inter';font-style:normal;font-weight:${weight};font-display:block;src:url('file://${join(fontDir, file)}') format('woff2')}`;
  })
  .join("\n");

let body = readFileSync(htmlPath, "utf8");
const bodyStart = body.indexOf("<body>");
const bodyEnd = body.lastIndexOf("</body>");
body = body.slice(bodyStart + 6, bodyEnd);
body = body
  .replace(/<x-dc>|<\/x-dc>|<helmet>|<\/helmet>|<doc-page>|<\/doc-page>/gi, "")
  .replace(/<script[^>]*><\/script>/gi, "")
  .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, "")
  .replace(/uploads\/logo_option2_slate_green_ring\.png/g, "reference-logo.png")
  .replace(/font-weight:900/g, "font-weight:800")
  .replace(
    /<div style="font-size:30px;font-weight:800;color:#edf1f5;line-height:1;margin-bottom:5px">04<\/div>\s*<h2 style="font-size:18px;font-weight:800;color:#0d1e2c;margin:0;letter-spacing:-0.01em">How your numbers were calculated<\/h2>/,
    `<div style="font-size:30px;font-weight:800;color:#edf1f5;line-height:1;margin-bottom:5px">03</div><h2 style="font-size:18px;font-weight:800;color:#0d1e2c;margin:0;letter-spacing:-0.01em">How your numbers were calculated</h2>`,
  )
  .replace(
    /<div style="font-size:30px;font-weight:800;color:#edf1f5;line-height:1;margin-bottom:5px">05<\/div>\s*<h2 style="font-size:18px;font-weight:800;color:#0d1e2c;margin:0;letter-spacing:-0.01em">What happens next…<\/h2>/,
    `<div style="font-size:30px;font-weight:800;color:#edf1f5;line-height:1;margin-bottom:5px">04</div><h2 style="font-size:18px;font-weight:800;color:#0d1e2c;margin:0;letter-spacing:-0.01em">What happens next...</h2>`,
  );

const htmlOut = join(outDir, "reference-render.html");
writeFileSync(
  htmlOut,
  `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${fontCss}
*,*::before,*::after{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Inter',system-ui,sans-serif;margin:0}
.page{width:8.5in;height:11in;page-break-after:always;overflow:hidden}
</style></head><body>${body}</body></html>`,
);

const puppeteer = await import("puppeteer-core");
const chromium = await import("@sparticuz/chromium");
const browser = await puppeteer.default.launch({
  args: chromium.default.args,
  executablePath: await chromium.default.executablePath(),
  headless: true,
  defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 2 },
});

const page = await browser.newPage();
await page.goto(`file://${htmlOut}`, { waitUntil: "networkidle0" });
await page.emulateMediaType("print");
await page.evaluateHandle("document.fonts.ready");

const pages = await page.$$("section.page");
for (let i = 0; i < pages.length; i++) {
  const png = await pages[i].screenshot({ type: "png" });
  writeFileSync(join(outDir, `gold-${String(i + 1).padStart(2, "0")}.png`), png);
}

await browser.close();
console.log(`Rendered ${pages.length} reference pages to ${outDir}`);
