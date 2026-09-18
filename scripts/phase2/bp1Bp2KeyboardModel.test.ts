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
import { formatFocusDescriptor, readFocused, resetFocusFromPageLoad } from "./ownerFocusOrderSupport";

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
      await resetFocusFromPageLoad(page);
      for (let i = 0; i < 7; i += 1) await page.keyboard.press("Tab");

      const bp1Meta = await page.evaluate(() => {
        const el = document.querySelector("#assessment-bp1") as HTMLSelectElement | null;
        return {
          tag: el?.tagName ?? null,
          type: el?.getAttribute("type"),
          role: el?.getAttribute("role"),
          name: document.querySelector('label[for="assessment-bp1"]')?.textContent?.trim() ?? "",
          options: Array.from(el?.options ?? []).map((o) => o.text.trim()),
        };
      });
      expect(bp1Meta.tag).toBe("SELECT");
      expect(bp1Meta.options).toContain("HVAC");

      const bp1Trace: Array<{ key: string; focus: string; selected?: string }> = [];
      bp1Trace.push({ key: "(initial)", focus: formatFocusDescriptor(await readFocused(page)) });
      for (const key of ["ArrowDown", "ArrowDown", "ArrowDown", "Tab", "Enter"] as const) {
        await page.keyboard.press(key);
        await new Promise((r) => setTimeout(r, 250));
        const focus = formatFocusDescriptor(await readFocused(page));
        const selected =
          key.startsWith("Arrow") ?
            await page.evaluate(
              () =>
                (document.querySelector("#assessment-bp1") as HTMLSelectElement | null)?.selectedOptions[0]
                  ?.text ?? "",
            )
          : undefined;
        bp1Trace.push({ key, focus, selected });
      }
      expect(bp1Trace.some((t) => t.selected === "HVAC")).toBe(true);
      expect(bp1Trace.at(-1)?.focus).toContain("document body");

      await page.waitForSelector("#assessment-bp2", { timeout: 10000 });
      await page.keyboard.down("Shift");
      await page.keyboard.press("Tab");
      await page.keyboard.up("Shift");
      await page.keyboard.down("Shift");
      await page.keyboard.press("Tab");
      await page.keyboard.up("Shift");

      const bp2Meta = await page.evaluate(() => {
        const el = document.querySelector("#assessment-bp2") as HTMLSelectElement | null;
        return {
          tag: el?.tagName ?? null,
          options: Array.from(el?.options ?? []).map((o) => o.text.trim()),
        };
      });
      expect(bp2Meta.tag).toBe("SELECT");
      expect(bp2Meta.options).toContain("3–7 vehicles");

      const bp2Trace: Array<{ key: string; focus: string; selected?: string }> = [];
      bp2Trace.push({ key: "(on BP2 select)", focus: formatFocusDescriptor(await readFocused(page)) });
      for (const key of ["ArrowDown", "ArrowDown", "Tab", "Tab", "Enter"] as const) {
        await page.keyboard.press(key);
        await new Promise((r) => setTimeout(r, 250));
        bp2Trace.push({
          key,
          focus: formatFocusDescriptor(await readFocused(page)),
          selected:
            key.startsWith("Arrow") ?
              await page.evaluate(
                () =>
                  (document.querySelector("#assessment-bp2") as HTMLSelectElement | null)?.selectedOptions[0]
                    ?.text ?? "",
              )
            : undefined,
        });
      }
      expect(bp2Trace.some((t) => t.selected === "3–7 vehicles")).toBe(true);
    } finally {
      await browser.close();
      stopAssessmentBrowserServer();
      await stopRedisStub();
    }
  }, 120000);
});
