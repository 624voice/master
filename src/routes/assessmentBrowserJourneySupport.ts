import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "puppeteer-core";

const REPO_ROOT = join(fileURLToPath(new URL("../..", import.meta.url)));
export const BROWSER_JOURNEY_BASE_URL = "http://127.0.0.1:3000";
export const REDIS_STUB_PORT = 8787;
export const REDIS_STUB_URL = `http://127.0.0.1:${REDIS_STUB_PORT}`;

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
  "ASSESSMENT_ROI_AGENT_LIVE_ENABLED",
];

const SAFE_BACKEND_ENV: Record<string, string> = {
  ASSESSMENT_SECURITY_HMAC_SECRET: "a".repeat(64),
  UPSTASH_REDIS_REST_URL: REDIS_STUB_URL,
  UPSTASH_REDIS_REST_TOKEN: "phase2-browser-stub-token",
  LEADS_WEBHOOK_URL: `${REDIS_STUB_URL}/leads-webhook`,
  SITE_ORIGIN: BROWSER_JOURNEY_BASE_URL,
  ASSESSMENT_ROI_AGENT_LIVE_ENABLED: "false",
  SPEED2LEAD_ENABLED: "false",
};

let redisStubProcess: ChildProcess | null = null;

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

export function stopRedisStub(): void {
  if (redisStubProcess?.pid) {
    try {
      process.kill(redisStubProcess.pid);
    } catch {
      /* already stopped */
    }
    redisStubProcess = null;
  }
  spawnSync("bash", [
    "-lc",
    `pids=$(lsof -t -iTCP:${REDIS_STUB_PORT} -sTCP:LISTEN 2>/dev/null || true); if [ -n "$pids" ]; then kill $pids 2>/dev/null || true; fi`,
  ]);
}

export function startRedisStub(): void {
  stopRedisStub();
  redisStubProcess = spawn("bun", ["scripts/phase2/upstash-redis-stub.ts"], {
    cwd: REPO_ROOT,
    stdio: "ignore",
    env: { ...process.env, PHASE2_REDIS_STUB_PORT: String(REDIS_STUB_PORT) },
  });
}

export function buildAssessmentBrowserServer(options?: {
  safeBackend?: boolean;
}): void {
  stopAssessmentBrowserServer();
  if (options?.safeBackend) {
    startRedisStub();
  }
  const env: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value != null && !STRIPPED_ENV.includes(key)) {
      env[key] = value;
    }
  }
  if (options?.safeBackend) {
    Object.assign(env, SAFE_BACKEND_ENV);
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
  page: Page,
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

export async function clickChoiceMatching(
  page: Page,
  pattern: string,
): Promise<boolean> {
  return page.evaluate((pat) => {
    const re = new RegExp(pat, "i");
    const target = Array.from(
      document.querySelectorAll("button.w-full.rounded-lg.border.px-4"),
    ).find((button) => re.test(button.textContent ?? ""));
    if (!target) return false;
    target.click();
    return true;
  }, pattern);
}

export async function advanceToRespondReview(page: Page): Promise<void> {
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

export async function advanceThroughUniversalSteps(page: Page): Promise<void> {
  await advanceToRespondReview(page);
  await clickButtonMatching(page, "^Continue$");
}

async function readActiveQuestionText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const legend = document.querySelector("fieldset legend");
    if (legend?.textContent) return legend.textContent;
    return document.body.innerText;
  });
}

const TIE_ANSWER_RULES: Array<[RegExp, string]> = [
  [/new customers find your business/i, "Mostly / often"],
  [/track where new leads come from/i, "Somewhat / occasionally"],
  [/Google Business Profile/i, "Mostly / often"],
  [/prospects to request service/i, "Not at all / rarely"],
  [/inbound leads convert/i, "Mostly / often"],
  [/inbound call get answered/i, "Somewhat / occasionally"],
  [/confirm appointments/i, "Mostly / often"],
  [/estimates or quotes/i, "Not at all / rarely"],
  [/past customers on a regular/i, "Not at all / rarely"],
  [/reviews or referrals/i, "Not at all / rarely"],
  [/maintenance plans/i, "Not at all / rarely"],
  [/re-enter the same customer/i, "Not at all / rarely"],
  [/dispatch and office staff/i, "Not at all / rarely"],
  [/invoices, payments/i, "Not at all / rarely"],
  [/manual admin work/i, "Not at all / rarely"],
  [/marketing and operations efforts/i, "Not at all / rarely"],
  [/booking conversion/i, "Not at all / rarely"],
  [/marketing spend against booked/i, "Not at all / rarely"],
  [/dashboard or report your team/i, "Not at all / rarely"],
];

