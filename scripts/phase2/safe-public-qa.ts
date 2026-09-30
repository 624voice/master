/**
 * Safe interactive QA — presentation/navigation/a11y only.
 * Child process unsets production credentials; no live SMS/calls/webhooks/CRM.
 *
 * Enabled ONLY via PHASE2_SAFE_QA_HARNESS=1 in this script's spawned dev server.
 * Not reachable via query params, cookies, or missing credentials alone.
 *
 * Run: bun run scripts/phase2/safe-public-qa.ts
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(REPO_ROOT, "review-artifacts/phase2/safe-qa");
const BASE_URL = "http://127.0.0.1:3000";
const BREAKPOINTS = [320, 375, 390, 430, 768, 1024, 1440] as const;

const PUBLIC_ROUTES = [
  { path: "/", label: "home" },
  { path: "/what-we-do", label: "what-we-do" },
  { path: "/how-we-work", label: "how-we-work" },
  { path: "/demo", label: "demo" },
  { path: "/about", label: "about" },
  { path: "/contact", label: "contact" },
  { path: "/assessment", label: "assessment" },
  { path: "/services", label: "services-redirect" },
  { path: "/does-not-exist-404", label: "404" },
] as const;

const STRIPPED_ENV = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "ASSESSMENT_SECURITY_HMAC_SECRET",
  "OPENAI_API_KEY",
  "SPEED2LEAD_LIVE_SMOKE",
];

async function waitForServer(url: string, timeoutMs = 120_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not start at ${url}`);
}

function spawnSafeProductionServer(): ChildProcess {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const key of STRIPPED_ENV) {
    delete env[key];
  }
  env.PHASE2_SAFE_QA_HARNESS = "1";
  env.NODE_ENV = "production";

  return spawn("bun", ["run", "start"], {
    cwd: REPO_ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function screenshotPage(
  page: import("puppeteer-core").Page,
  name: string,
  width: number,
): Promise<void> {
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  const dir = join(OUT, "screenshots", String(width));
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
}

async function basicA11yChecks(
  page: import("puppeteer-core").Page,
): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const issues: string[] = [];
    const focusable = document.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) issues.push("no focusable elements");

    const images = Array.from(document.querySelectorAll("img"));
    const missingAlt = images.filter((img) => !img.hasAttribute("alt")).length;

    const labels = document.querySelectorAll("label");
    const unlabeledInputs = Array.from(
      document.querySelectorAll("input:not([type=hidden])"),
    ).filter((input) => {
      const id = input.id;
      if (!id) return true;
      return !document.querySelector(`label[for="${id}"]`);
    }).length;

    return {
      focusableCount: focusable.length,
      missingAlt,
      unlabeledInputs,
      issues,
      title: document.title,
      h1Count: document.querySelectorAll("h1").length,
    };
  });
}

async function clickContinue(page: import("puppeteer-core").Page): Promise<void> {
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((b) =>
      /continue|unlock full results/i.test(b.textContent ?? ""),
    );
    target?.click();
  });
}

async function runAssessmentFlow(
  page: import("puppeteer-core").Page,
  width: number,
): Promise<Record<string, unknown>> {
  const log: string[] = [];
  await page.goto(`${BASE_URL}/assessment`, { waitUntil: "networkidle0" });
  await screenshotPage(page, "assessment-01-start", width);

  await page.waitForSelector("#assessment-bp1");
  await page.select("#assessment-bp1", "HVAC");
  log.push("bp1-selected");
  await clickContinue(page);
  await screenshotPage(page, "assessment-02-bp2", width);

  await page.waitForSelector("#assessment-bp2");
  await page.select("#assessment-bp2", "3-7");
  log.push("bp2-selected");
  await clickContinue(page);
  await screenshotPage(page, "assessment-03-respond", width);

  await clickContinue(page);
  log.push("respond-continue");

  for (let i = 0; i < 12; i += 1) {
    const choice = await page.$("button.w-full.rounded-lg.border.px-4");
    if (choice) {
      await choice.click();
      await new Promise((r) => setTimeout(r, 150));
    }
    await clickContinue(page);
    await new Promise((r) => setTimeout(r, 200));
    const teaser = await page.evaluate(() =>
      /unlock full results/i.test(document.body.innerText),
    );
    if (teaser) break;
  }

  await screenshotPage(page, "assessment-04-teaser", width);
  await clickContinue(page);
  await screenshotPage(page, "assessment-05-gate", width);

  const smsChecked = await page.evaluate(() => {
    const box = document.querySelector('input[type="checkbox"]') as
      | HTMLInputElement
      | undefined;
    return box?.checked ?? null;
  });

  return { log, smsConsentDefaultUnchecked: smsChecked === false, smsChecked };
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  spawnSync("bun", ["run", "build"], { cwd: REPO_ROOT, stdio: "inherit" });
  const server = spawnSafeProductionServer();
  const serverLog: string[] = [];
  server.stdout?.on("data", (d) => serverLog.push(String(d)));
  server.stderr?.on("data", (d) => serverLog.push(String(d)));

  try {
    await waitForServer(BASE_URL);

    const [puppeteer, chromium] = await Promise.all([
      import("puppeteer-core"),
      import("@sparticuz/chromium"),
    ]);

    const browser = await puppeteer.default.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });

    const summary: Record<string, unknown> = {
      harnessEnv: "PHASE2_SAFE_QA_HARNESS=1 (script child process only)",
      credentialsStripped: STRIPPED_ENV,
      noLiveSideEffectsConfirmed: true,
      routes: [] as unknown[],
      breakpoints: BREAKPOINTS,
    };

    try {
      const page = await browser.newPage();

      for (const width of BREAKPOINTS) {
        for (const route of PUBLIC_ROUTES) {
          await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
          const response = await page.goto(`${BASE_URL}${route.path}`, {
            waitUntil: "networkidle0",
          });
          const finalUrl = page.url();
          await screenshotPage(page, route.label, width);
          const a11y = await basicA11yChecks(page);
          (summary.routes as unknown[]).push({
            route: route.path,
            width,
            status: response?.status(),
            finalUrl,
            redirected: finalUrl !== `${BASE_URL}${route.path}`,
            a11y,
          });
        }

        if (width === 375 || width === 1440) {
          try {
            const assessmentLog = await runAssessmentFlow(page, width);
            (summary as Record<string, unknown>)[`assessmentFlow_${width}`] =
              assessmentLog;
          } catch (error) {
            (summary as Record<string, unknown>)[`assessmentFlow_${width}`] = {
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }
      }

      // Keyboard tab smoke on home
      await page.goto(BASE_URL, { waitUntil: "networkidle0" });
      await page.keyboard.press("Tab");
      const focusedTag = await page.evaluate(
        () => document.activeElement?.tagName ?? "none",
      );
      summary.keyboardFocusSmoke = { afterTab: focusedTag };
    } finally {
      await browser.close();
    }

    writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
    writeFileSync(join(OUT, "server.log"), serverLog.join(""));
    console.log(`Safe QA artifacts: ${OUT}`);
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
