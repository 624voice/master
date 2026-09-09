import type { ReportViewModel } from "~/lib/report/types";
import { renderReportHtml } from "~/server/report/renderReportHtml.server";

export type RenderTimingBreakdown = {
  mode: "cold" | "warm";
  runtimeInitMs: number;
  chromiumPrepMs: number;
  browserLaunchMs: number;
  htmlRenderMs: number;
  pageLoadMs: number;
  fontReadyMs: number;
  pdfRenderMs: number;
  handlerTotalMs: number;
  pdfBytes: number;
  pageCount: number;
};

let warmBrowser: Awaited<ReturnType<typeof import("puppeteer-core").default.launch>> | null =
  null;

async function importRendererModules() {
  const [puppeteer, chromium] = await Promise.all([
    import("puppeteer-core"),
    import("@sparticuz/chromium"),
  ]);
  return { puppeteer: puppeteer.default, chromium: chromium.default };
}

async function launchReportBrowser(
  puppeteer: Awaited<ReturnType<typeof importRendererModules>>["puppeteer"],
  chromium: Awaited<ReturnType<typeof importRendererModules>>["chromium"],
) {
  const executablePath = await chromium.executablePath();
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 1 },
    executablePath,
    headless: true,
  });
}

export async function closeReportBrowser(): Promise<void> {
  if (warmBrowser) {
    await warmBrowser.close().catch(() => undefined);
    warmBrowser = null;
  }
}

/** Lightweight Chromium prep only — for A1 warming experiments. No PDF output. */
export async function prepareChromiumOnly(): Promise<{ chromiumPrepMs: number }> {
  const started = performance.now();
  const { chromium } = await importRendererModules();
  await chromium.executablePath();
  return { chromiumPrepMs: Math.round(performance.now() - started) };
}

export async function renderReportPdf(
  model: ReportViewModel,
  options?: { mode?: "cold" | "warm"; collectTiming?: boolean },
): Promise<{ pdf: Uint8Array; timing?: RenderTimingBreakdown }> {
  const mode = options?.mode ?? "warm";
  const collectTiming = options?.collectTiming ?? false;
  const handlerStarted = performance.now();
  const timing: Partial<RenderTimingBreakdown> = { mode };

  const runtimeInitStarted = performance.now();
  const { puppeteer, chromium } = await importRendererModules();
  timing.runtimeInitMs = Math.round(performance.now() - runtimeInitStarted);

  const chromiumPrepStarted = performance.now();
  await chromium.executablePath();
  timing.chromiumPrepMs = Math.round(performance.now() - chromiumPrepStarted);

  let browser = warmBrowser;
  const browserLaunchStarted = performance.now();
  if (mode === "cold" || !browser) {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
    browser = await launchReportBrowser(puppeteer, chromium);
    if (mode === "warm") {
      warmBrowser = browser;
    }
  }
  timing.browserLaunchMs = Math.round(performance.now() - browserLaunchStarted);

  const htmlRenderStarted = performance.now();
  const html = renderReportHtml(model);
  timing.htmlRenderMs = Math.round(performance.now() - htmlRenderStarted);

  const page = await browser.newPage();

  const pageLoadStarted = performance.now();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.emulateMediaType("print");
  timing.pageLoadMs = Math.round(performance.now() - pageLoadStarted);

  const fontReadyStarted = performance.now();
  await page.evaluateHandle("document.fonts.ready");
  timing.fontReadyMs = Math.round(performance.now() - fontReadyStarted);

  const pdfRenderStarted = performance.now();
  const pdfBuffer = await page.pdf({
    format: "letter",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  timing.pdfRenderMs = Math.round(performance.now() - pdfRenderStarted);

  await page.close();

  if (mode === "cold") {
    await browser.close().catch(() => undefined);
    warmBrowser = null;
  }

  const pdf = new Uint8Array(pdfBuffer);
  const pdfDoc = await (await import("pdf-lib")).PDFDocument.load(pdf);
  timing.handlerTotalMs = Math.round(performance.now() - handlerStarted);
  timing.pdfBytes = pdf.byteLength;
  timing.pageCount = pdfDoc.getPageCount();

  return {
    pdf,
    timing: collectTiming ? (timing as RenderTimingBreakdown) : undefined,
  };
}
