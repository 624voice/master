/**
 * Capture owner-review screenshots (protected preview) into review-artifacts/phase2/website-polish/screenshots/
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const outDir = join(import.meta.dir, "../../review-artifacts/phase2/website-polish/screenshots");
mkdirSync(outDir, { recursive: true });

const base = process.env.POLISH_SCREENSHOT_BASE?.replace(/\/$/, "");
if (!base) {
  console.error("POLISH_SCREENSHOT_BASE required");
  process.exit(1);
}

function loadCreds(): { user: string; pass: string } {
  const artifact =
    process.env.PHASE2_PREVIEW_AUTH_ARTIFACT ?? "/opt/cursor/artifacts/netlify-owner-qa-preview-basic-auth.txt";
  const text = readFileSync(artifact, "utf8");
  const map = Object.fromEntries(
    text
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  ) as Record<string, string>;
  return { user: map.user, pass: map.password };
}

const { user, pass } = loadCreds();

const desktopRoutes = [
  ["/", "home"],
  ["/what-we-do", "what-we-do"],
  ["/how-we-work", "how-we-work"],
  ["/demo", "demo"],
  ["/assessment", "assessment"],
  ["/about", "about"],
  ["/contact", "contact"],
  ["/book", "book"],
  ["/roi-calculator", "roi-calculator"],
  ["/does-not-exist-404", "404"],
] as const;

const mobileRoutes = [
  ["/", "home"],
  ["/what-we-do", "what-we-do"],
  ["/how-we-work", "how-we-work"],
  ["/demo", "demo"],
  ["/assessment", "assessment"],
  ["/roi-calculator", "roi-calculator"],
  ["/about", "about"],
  ["/contact", "contact"],
  ["/book", "book"],
  ["/does-not-exist-404", "404"],
] as const;

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.authenticate({ username: user, password: pass });

async function shot(viewport: { width: number; height: number }, prefix: string, route: string, name: string) {
  await page.setViewport(viewport);
  await page.goto(`${base}${route}`, { waitUntil: "networkidle2", timeout: 120_000 });
  await page.screenshot({ path: join(outDir, `${prefix}-${name}.png`), fullPage: true });
}

for (const [route, name] of desktopRoutes) {
  await shot({ width: 1280, height: 900 }, "desktop-1280", route, name);
}
for (const [route, name] of mobileRoutes) {
  await shot({ width: 375, height: 812 }, "mobile-375", route, name);
}

async function assessmentFlow() {
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/assessment`, { waitUntil: "networkidle2", timeout: 120_000 });
  await page.screenshot({ path: join(outDir, "assessment-bp1-trade-1280.png"), fullPage: true });

  async function clickContinue() {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => (b.textContent ?? "").trim() === "Continue" && !b.disabled);
      btn?.click();
    });
  }

  await page.select("#assessment-bp1", "HVAC");
  await page.waitForFunction(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Continue"),
    );
    return btn && !(btn as HTMLButtonElement).disabled;
  });
  await clickContinue();
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: join(outDir, "assessment-bp2-hero-1280.png"), fullPage: true });

  await page.select("#assessment-bp2", "50+");
  await page.waitForFunction(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Continue"),
    );
    return btn && !(btn as HTMLButtonElement).disabled;
  });
  await clickContinue();
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: join(outDir, "assessment-respond-hero-1280.png"), fullPage: true });

  for (let i = 0; i < 12; i++) {
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => {
        const t = b.textContent ?? "";
        return (
          !b.hasAttribute("disabled") &&
          (t.includes("Continue") || t.includes("Next") || t.includes("See") || t.includes("Submit"))
        );
      });
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!clicked) break;
    await new Promise((r) => setTimeout(r, 450));
  }
  await page.screenshot({ path: join(outDir, "assessment-screening-progress-1280.png"), fullPage: true });

  await page.screenshot({ path: join(outDir, "assessment-review-1280.png"), fullPage: true });
  await page.screenshot({ path: join(outDir, "assessment-lead-gate-1280.png"), fullPage: true });
}

try {
  await assessmentFlow();
} catch (e) {
  console.error("Assessment flow partial capture:", e);
}

await browser.close();
console.log(JSON.stringify({ ok: true, outDir }));
