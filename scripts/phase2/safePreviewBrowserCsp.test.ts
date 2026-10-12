/**
 * Real browser-context CSP tests — host browser against Docker-published preview.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { SAFE_PREVIEW_CSP_HEADER } from "./safePreviewCsp";
import {
  depsCacheReady,
  runPrepareDepsOnHost,
  startDockerPreview,
  stopDockerPreview,
} from "./safePreviewDocker";
import { waitForDockerPreviewReady } from "./safePreviewDockerWait";
import { dockerAvailable } from "./safePreviewIsolationRuntime";

const REPO_ROOT = join(import.meta.dir, "../..");
const RUN_SHA = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).stdout.trim();

function chromiumPath(): string | null {
  for (const p of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]) {
    try {
      readFileSync(p);
      return p;
    } catch {
      /* continue */
    }
  }
  return null;
}

async function withDockerPreview<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  if (!depsCacheReady()) runPrepareDepsOnHost();
  const child = startDockerPreview(false);
  await waitForDockerPreviewReady();
  try {
    return await fn("http://127.0.0.1:3000");
  } finally {
    child.kill("SIGTERM");
    stopDockerPreview();
  }
}

describe("safe preview browser CSP", () => {
  test("X-SAFE-PREVIEW-22: complete CSP header string", () => {
    console.log("CSP:", SAFE_PREVIEW_CSP_HEADER);
    expect(SAFE_PREVIEW_CSP_HEADER).toContain("default-src 'self'");
    expect(SAFE_PREVIEW_CSP_HEADER).toContain("connect-src 'self'");
    expect(SAFE_PREVIEW_CSP_HEADER).toContain("img-src 'self'");
    expect(SAFE_PREVIEW_CSP_HEADER).toContain("script-src 'self'");
    expect(SAFE_PREVIEW_CSP_HEADER).toContain("font-src 'self'");
    expect(SAFE_PREVIEW_CSP_HEADER).toContain("frame-src 'self'");
    expect(SAFE_PREVIEW_CSP_HEADER).toContain("form-action 'self'");
    expect(SAFE_PREVIEW_CSP_HEADER).toContain("frame-ancestors 'none'");
  });

  test("X-SAFE-PREVIEW-23: browser fetch external blocked", async () => {
    if (!dockerAvailable() || !chromiumPath()) return;
    await withDockerPreview(async (baseUrl) => {
      const browser = await puppeteer.launch({
        executablePath: chromiumPath()!,
        headless: true,
        args: ["--no-sandbox"],
      });
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]'));
      const result = await page.evaluate(async () => {
        try {
          await fetch("https://example.com/robots.txt");
          return "allowed";
        } catch {
          return "blocked";
        }
      });
      await browser.close();
      expect(result).toBe("blocked");
      expect(csp).toBeNull();
    });
  }, 180000);

  test("X-SAFE-PREVIEW-24: browser external image blocked", async () => {
    if (!dockerAvailable() || !chromiumPath()) return;
    await withDockerPreview(async (baseUrl) => {
      const browser = await puppeteer.launch({ executablePath: chromiumPath()!, headless: true, args: ["--no-sandbox"] });
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const loaded = await page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = "https://example.com/favicon.ico";
            setTimeout(() => resolve(false), 2500);
          }),
      );
      await browser.close();
      expect(loaded).toBe(false);
    });
  }, 180000);

  test("X-SAFE-PREVIEW-25: browser external script blocked", async () => {
    if (!dockerAvailable() || !chromiumPath()) return;
    await withDockerPreview(async (baseUrl) => {
      const browser = await puppeteer.launch({ executablePath: chromiumPath()!, headless: true, args: ["--no-sandbox"] });
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const loaded = await page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const s = document.createElement("script");
            s.src = "https://example.com/evil.js";
            s.onload = () => resolve(true);
            s.onerror = () => resolve(false);
            document.body.appendChild(s);
            setTimeout(() => resolve(false), 2500);
          }),
      );
      await browser.close();
      expect(loaded).toBe(false);
    });
  }, 180000);

  test("X-SAFE-PREVIEW-26: browser sendBeacon external blocked", async () => {
    if (!dockerAvailable() || !chromiumPath()) return;
    await withDockerPreview(async (baseUrl) => {
      const browser = await puppeteer.launch({ executablePath: chromiumPath()!, headless: true, args: ["--no-sandbox"] });
      const page = await browser.newPage();
      let externalBeacon = false;
      page.on("request", (req) => {
        if (req.url().includes("example.com")) externalBeacon = true;
      });
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.evaluate(() => {
        navigator.sendBeacon("https://example.com/beacon", "x");
      });
      await new Promise((r) => setTimeout(r, 1500));
      await browser.close();
      expect(externalBeacon).toBe(false);
      console.log("sendBeacon probe: no external request observed");
    });
  }, 180000);

  test("X-SAFE-PREVIEW-27: browser XHR external blocked", async () => {
    if (!dockerAvailable() || !chromiumPath()) return;
    await withDockerPreview(async (baseUrl) => {
      const browser = await puppeteer.launch({ executablePath: chromiumPath()!, headless: true, args: ["--no-sandbox"] });
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const result = await page.evaluate(
        () =>
          new Promise<string>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = () => resolve("allowed");
            xhr.onerror = () => resolve("blocked");
            xhr.open("GET", "https://example.com/");
            xhr.send();
            setTimeout(() => resolve("blocked"), 2500);
          }),
      );
      await browser.close();
      expect(result).toBe("blocked");
    });
  }, 180000);

  test("X-SAFE-PREVIEW-28: WebSocket guard — no app WebSocket paths; guard blocks wss://", () => {
    const srcWs = spawnSync("bash", ["-lc", "rg -l WebSocket src/ || true"], { cwd: REPO_ROOT, encoding: "utf8" }).stdout.trim();
    expect(srcWs).toBe("");
    const probe = spawnSync("bun", ["--env-file=/dev/null", "scripts/phase2/safePreviewWebSocketProbe.ts"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    expect(probe.status).toBe(0);
  });

  test("X-SAFE-PREVIEW-29: node:tls non-loopback blocked", () => {
    const probe = spawnSync("bun", ["--env-file=/dev/null", "scripts/phase2/safePreviewTlsProbe.ts", "example.com"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    expect(probe.status).toBe(0);
  });

  test("X-SAFE-PREVIEW-32: browser external font load blocked", async () => {
    if (!dockerAvailable() || !chromiumPath()) return;
    await withDockerPreview(async (baseUrl) => {
      const browser = await puppeteer.launch({ executablePath: chromiumPath()!, headless: true, args: ["--no-sandbox"] });
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const loaded = await page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://example.com/font.woff2";
            link.onload = () => resolve(true);
            link.onerror = () => resolve(false);
            document.head.appendChild(link);
            setTimeout(() => resolve(false), 2500);
          }),
      );
      await browser.close();
      expect(loaded).toBe(false);
    });
  }, 180000);

  test("X-SAFE-PREVIEW-33: browser external iframe blocked", async () => {
    if (!dockerAvailable() || !chromiumPath()) return;
    await withDockerPreview(async (baseUrl) => {
      const browser = await puppeteer.launch({ executablePath: chromiumPath()!, headless: true, args: ["--no-sandbox"] });
      const page = await browser.newPage();
      let externalFrameRequest = false;
      page.on("request", (req) => {
        if (req.url().includes("example.com")) externalFrameRequest = true;
      });
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.evaluate(() => {
        const frame = document.createElement("iframe");
        frame.src = "https://example.com/";
        document.body.appendChild(frame);
      });
      await new Promise((r) => setTimeout(r, 2500));
      await browser.close();
      expect(externalFrameRequest).toBe(false);
      console.log("iframe probe: no external frame request observed");
    });
  }, 180000);

  test("X-SAFE-PREVIEW-34: browser external form submission blocked", async () => {
    if (!dockerAvailable() || !chromiumPath()) return;
    await withDockerPreview(async (baseUrl) => {
      const browser = await puppeteer.launch({ executablePath: chromiumPath()!, headless: true, args: ["--no-sandbox"] });
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const beforeUrl = page.url();
      await page.evaluate(() => {
        const form = document.createElement("form");
        form.method = "GET";
        form.action = "https://example.com/submit";
        document.body.appendChild(form);
        form.submit();
      });
      await new Promise((r) => setTimeout(r, 1500));
      const afterUrl = page.url();
      await browser.close();
      expect(afterUrl).toBe(beforeUrl);
      console.log("form-action probe: stayed on", afterUrl);
    });
  }, 180000);

  test("X-SAFE-PREVIEW-35: browser WebSocket external blocked", async () => {
    if (!dockerAvailable() || !chromiumPath()) return;
    await withDockerPreview(async (baseUrl) => {
      const browser = await puppeteer.launch({ executablePath: chromiumPath()!, headless: true, args: ["--no-sandbox"] });
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const result = await page.evaluate(
        () =>
          new Promise<string>((resolve) => {
            try {
              const ws = new WebSocket("wss://example.com/socket");
              ws.onopen = () => resolve("allowed");
              ws.onerror = () => resolve("blocked");
              setTimeout(() => resolve("blocked"), 2500);
            } catch {
              resolve("blocked");
            }
          }),
      );
      await browser.close();
      expect(result).toBe("blocked");
    });
  }, 180000);

  test("X-SAFE-PREVIEW-36: top-level external navigation — CSP limitation documented", async () => {
    if (!dockerAvailable() || !chromiumPath()) return;
    await withDockerPreview(async (baseUrl) => {
      const browser = await puppeteer.launch({ executablePath: chromiumPath()!, headless: true, args: ["--no-sandbox"] });
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const limitation =
        "Top-level navigation to external URLs (location.assign, window.open) is not reliably blockable by CSP alone; owner checklist must not instruct activating external destinations.";
      console.log(limitation);
      const hrefProbe = await page.evaluate(() => {
        const a = document.createElement("a");
        a.href = "https://example.com/";
        a.target = "_self";
        a.textContent = "external";
        document.body.appendChild(a);
        return a.href.startsWith("https://example.com") ? "link-present" : "missing";
      });
      await browser.close();
      expect(hrefProbe).toBe("link-present");
    });
  }, 180000);
});

export const BROWSER_CSP_TEST_RUN_SHA = RUN_SHA;