function chooseTieAnswer(questionText: string): string {
  for (const [pattern, label] of TIE_ANSWER_RULES) {
    if (pattern.test(questionText)) return label;
  }
  return "Not at all / rarely";
}

async function walkQuestionLoop(
  page: Page,
  choose: (questionText: string) => string | null,
  maxSteps = 30,
): Promise<void> {
  for (let i = 0; i < maxSteps; i += 1) {
    const atTeaser = await page.evaluate(() =>
      /Unlock Full Results/i.test(document.body.innerText),
    );
    if (atTeaser) return;

    const questionText = await readActiveQuestionText(page);
    const pattern = choose(questionText);
    if (pattern) {
      await clickChoiceMatching(page, pattern);
    } else {
      const fallback = await page.$("button.w-full.rounded-lg.border.px-4");
      if (fallback) await fallback.click();
    }
    await clickButtonMatching(page, "^Continue$");
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Did not reach teaser during question walk");
}

export async function continueToTeaserFromCurrent(page: Page): Promise<void> {
  await walkQuestionLoop(page, () => null);
}

export async function fastForwardToTeaser(page: Page): Promise<void> {
  await advanceThroughUniversalSteps(page);
  await continueToTeaserFromCurrent(page);
}

export async function fastForwardToTeaserWithTieAnswers(
  page: Page,
): Promise<void> {
  await advanceToRespondReview(page);
  await clickButtonMatching(page, "^Continue$");
  await walkQuestionLoop(page, (questionText) => chooseTieAnswer(questionText));
}

export async function fastForwardToGate(page: Page): Promise<void> {
  await fastForwardToTeaser(page);
  await clickButtonMatching(page, "Unlock Full Results");
  await page.waitForFunction(() =>
    /Unlock your full assessment results/i.test(document.body.innerText),
  );
}

export async function fastForwardToGateWithTieAnswers(page: Page): Promise<void> {
  await fastForwardToTeaserWithTieAnswers(page);
  await clickButtonMatching(page, "Unlock Full Results");
  await page.waitForFunction(() =>
    /Unlock your full assessment results/i.test(document.body.innerText),
  );
}

export async function fillValidLead(page: Page): Promise<void> {
  const suffix = String(Date.now()).slice(-7);
  await page.type("#gate-first-name", "Pat");
  await page.type("#gate-last-name", "Lee");
  await page.type("#gate-business", "Pat Plumbing");
  await page.type("#gate-email", `pat.browser.${suffix}@example.com`);
  await page.type("#gate-phone", `555${suffix.padStart(7, "0").slice(0, 7)}`);
}

export async function submitLeadToResults(
  page: Page,
  options?: { smsConsent?: boolean },
): Promise<void> {
  await fillValidLead(page);
  if (options?.smsConsent) {
    await page.click('input[type="checkbox"]');
  }
  await clickButtonMatching(page, "See My Full Results");
  await page.waitForFunction(() =>
    /Your priority areas/i.test(document.body.innerText),
  );
}

export async function activateConditionalFollowUp(page: Page): Promise<void> {
  await advanceThroughUniversalSteps(page);
  await page.waitForFunction(() =>
    /new customers find your business/i.test(document.body.innerText),
  );
  await clickChoiceMatching(page, "Consistently / always");
  await clickButtonMatching(page, "^Continue$");
  await page.waitForFunction(() =>
    /track where new leads come from/i.test(document.body.innerText),
  );
  await clickChoiceMatching(page, "Yes, consistently");
}

export async function readDomSubmissionPayload(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const hidden = Array.from(document.querySelectorAll('input[type="hidden"]'));
    const payload: Record<string, unknown> = {};
    for (const input of hidden) {
      const name = input.getAttribute("name");
      const value = (input as HTMLInputElement).value;
      if (name) payload[name] = value;
    }
    return payload;
  });
}

