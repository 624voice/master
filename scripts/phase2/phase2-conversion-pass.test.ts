import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PUBLIC_CTA } from "../../src/content/publicConversion";

describe("Phase 2 conversion pass (Checkpoint 2)", () => {
  test("roi-calculator route redirects to assessment without side effects", () => {
    const roiRoute = readFileSync("src/routes/roi-calculator.tsx", "utf8");
    expect(roiRoute).toContain('redirect({ to: "/assessment"');
    expect(roiRoute).not.toContain("RoiCalculator");
    expect(roiRoute).not.toContain("generateRoiPdf");
  });

  test("nav exposes one unified assessment link", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).toContain("freeRevenueAssessment");
    expect(root).not.toMatch(/label:\s*"ROI Calculator"/);
    expect(root).not.toContain('href: "/roi-calculator"');
  });

  test("Explore Your Options routes to contact", () => {
    expect(PUBLIC_CTA.exploreOptionsHref).toBe("/contact");
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).toContain('href={PUBLIC_CTA.exploreOptionsHref}');
  });

  test("Other trade is selectable in call volume model", () => {
    const callVolume = readFileSync("src/lib/roi/callVolume.ts", "utf8");
    expect(callVolume).toContain("Other:");
  });
});
