/**
 * Automated supplement: BP1/BP2 native SELECT keyboard models.
 */
import { describe, expect, test } from "bun:test";
import {
  buildAssessmentBrowserServer,
  ensureAssessmentBrowserBuild,
  launchAssessmentBrowser,
  stopAssessmentBrowserServer,
  stopRedisStub,
  waitForServer,
} from "../../src/browser-journey/assessmentBrowserJourneySupport";
import { FLEET_SIZE_LABELS } from "../../src/lib/lead/validateLead";
import { formatFocusDescriptor, readFocused } from "./ownerFocusOrderSupport";

const BP2_SAMPLE_FLEET_LABEL = FLEET_SIZE_LABELS["3-7"];

async function clickContinue(page: import("puppeteer-core").Page): Promise<void> {
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const match = buttons.find((b) => /^Continue$/i.test(b.textContent?.trim() ?? ""));
    match?.click();
  });
}

describe("BP1/BP2 keyboard model supplement", () => {
  test("X-SAFE-PREVIEW-FOCUS-04: BP1 and BP2 are native SELECT controls with ArrowDown+Tab model", async () => {
    await ensureAssessmentBrowserBuild();
    buildAssessmentBrowserServer({ safeBackend: true });
    await waitForServer("http://127.0.0.1:3000/assessment");

    const browser = await launchAssessmentBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    try {
      await page.goto("http://127.0.0.1:3000/assessment", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#assessment-bp1");

      const bp1Meta = await page.evaluate(() => {
        const el = document.querySelector("#assessment-bp1") as HTMLSelectElement | null;
        return {
          tag: el?.tagName ?? null,
          options: Array.from(el?.options ?? []).map((o) => o.text.trim()),
        };
      });
      expect(bp1Meta.tag).toBe("SELECT");
      expect(bp1Meta.options.some((o) => /HVAC|Plumb/i.test(o))).toBe(true);

      await page.select("#assessment-bp1", "HVAC");
      await clickContinue(page);
      await page.waitForSelector("#assessment-bp2", { timeout: 10000 });

      const bp2Meta = await page.evaluate(() => {
        const el = document.querySelector("#assessment-bp2") as HTMLSelectElement | null;
        return {
          tag: el?.tagName ?? null,
          options: Array.from(el?.options ?? []).map((o) => o.text.trim()),
        };
      });
      expect(bp2Meta.tag).toBe("SELECT");
      expect(bp2Meta.options).toContain(BP2_SAMPLE_FLEET_LABEL);

      await page.click("#assessment-bp2");
      const bp2Trace: Array<{ key: string; focus: string; value?: string }> = [];
      bp2Trace.push({ key: "(on BP2 select)", focus: formatFocusDescriptor(await readFocused(page)) });
      for (const key of ["ArrowDown", "ArrowDown", "Tab"] as const) {
        await page.keyboard.press(key);
        await new Promise((r) => setTimeout(r, 200));
        bp2Trace.push({
          key,
          focus: formatFocusDescriptor(await readFocused(page)),
          value: await page.$eval(
            "#assessment-bp2",
            (el) => (el as HTMLSelectElement).value,
          ),
        });
      }
      expect(bp2Trace.some((t) => t.value === "3-7")).toBe(true);
    } finally {
      await browser.close();
      stopAssessmentBrowserServer();
      await stopRedisStub();
    }
  }, 120000);
});