export async function captureReportDownloadUrl(page: Page): Promise<string> {
  return page.evaluate(() => {
    return new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("Download URL timeout")),
        30_000,
      );
      const originalOpen = window.open;
      window.open = (url) => {
        window.clearTimeout(timeout);
        window.open = originalOpen;
        resolve(String(url ?? ""));
        return null;
      };
      const button = Array.from(document.querySelectorAll("button")).find((el) =>
        /Download Assessment Report/i.test(el.textContent ?? ""),
      );
      if (!button) {
        window.clearTimeout(timeout);
        reject(new Error("Download Assessment Report button not found"));
        return null;
      }
      button.click();
      return null;
    });
  });
}

export type ReportAccessResult = {
  status: number;
  contentType: string;
  bodyText: string;
  attempts: number;
  pdfBytes: number;
};

export async function accessReportUrlFromBrowser(
  page: Page,
  reportUrl: string,
): Promise<ReportAccessResult> {
  return page.evaluate(async (url) => {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("pdf")) {
      const bytes = await response.arrayBuffer();
      return {
        status: response.status,
        contentType,
        bodyText: `[pdf:${bytes.byteLength}]`,
        attempts: 1,
        pdfBytes: bytes.byteLength,
      };
    }
    return {
      status: response.status,
      contentType,
      bodyText: await response.text(),
      attempts: 1,
      pdfBytes: 0,
    };
  }, reportUrl);
}

async function accessReportUrlWith503Interception(
  page: Page,
  reportUrl: string,
): Promise<ReportAccessResult> {
  await page.setRequestInterception(true);
  let attempts = 0;
  const onRequest = (request: import("puppeteer-core").HTTPRequest) => {
    if (request.url().includes("/assessment-report/")) {
      attempts += 1;
      if (attempts === 1) {
        request.respond({
          status: 503,
          contentType: "text/plain; charset=utf-8",
          body: "Report temporarily unavailable",
        });
        return;
      }
    }
    request.continue();
  };
  page.on("request", onRequest);
  try {
    const access = await accessReportUrlFromBrowser(page, reportUrl);
    return { ...access, attempts };
  } finally {
    page.off("request", onRequest);
    await page.setRequestInterception(false);
  }
}

export async function clickDownloadReport(
  page: Page,
  options?: { failFirstWith503?: boolean },
): Promise<{ reportUrl: string; access: ReportAccessResult }> {
  const reportUrl = await captureReportDownloadUrl(page);
  const access = options?.failFirstWith503
    ? await accessReportUrlWith503Interception(page, reportUrl)
    : await accessReportUrlFromBrowser(page, reportUrl);
  return { reportUrl, access };
}

export function attachSubmitAnswerKeyCapture(page: Page): {
  waitForKeys: () => Promise<string[]>;
} {
  let resolveKeys: ((keys: string[]) => void) | null = null;
  const keysPromise = new Promise<string[]>((resolve) => {
    resolveKeys = resolve;
  });

  const onRequest = (request: import("puppeteer-core").HTTPRequest) => {
    const data = request.postData();
    if (request.method() !== "POST" || !data?.includes("idempotencyKey")) {
      return;
    }
    for (const match of data.matchAll(/"k":(\[[^\]]+\])/g)) {
      try {
        const keys = JSON.parse(match[1]!) as string[];
        if (keys.includes("BP1") && keys.includes("GF-S")) {
          page.off("request", onRequest);
          resolveKeys?.(keys);
          return;
        }
      } catch {
        /* keep scanning */
      }
    }
  };

  page.on("request", onRequest);

  return {
    waitForKeys: () => keysPromise,
  };
}

export async function deleteReportToken(token: string): Promise<void> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: REDIS_STUB_URL,
    token: "phase2-browser-stub-token",
  });
  await redis.del(`assessment:report:${token}`);
}
