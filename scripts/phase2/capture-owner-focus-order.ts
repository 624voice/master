/**
 * Captures deterministic Tab focus sequences for owner keyboard walkthrough.
 * Automation supplement only — does not satisfy A11Y-090 human attestation.
 *
 * Run: bun run scripts/phase2/capture-owner-focus-order.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "puppeteer-core";
import {
  buildAssessmentBrowserServer,
  ensureAssessmentBrowserBuild,
  launchAssessmentBrowser,
  stopAssessmentBrowserServer,
  stopRedisStub,
  waitForServer,
} from "../../src/browser-journey/assessmentBrowserJourneySupport";
import {
  captureTabSequence,
  formatFocusDescriptor,
  readFocused,
  resetFocusFromPageLoad,
  type FocusDescriptor,
} from "./ownerFocusOrderSupport";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(REPO_ROOT, "review-artifacts/phase2/owner-focus-order-sequences.json");
const BASE = "http://127.0.0.1:3000";

type RouteCapture = {
  path: string;
  viewport: { width: number; height: number };
  resetAfterLoad: FocusDescriptor;
  tabSequence: FocusDescriptor[];
  formatted: string[];
};

const captures: RouteCapture[] = [];

async function captureRoute(
  page: Page,
  path: string,
  viewport: { width: number; height: number },
  tabCount: number,
): Promise<void> {
  await page.setViewport(viewport);
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 300));
  const resetAfterLoad = await resetFocusFromPageLoad(page);
  const tabSequence = await captureTabSequence(page, tabCount);
  captures.push({
    path,
    viewport,
    resetAfterLoad,
    tabSequence,
    formatted: [formatFocusDescriptor(resetAfterLoad), ...tabSequence.map(formatFocusDescriptor)],
  });
}

async function main(): Promise<void> {
  await ensureAssessmentBrowserBuild();
  buildAssessmentBrowserServer({ safeBackend: true });
  await waitForServer(`${BASE}/assessment`);

  const browser = await launchAssessmentBrowser();
  const page = await browser.newPage();

  try {
    const desktop = { width: 1280, height: 900 };
    const mobile = { width: 375, height: 800 };

    await captureRoute(page, "/", desktop, 12);
    await captureRoute(page, "/what-we-do", desktop, 10);
    await captureRoute(page, "/how-we-work", desktop, 10);
    await captureRoute(page, "/demo", desktop, 10);
    await captureRoute(page, "/about", desktop, 10);
    await captureRoute(page, "/contact", desktop, 14);
    await captureRoute(page, "/does-not-exist-404", desktop, 8);

    await page.setViewport(mobile);
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 300));
    const mobileReset = await resetFocusFromPageLoad(page);
    const mobileAfterMenuOpen: FocusDescriptor[] = [];
    await page.focus("header details summary");
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 200));
    mobileAfterMenuOpen.push(await readFocused(page));
    const mobileNavTabs = await captureTabSequence(page, 7);
    captures.push({
      path: "/ (mobile nav open)",
      viewport: mobile,
      resetAfterLoad: mobileReset,
      tabSequence: mobileAfterMenuOpen.concat(mobileNavTabs),
      formatted: [
        formatFocusDescriptor(mobileReset),
        "Enter on mobile menu summary",
        ...mobileAfterMenuOpen.concat(mobileNavTabs).map(formatFocusDescriptor),
      ],
    });

    await captureRoute(page, "/", mobile, 8);
  } finally {
    await browser.close();
    stopAssessmentBrowserServer();
    await stopRedisStub();
  }

  const desktopNav = captures.find((c) => c.path === "/" && c.viewport.width === 1280);
  const result = {
    capturedAt: new Date().toISOString(),
    resetProcedure: {
      steps: [
        "Load the stated URL in Chrome.",
        "Press Tab once (first Tab after load).",
        "Expected focus: 624 Voice header link (logo/home link).",
      ],
      firstTabFocus: desktopNav?.resetAfterLoad ?? null,
    },
    desktopNavFrom624Voice: desktopNav
      ? {
          tabCountToAbout: 5,
          tabCountToBookConsultation: 6,
          sequence: desktopNav.tabSequence.slice(0, 6).map(formatFocusDescriptor),
        }
      : null,
    captures,
  };

  mkdirSync(join(REPO_ROOT, "review-artifacts/phase2"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ out: OUT, routes: captures.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
