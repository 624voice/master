/**
 * Automated supplement: Assessment choice control keyboard model.
 * Does NOT replace Chris physical keyboard QA (A11Y-090).
 */
import { describe, expect, test } from "bun:test";
import {
  advanceThroughUniversalSteps,
  buildAssessmentBrowserServer,
  ensureAssessmentBrowserBuild,
  launchAssessmentBrowser,
  stopAssessmentBrowserServer,
  stopRedisStub,
  waitForServer,
} from "../../src/browser-journey/assessmentBrowserJourneySupport";
import { formatFocusDescriptor, readFocused } from "./ownerFocusOrderSupport";

describe("assessment keyboard model supplement", () => {
  test("X-SAFE-PREVIEW-FOCUS-02: GF-S choice buttons use Tab+Space (not native radio arrows)", async () => {
    await ensureAssessmentBrowserBuild();
    buildAssessmentBrowserServer({ safeBackend: true });
    await waitForServer("http://127.0.0.1:3000/assessment");

    const browser = await launchAssessmentBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    try {
      await page.goto("http://127.0.0.1:3000/assessment", { waitUntil: "domcontentloaded" });
      await advanceThroughUniversalSteps(page);

      const controlType = await page.evaluate(() => {
        const btn = document.querySelector("fieldset button");
        return {
          tag: btn?.tagName ?? null,
          role: btn?.getAttribute("role"),
          ariaPressed: btn?.hasAttribute("aria-pressed"),
        };
      });
      expect(controlType.tag).toBe("BUTTON");
      expect(controlType.ariaPressed).toBe(true);
      expect(controlType.role).toBeNull();

      const trace: Array<{ key: string; focus: string; selected?: string }> = [];
      trace.push({ key: "(initial)", focus: formatFocusDescriptor(await readFocused(page)) });

      for (let i = 0; i < 10; i += 1) {
        await page.keyboard.press("Tab");
        trace.push({ key: "Tab", focus: formatFocusDescriptor(await readFocused(page)) });
      }
      await page.keyboard.press("Tab");
      trace.push({ key: "Tab", focus: formatFocusDescriptor(await readFocused(page)) });
      await page.keyboard.press("Space");
      const selected = await page.evaluate(() => {
        const pressed = Array.from(document.querySelectorAll("fieldset button")).find(
          (b) => (b as HTMLButtonElement).getAttribute("aria-pressed") === "true",
        );
        return pressed?.textContent?.trim() ?? "";
      });
      trace.push({
        key: "Space",
        focus: formatFocusDescriptor(await readFocused(page)),
        selected,
      });
      await page.keyboard.press("Tab");
      trace.push({ key: "Tab (leave group)", focus: formatFocusDescriptor(await readFocused(page)) });

      expect(selected).toBe("Consistently / always");
      expect(trace.some((t) => t.focus.includes("Consistently / always"))).toBe(true);
      expect(trace.some((t) => t.focus.includes("Not at all / rarely"))).toBe(true);
    } finally {
      await browser.close();
      stopAssessmentBrowserServer();
      await stopRedisStub();
    }
  }, 120000);
});
