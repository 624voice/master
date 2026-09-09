/**
 * Phase 0 throwaway spike — server-only PDF renderer feasibility gate.
 * Dynamic imports keep puppeteer/chromium out of eager client bundles.
 */
import { buildSpikeHtml } from "~/server/report/spike/spikeHtml";

export type SpikeRenderMetrics = {
  packaging: "sparticuz-chromium-full";
  launchMs: number;
  renderMs: number;
  totalMs: number;
  pdfBytes: number;
  pageCount: number;
};

let warmBrowser: Awaited<ReturnType<typeof launchSpikeBrowser>> | null = null;

async function launchSpikeBrowser() {
  const puppeteer = await import("puppeteer-core");
  const chromium = await import("@sparticuz/chromium");

  const executablePath = await chromium.default.executablePath();

  const browser = await puppeteer.default.launch({
    args: chromium.default.args,
    defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 1 },
    executablePath,
    headless: true,
  });

  return { browser, puppeteer: puppeteer.default };
}

async function getBrowser(mode: "cold" | "warm") {
  if (mode === "warm" && warmBrowser) {
    return warmBrowser;
  }

  if (mode === "cold" && warmBrowser) {
    await warmBrowser.browser.close().catch(() => undefined);
    warmBrowser = null;
  }

  const launched = await launchSpikeBrowser();
  warmBrowser = launched;
  return launched;
}

export async function renderSpikePdf(options?: {
  mode?: "cold" | "warm";
}): Promise<{ pdf: Uint8Array; metrics: SpikeRenderMetrics }> {
  const mode = options?.mode ?? "warm";
  const started = performance.now();

  const launchStarted = performance.now();
  const { browser, puppeteer } = await getBrowser(mode);
  const launchMs = performance.now() - launchStarted;

  const renderStarted = performance.now();
  const page = await browser.newPage();
  const html = buildSpikeHtml();

  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.emulateMediaType("print");

  const pdfBuffer = await page.pdf({
    format: "letter",
    printBackground: true,
    margin: { top: "0.75in", right: "0.75in", bottom: "0.75in", left: "0.75in" },
  });

  await page.close();

  const renderMs = performance.now() - renderStarted;
  const totalMs = performance.now() - started;

  const pdf = new Uint8Array(pdfBuffer);
  const pdfDoc = await (await import("pdf-lib")).PDFDocument.load(pdf);

  return {
    pdf,
    metrics: {
      packaging: "sparticuz-chromium-full",
      launchMs: Math.round(launchMs),
      renderMs: Math.round(renderMs),
      totalMs: Math.round(totalMs),
      pdfBytes: pdf.byteLength,
      pageCount: pdfDoc.getPageCount(),
    },
  };
}

export async function closeSpikeBrowser(): Promise<void> {
  if (warmBrowser) {
    await warmBrowser.browser.close().catch(() => undefined);
    warmBrowser = null;
  }
}

/** Guard for accidental client imports during build analysis. */
export function assertServerOnlySpike(): true {
  return typeof window === "undefined";
}

void assertServerOnlySpike();
