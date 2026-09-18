/**
 * Captures Assessment keyboard focus/selection evidence for owner walkthrough.
 * Automation supplement only — not A11Y-090 human attestation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  advanceToRespondReview,
  buildAssessmentBrowserServer,
  clickButtonMatching,
  clickChoiceMatching,
  ensureAssessmentBrowserBuild,
  fastForwardToGate,
  launchAssessmentBrowser,
  stopAssessmentBrowserServer,
  stopRedisStub,
  submitLeadToResults,
  waitForServer,
} from "../../src/browser-journey/assessmentBrowserJourneySupport";
import { formatFocusDescriptor, readFocused, resetFocusFromPageLoad } from "./ownerFocusOrderSupport";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(REPO_ROOT, "review-artifacts/phase2/assessment-keyboard-evidence.json");
const BASE = "http://127.0.0.1:3000";

type Step = { action: string; focus: string; selectedValue?: string };

async function focusLabel(page: import("puppeteer-core").Page): Promise<string> {
  return formatFocusDescriptor(await readFocused(page));
}

async function main(): Promise<void> {
  await ensureAssessmentBrowserBuild();
  buildAssessmentBrowserServer({ safeBackend: true });
  await waitForServer(`${BASE}/assessment`);

  const browser = await launchAssessmentBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const evidence: Record<string, unknown> = { capturedAt: new Date().toISOString() };

  try {
    await page.goto(`${BASE}/assessment`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 400));

    const headerSteps: Step[] = [];
    headerSteps.push({ action: "reset Tab", focus: formatFocusDescriptor(await resetFocusFromPageLoad(page)) });
    for (let i = 0; i < 7; i += 1) {
      await page.keyboard.press("Tab");
      headerSteps.push({ action: `Tab ${i + 1}`, focus: await focusLabel(page) });
    }
    evidence.standardHeaderSequenceAssessment = headerSteps;

    await page.select("#assessment-bp1", "HVAC");
    await page.keyboard.press("Tab");
    evidence.bp1AfterSelectTab = await focusLabel(page);
    await page.keyboard.press("Enter");
    await page.waitForSelector("#assessment-bp2", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 200));
    evidence.bp1AfterContinueFocus = await focusLabel(page);

    await page.select("#assessment-bp2", "3-7");
    await page.keyboard.press("Tab");
    evidence.bp2AfterSelectTab1 = await focusLabel(page);
    await page.keyboard.press("Tab");
    evidence.bp2AfterSelectTab2 = await focusLabel(page);
    await page.keyboard.press("Tab");
    evidence.bp2AfterSelectTab3 = await focusLabel(page);
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 500));
    evidence.bp2AfterContinueFocus = await focusLabel(page);
    await page.waitForSelector("#respond-R1", { timeout: 10000 });

    await page.focus("#respond-R1");
    await page.keyboard.down("Meta");
    await page.keyboard.press("a");
    await page.keyboard.up("Meta");
    await page.keyboard.type("450");
    await page.keyboard.press("Tab");
    evidence.respondAfterR1Tab = await focusLabel(page);
    await page.keyboard.press("Tab");
    evidence.respondAfterR1Tab2 = await focusLabel(page);
    await page.keyboard.press("Tab");
    evidence.respondAfterR1Tab3 = await focusLabel(page);
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 350));
    evidence.respondAfterContinueFocus = await focusLabel(page);

    const btnInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("fieldset button"));
      const first = buttons[0] as HTMLElement | undefined;
      return {
        tag: first?.tagName ?? "none",
        role: first?.getAttribute("role"),
        ariaPressed: first?.getAttribute("aria-pressed"),
        count: buttons.length,
        labels: buttons.map((b) => b.textContent?.trim()),
      };
    });
    evidence.choiceControlModel = {
      ...btnInfo,
      keyboardModel:
        "BUTTON with aria-pressed (not native radio). Tab moves between choice buttons; Space/Enter activates focused button.",
    };

    const gfSteps: Step[] = [{ action: "GF-S initial", focus: await focusLabel(page) }];
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("Tab");
      gfSteps.push({ action: `Tab to choice ${i + 2}`, focus: await focusLabel(page) });
    }
    await page.keyboard.press("Tab");
    gfSteps.push({ action: "Tab to Consistently / always", focus: await focusLabel(page) });
    await page.keyboard.press("Space");
    gfSteps.push({
      action: "Space select",
      focus: await focusLabel(page),
      selectedValue: await page.evaluate(() => {
        const sel = Array.from(document.querySelectorAll("fieldset button")).find(
          (b) => (b as HTMLButtonElement).getAttribute("aria-pressed") === "true",
        );
        return sel?.textContent?.trim() ?? "";
      }),
    });
    await page.keyboard.press("Tab");
    gfSteps.push({ action: "Tab after select", focus: await focusLabel(page) });
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 350));
    gfSteps.push({ action: "Enter Continue", focus: await focusLabel(page) });
    evidence.gfScreeningKeyboardModel = gfSteps;

    await fastForwardToGate(page);
    await page.focus("#gate-first-name");
    const gateInvalid: Step[] = [{ action: "focus first name", focus: await focusLabel(page) }];
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press("Tab");
      gateInvalid.push({ action: `Tab ${i + 1}`, focus: await focusLabel(page) });
    }
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 350));
    gateInvalid.push({ action: "Enter submit empty", focus: await focusLabel(page) });
    evidence.afterInvalidGateSubmitFocus = gateInvalid;

    await page.goto(`${BASE}/assessment`, { waitUntil: "domcontentloaded" });
    await fastForwardToGate(page);
    const smsSteps: Step[] = [];
    await page.focus("#gate-first-name");
    smsSteps.push({ action: "focus #gate-first-name", focus: await focusLabel(page) });
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press("Tab");
      smsSteps.push({ action: `Tab ${i + 1}`, focus: await focusLabel(page) });
    }
    smsSteps.push({
      action: "before Space",
      focus: await focusLabel(page),
      selectedValue: String(await page.$eval('input[type="checkbox"]', (el) => (el as HTMLInputElement).checked)),
    });
    await page.keyboard.press("Space");
    smsSteps.push({
      action: "Space on",
      focus: await focusLabel(page),
      selectedValue: String(await page.$eval('input[type="checkbox"]', (el) => (el as HTMLInputElement).checked)),
    });
    await page.keyboard.press("Space");
    smsSteps.push({
      action: "Space off",
      focus: await focusLabel(page),
      selectedValue: String(await page.$eval('input[type="checkbox"]', (el) => (el as HTMLInputElement).checked)),
    });
    evidence.gateSmsToggleSequence = smsSteps;

    await page.goto(`${BASE}/assessment`, { waitUntil: "domcontentloaded" });
    await fastForwardToGate(page);
    await page.focus("#gate-first-name");
    await page.keyboard.type("Alex");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Testowner");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Owner QA Fake HVAC Co");
    await page.keyboard.press("Tab");
    await page.keyboard.type("owner-qa-fake@example.invalid");
    await page.keyboard.press("Tab");
    await page.keyboard.type("5550100199");
    await page.keyboard.press("Tab");
    evidence.beforeSubmitSmsCheckbox = await focusLabel(page);
    await page.keyboard.press("Tab");
    evidence.beforeSubmitButton = await focusLabel(page);
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 2000));
    evidence.afterValidSubmitFocus = await focusLabel(page);

    await page.evaluate(() => {
      (document.querySelector('[data-testid="assessment-report-download"]') as HTMLButtonElement | null)?.focus();
    });
    evidence.beforeReportDownloadFocus = await focusLabel(page);
  } finally {
    await browser.close();
    stopAssessmentBrowserServer();
    await stopRedisStub();
  }

  mkdirSync(join(REPO_ROOT, "review-artifacts/phase2"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ out: OUT }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
