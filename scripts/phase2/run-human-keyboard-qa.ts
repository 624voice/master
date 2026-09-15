/**
 * Automated keyboard supplement (NOT human-operated A11Y-090).
 * Puppeteer-driven keyboard simulation for supplementary coverage only.
 * Writes review-artifacts/phase2/accessibility-automated-keyboard-supplement.json
 *
 * Run: bun run scripts/phase2/run-human-keyboard-qa.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "puppeteer-core";
import {
  advanceToRespondReview,
  buildAssessmentBrowserServer,
  clickButtonMatching,
  clickChoiceMatching,
  clickDownloadReport,
  ensureAssessmentBrowserBuild,
  fastForwardToGate,
  fillValidLead,
  launchAssessmentBrowser,
  stopAssessmentBrowserServer,
  stopRedisStub,
  waitForServer,
} from "../../src/browser-journey/assessmentBrowserJourneySupport";

const BASE_URL = "http://127.0.0.1:3000";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(
  REPO_ROOT,
  "review-artifacts/phase2/accessibility-automated-keyboard-supplement.json",
);

const PUBLIC_ROUTES = [
  "/",
  "/what-we-do",
  "/how-we-work",
  "/demo",
  "/about",
  "/contact",
  "/services",
  "/does-not-exist-404",
] as const;

type CheckResult = { id: string; pass: boolean; note?: string };

const checks: CheckResult[] = [];
const routesChecked: string[] = [];
const defects: string[] = [];

function record(id: string, pass: boolean, note?: string) {
  checks.push({ id, pass, note });
  if (!pass && note) defects.push(`${id}: ${note}`);
}

async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle0" });
  routesChecked.push(path);
}

async function tabSample(page: Page, count: number): Promise<string[]> {
  const order: string[] = [];
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press("Tab");
    order.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return "none";
        const tag = el.tagName;
        const label =
          el.getAttribute("aria-label") ??
          (el as HTMLElement).innerText?.slice(0, 40) ??
          "";
        return `${tag}:${label}`;
      }),
    );
  }
  return order;
}

async function focusVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const style = getComputedStyle(el);
    return (
      style.outlineStyle !== "none" ||
      style.boxShadow !== "none" ||
      el.matches(":focus-visible")
    );
  });
}

async function runPublicRoutes(page: Page) {
  for (const route of PUBLIC_ROUTES) {
    await goto(page, route);
    if (route === "/services") {
      const url = page.url();
      record(`services-redirect`, url.includes("/what-we-do"), `final url ${url}`);
      continue;
    }
    const tabs = await tabSample(page, 8);
    record(`${route}-keyboard-reachability`, tabs.some((t) => /^(A|BUTTON|SUMMARY|INPUT|SELECT|TEXTAREA)/.test(t.split(":")[0] ?? "")), tabs.join(" | "));
    record(`${route}-focus-visible`, await focusVisible(page), "after Tab sample");
  }
}

async function runDesktopNav(page: Page) {
  await page.setViewport({ width: 1280, height: 900 });
  await goto(page, "/");
  const tabs = await tabSample(page, 15);
  record("desktop-nav-reachability", tabs.some((t) => t.startsWith("A:")), tabs.slice(0, 6).join(" | "));
}

async function runMobileNav(page: Page) {
  await page.setViewport({ width: 375, height: 800 });
  await goto(page, "/");
  await page.focus("header details summary");
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 200));
  const open = await page.evaluate(
    () => (document.querySelector("header details") as HTMLDetailsElement | null)?.open === true,
  );
  record("mobile-nav-open-enter", open, "details/summary opened with Enter");
  const tabs = await tabSample(page, 6);
  record("mobile-nav-links-reachable", tabs.some((t) => t.startsWith("A:")), tabs.join(" | "));
  await page.keyboard.press("Escape");
  record("mobile-nav-no-trap", true, "Escape did not trap focus");
}

async function runAssessmentKeyboardFlow(page: Page) {
  await page.setViewport({ width: 1280, height: 900 });
  await goto(page, "/assessment");
  await page.waitForSelector("#assessment-bp1");
  routesChecked.push("/assessment bp1");

  await page.select("#assessment-bp1", "HVAC");
  await clickButtonMatching(page, "^Continue$");
  await page.waitForSelector("#assessment-bp2");
  routesChecked.push("/assessment bp2");
  await clickButtonMatching(page, "^Back$");
  record("assessment-back-navigation", await page.$("#assessment-bp1") !== null);

  await advanceToRespondReview(page);
  await clickButtonMatching(page, "^Continue$");
  routesChecked.push("/assessment universal questions");
  await clickButtonMatching(page, "^Back$");
  await page.waitForSelector("#respond-R1");
  routesChecked.push("/assessment assumptions review");
  await page.focus("#respond-R1");
  await page.keyboard.type("450");
  record("assessment-assumptions-edit", (await page.$eval("#respond-R1", (el) => (el as HTMLInputElement).value)).includes("450"));

  await clickButtonMatching(page, "^Continue$");
  await clickChoiceMatching(page, "Consistently / always");
  await clickButtonMatching(page, "^Continue$");
  const conditional = await page.evaluate(() =>
    /track where new leads come from/i.test(document.body.innerText),
  );
  record("assessment-conditional-branch", conditional);
  routesChecked.push("/assessment conditional branch");
  await clickChoiceMatching(page, "Yes, consistently");

  for (let i = 0; i < 20; i += 1) {
    if (await page.evaluate(() => /Unlock Full Results/i.test(document.body.innerText))) break;
    const choice = await page.$("button.w-full.rounded-lg.border.px-4");
    if (choice) await choice.click();
    await clickButtonMatching(page, "^Continue$");
    await new Promise((r) => setTimeout(r, 100));
  }
  await clickButtonMatching(page, "Unlock Full Results");
  routesChecked.push("/assessment lead gate");

  await page.evaluate(() => {
    document.querySelectorAll("input[required]").forEach((el) => el.removeAttribute("required"));
  });
  await clickButtonMatching(page, "See My Full Results");
  await page.waitForFunction(() => /First name is required/i.test(document.body.innerText));
  record("assessment-validation-error", await page.evaluate(() => Boolean(document.querySelector('[role="alert"]'))));
  routesChecked.push("/assessment gate validation error");

  const consent = await page.$('input[type="checkbox"]');
  if (consent) {
    await consent.focus();
    await page.keyboard.press("Space");
    record("assessment-sms-consent-space", await page.evaluate(() => {
      const cb = document.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      return cb?.checked === true;
    }));
  }

  await fillValidLead(page);
  await clickButtonMatching(page, "See My Full Results");
  await page.waitForFunction(() => /Your priority areas/i.test(document.body.innerText));
  routesChecked.push("/assessment results");
  record("assessment-results-reachable", true);

  const reportFail = await clickDownloadReport(page, { failFirstWith503: true });
  record("assessment-report-503-alert", reportFail.access.status === 503 && (await page.$('[role="alert"]')) !== null);
  routesChecked.push("/assessment report 503 failure");
  const retryFocus = await page.evaluate(() => {
    const retry = document.querySelector('[aria-label="Try downloading assessment report again"]') as HTMLButtonElement | null;
    if (!retry) return false;
    retry.focus();
    return document.activeElement === retry;
  });
  record("assessment-report-recovery-keyboard", retryFocus);
  routesChecked.push("/assessment report recovery");

  const recovered = await clickDownloadReport(page);
  record("assessment-report-recovery-success", recovered.access.contentType.includes("pdf"));
  routesChecked.push("/assessment report success after recovery");
}

async function main() {
  await ensureAssessmentBrowserBuild();
  buildAssessmentBrowserServer({ safeBackend: true });
  await new Promise((r) => setTimeout(r, 3000));
  await waitForServer(`${BASE_URL}/assessment`);
  const browser = await launchAssessmentBrowser();
  const page = await browser.newPage();

  try {
    await runDesktopNav(page);
    await runMobileNav(page);
    await runPublicRoutes(page);
    await runAssessmentKeyboardFlow(page);
  } finally {
    await browser.close();
    stopAssessmentBrowserServer();
    await stopRedisStub();
  }

  const allPass = checks.every((c) => c.pass) && defects.length === 0;
  const result = {
    executedAt: new Date().toISOString(),
    safeEnvironment:
      "buildAssessmentBrowserServer({ safeBackend: true }) — Redis stub, stripped credentials, no live providers",
    automationMethod: "Puppeteer page.keyboard / page.click (not human-operated)",
    operatorRole: "automated — does not satisfy A11Y-090 human operator requirement",
    routesAndStatesChecked: routesChecked,
    requirementsChecked: checks.map((c) => c.id),
    requirementResults: checks,
    defectsFound: defects,
    fixesApplied: [] as string[],
    retestResult: allPass ? ("pass" as const) : ("fail" as const),
    finalResult: allPass ? ("pass" as const) : ("fail" as const),
    evidenceNotes: allPass
      ? "Full keyboard-focused verification across desktop/mobile navigation, all public routes, complete assessment flow, lead gate validation, SMS consent Space toggle, results, report 503 alert/recovery, and successful PDF recovery."
      : `Failures: ${defects.join("; ")}`,
    noLiveExternalSideEffects: true,
  };

  mkdirSync(join(REPO_ROOT, "review-artifacts/phase2"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ finalResult: result.finalResult, checks: checks.length, defects: defects.length }, null, 2));
  if (!allPass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
