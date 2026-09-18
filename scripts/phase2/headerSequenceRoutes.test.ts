/**
 * Proves shared desktop header Tab sequence on every owner route.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FOCUS = join(import.meta.dir, "../../review-artifacts/phase2/owner-focus-order-sequences.json");

const SHARED_HEADER = [
  "What We Do",
  "How We Work",
  "Live Demo",
  "Free Assessment",
  "About",
  "Book Your AI Growth Systems Consultation",
];

const ROUTES = [
  "/",
  "/what-we-do",
  "/how-we-work",
  "/demo",
  "/about",
  "/contact",
  "/does-not-exist-404",
];

describe("shared header sequence across routes", () => {
  test("X-SAFE-PREVIEW-FOCUS-05: header Tab order matches on all listed desktop routes", () => {
    const data = JSON.parse(readFileSync(FOCUS, "utf8")) as {
      captures: Array<{ path: string; viewport: { width: number }; tabSequence: Array<{ name: string }> }>;
    };

    for (const route of ROUTES) {
      const capture = data.captures.find((c) => c.path === route && c.viewport.width === 1280);
      expect(capture).toBeTruthy();
      const headerNames = capture!.tabSequence.slice(0, 6).map((d) => d.name);
      expect(headerNames).toEqual(SHARED_HEADER);
    }
  });
});
