import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL("../..", import.meta.url)));
export const BROWSER_JOURNEY_BASE_URL = "http://127.0.0.1:3000";

const STRIPPED_ENV = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "ASSESSMENT_SECURITY_HMAC_SECRET",
  "OPENAI_API_KEY",
  "SPEED2LEAD_LIVE_SMOKE",
  "PHASE2_SAFE_QA_HARNESS",
];

export async function waitForServer(
  url: string,
  timeoutMs = 120_000,
): Promise<void> {
  const start = Date.now();
  let consecutiveOk = 0;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) {
        consecutiveOk += 1;
        if (consecutiveOk >= 3) return;
      } else {
        consecutiveOk = 0;
      }
    } catch {
      consecutiveOk = 0;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not start at ${url}`);
}

export function stopAssessmentBrowserServer(): void {
  spawnSync("bash", [
    "-lc",
    "pids=$(lsof -t -iTCP:3000 -sTCP:LISTEN 2>/dev/null || true); if [ -n \"$pids\" ]; then kill $pids 2>/dev/null || true; fi",
  ]);
}

export function buildAssessmentBrowserServer(): void {
  stopAssessmentBrowserServer();
  const env: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value != null && !STRIPPED_ENV.includes(key)) {
      env[key] = value;
    }
  }
  spawnSync("bash", [
    "-lc",
    `cd ${JSON.stringify(REPO_ROOT)} && nohup bun run start > /tmp/assessment-browser-server.log 2>&1 &`,
  ], { env: env as NodeJS.ProcessEnv });
}

export function ensureAssessmentBrowserBuild(): void {
  const result = spawnSync("bun", ["run", "build"], {
    cwd: REPO_ROOT,
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(
      `Production build failed: ${result.stderr?.toString() ?? "unknown error"}`,
    );
  }
}

export async function launchAssessmentBrowser() {
  const [puppeteer, chromium] = await Promise.all([
    import("puppeteer-core"),
    import("@sparticuz/chromium"),
  ]);
  return puppeteer.default.launch({
    args: chromium.default.args,
    executablePath: await chromium.default.executablePath(),
    headless: true,
  });
}

export async function clickButtonMatching(
  page: import("puppeteer-core").Page,
  pattern: string,
): Promise<boolean> {
  return page.evaluate((pat) => {
    const re = new RegExp(pat, "i");
    const target = Array.from(document.querySelectorAll("button")).find((button) =>
      re.test(button.textContent ?? ""),
    );
    if (!target) return false;
    target.click();
    return true;
  }, pattern);
}

export async function advanceToRespondReview(
  page: import("puppeteer-core").Page,
): Promise<void> {
  await page.goto(`${BROWSER_JOURNEY_BASE_URL}/assessment`, {
    waitUntil: "networkidle0",
  });
  await page.waitForSelector("#assessment-bp1");
  await page.select("#assessment-bp1", "HVAC");
  await clickButtonMatching(page, "^Continue$");
  await page.waitForSelector("#assessment-bp2");
  await page.select("#assessment-bp2", "3-7");
  await clickButtonMatching(page, "^Continue$");
  await page.waitForSelector("#respond-R1");
}

export async function advanceThroughUniversalSteps(
  page: import("puppeteer-core").Page,
): Promise<void> {
  await advanceToRespondReview(page);
  await clickButtonMatching(page, "^Continue$");
}

export async function fastForwardToTeaser(
  page: import("puppeteer-core").Page,
): Promise<void> {
  await advanceThroughUniversalSteps(page);
  for (let i = 0; i < 20; i += 1) {
    const atTeaser = await page.evaluate(() =>
      /Unlock Full Results/i.test(document.body.innerText),
    );
    if (atTeaser) return;
    const choice = await page.$("button.w-full.rounded-lg.border.px-4");
    if (choice) await choice.click();
    await clickButtonMatching(page, "^Continue$");
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Did not reach teaser step");
}

export async function fastForwardToGate(
  page: import("puppeteer-core").Page,
): Promise<void> {
  await fastForwardToTeaser(page);
  await clickButtonMatching(page, "Unlock Full Results");
  await page.waitForFunction(() =>
    /Unlock your full assessment results/i.test(document.body.innerText),
  );
}
