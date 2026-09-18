/**
 * Validates owner walkthrough labels/selectors against running safe preview.
 * Automation for procedure verification only — not A11Y-090 human attestation.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import {
  depsCacheReady,
  runPrepareDepsOnHost,
  startDockerPreview,
  stopDockerPreview,
} from "./safePreviewDocker";
import { waitForDockerPreviewReady } from "./safePreviewDockerWait";
import { dockerAvailable } from "./safePreviewIsolationRuntime";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(REPO_ROOT, "review-artifacts/phase2/owner-walkthrough-dry-run.json");
const BASE = "http://127.0.0.1:3000";

const OWNER_FIXTURE = {
  firstName: "Alex",
  lastName: "Testowner",
  business: "Owner QA Fake HVAC Co",
  email: "owner-qa-fake@example.invalid",
  phone: "5550100199",
};

function chromiumPath(): string | null {
  for (const p of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]) {
    try {
      return p;
    } catch {
      /* continue */
    }
  }
  return "/usr/bin/chromium";
}

async function main(): Promise<void> {
  if (!dockerAvailable()) {
    throw new Error("Docker required for dry-run");
  }
  if (!depsCacheReady()) runPrepareDepsOnHost();
  const child = startDockerPreview(false);
  await waitForDockerPreviewReady();
  const corrections: string[] = [];
  const checks: Array<{ id: number; ok: boolean; note: string }> = [];

  try {
    const browser = await puppeteer.launch({
      executablePath: chromiumPath()!,
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const navLinks = await page.$$eval("header nav a", (els) => els.map((e) => e.textContent?.trim() ?? ""));
    checks.push({ id: 1, ok: navLinks.includes("What We Do"), note: navLinks.join(", ") });

    await page.goto(`${BASE}/assessment`, { waitUntil: "domcontentloaded" });
    checks.push({ id: 20, ok: (await page.$("#assessment-bp1")) != null, note: "assessment-bp1 present" });
    checks.push({ id: 21, ok: (await page.$("#respond-R1")) != null, note: "respond-R1 after flow — requires navigation" });

    await page.select("#assessment-bp1", "HVAC");
    await page.click("button");
    checks.push({ id: 20, ok: (await page.$("#assessment-bp2")) != null, note: "bp2 after continue" });

    await browser.close();
  } finally {
    child.kill("SIGTERM");
    stopDockerPreview();
  }

  const result = {
    executedAt: new Date().toISOString(),
    fixture: OWNER_FIXTURE,
    checks,
    corrections,
    allLiteral: corrections.length === 0,
  };
  mkdirSync(join(REPO_ROOT, "review-artifacts/phase2"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
