/**
 * Automated focus-order supplement for owner keyboard walkthrough (A11Y-090).
 * Does NOT replace physical keyboard attestation by Chris.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
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
  resetFocusFromPageLoad,
} from "./ownerFocusOrderSupport";

const REPO_ROOT = join(import.meta.dir, "../..");
const SEQUENCES_PATH = join(REPO_ROOT, "review-artifacts/phase2/owner-focus-order-sequences.json");
const BASE = "http://127.0.0.1:3000";

function loadExpected(): {
  desktopNavFrom624Voice: { tabCountToAbout: number; sequence: string[] };
} {
  if (!existsSync(SEQUENCES_PATH)) {
    throw new Error(`Missing ${SEQUENCES_PATH}. Run capture-owner-focus-order.ts first.`);
  }
  return JSON.parse(readFileSync(SEQUENCES_PATH, "utf8"));
}

describe("owner focus order supplement (not human A11Y-090)", () => {
  test("X-SAFE-PREVIEW-FOCUS-01: desktop nav Tab count to About equals 5 from 624 Voice", async () => {
    await ensureAssessmentBrowserBuild();
    buildAssessmentBrowserServer({ safeBackend: true });
    await waitForServer(`${BASE}/`);

    const browser = await launchAssessmentBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
      const first = await resetFocusFromPageLoad(page);
      expect(formatFocusDescriptor(first)).toMatch(/624 Voice/i);

      const tabs = await captureTabSequence(page, 6);
      const formatted = tabs.map(formatFocusDescriptor);
      expect(formatted[4]).toMatch(/About/i);
      expect(formatted[5]).toMatch(/Book Your AI Growth Systems Consultation/i);

      const expected = loadExpected();
      expect(expected.desktopNavFrom624Voice.tabCountToAbout).toBe(5);
    } finally {
      await browser.close();
      stopAssessmentBrowserServer();
      await stopRedisStub();
    }
  }, 120000);
});
