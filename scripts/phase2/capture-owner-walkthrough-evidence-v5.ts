/**
 * Captures keyboard focus evidence for Phase 2 owner walkthrough v5.
 * Automation supplement only — does not satisfy A11Y-090 human attestation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "puppeteer-core";
import {
  buildAssessmentBrowserServer,
  ensureAssessmentBrowserBuild,
  launchAssessmentBrowser,
  stopAssessmentBrowserServer,
  stopRedisStub,
  waitForServer,
} from "../../src/browser-journey/assessmentBrowserJourneySupport";
import {
  formatFocusDescriptor,
  readFocused,
  resetFocusFromPageLoad,
  type FocusDescriptor,
} from "./ownerFocusOrderSupport";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(REPO_ROOT, "review-artifacts/phase2/owner-walkthrough-evidence-v5.json");
const BASE = "http://127.0.0.1:3000";

type Transition = {
  screenBefore: string;
  focusBefore: FocusDescriptor;
  key: string;
  screenAfter: string;
  focusAfter: FocusDescriptor;
  selectedValue?: string;
};

type StepRecord = {
  key: string;
  focus: FocusDescriptor;
  selectedValue?: string;
};

async function screenLabel(page: Page): Promise<string> {
  return page.evaluate(() => {
    const h1 = document.querySelector("h1")?.textContent?.trim();
    const legend = document.querySelector("fieldset legend")?.textContent?.trim();
    if (legend) return legend.slice(0, 120);
    if (h1) return h1.slice(0, 120);
    return document.title;
  });
}

async function recordTransition(
  page: Page,
  key: string,
  screenBefore: string,
  focusBefore: FocusDescriptor,
): Promise<Transition> {
  if (key.startsWith("Arrow")) {
    await page.keyboard.press(key as "ArrowDown");
  } else if (key === "Enter" || key === "Space" || key === "Escape") {
    await page.keyboard.press(key);
  } else if (key === "Shift+Tab") {
    await page.keyboard.down("Shift");
    await page.keyboard.press("Tab");
    await page.keyboard.up("Shift");
  } else if (key === "Tab") {
    await page.keyboard.press("Tab");
  } else {
    throw new Error(`Unsupported key: ${key}`);
  }
  await new Promise((r) => setTimeout(r, key === "Enter" ? 400 : 150));
  const focusAfter = await readFocused(page);
  const screenAfter = await screenLabel(page);
  let selectedValue: string | undefined;
  if (focusAfter.tag === "SELECT") {
    selectedValue = focusAfter.name;
  } else if (focusAfter.tag === "BUTTON") {
    const pressed = await page.evaluate(() => {
      const el = document.activeElement as HTMLButtonElement | null;
      return el?.getAttribute("aria-pressed") === "true" ? el.textContent?.trim() : null;
    });
    if (pressed) selectedValue = pressed;
  }
  return { screenBefore, focusBefore, key, screenAfter, focusAfter, selectedValue };
}

async function captureHeaderRoutes(page: Page): Promise<Record<string, unknown>> {
  const routes = [
    "/",
    "/what-we-do",
    "/how-we-work",
    "/demo",
    "/about",
    "/contact",
    "/does-not-exist-404",
    "/assessment",
  ];
  const sharedExpected = [
    "What We Do",
    "How We Work",
    "Live Demo",
    "Free Assessment",
    "About",
    "Book Your AI Growth Systems Consultation",
  ];
  const routeReports: Array<Record<string, unknown>> = [];

  for (const path of routes) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 300));
    await resetFocusFromPageLoad(page);
    const headerSequence: FocusDescriptor[] = [];
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      headerSequence.push(await readFocused(page));
    }
    const names = headerSequence.map((d) => d.name);
    routeReports.push({
      route: path,
      focusableHeaderElementsInOrder: names,
      tabCount: 6,
      matchesSharedSequence: names.every((n, i) => n.includes(sharedExpected[i] ?? "")),
      sharedSequenceExpected: sharedExpected,
    });
  }
  return { sharedHeaderSequenceId: "Section 9 — Standard Desktop Header Sequence", sharedExpected, routeReports };
}

async function captureBpControls(page: Page): Promise<Record<string, unknown>> {
  await page.goto(`${BASE}/assessment`, { waitUntil: "domcontentloaded" });
  await resetFocusFromPageLoad(page);
  for (let i = 0; i < 7; i += 1) await page.keyboard.press("Tab");
  const bp1Meta = await page.evaluate(() => {
    const el = document.querySelector("#assessment-bp1") as HTMLSelectElement | null;
    if (!el) return null;
    return {
      tag: el.tagName,
      type: el.getAttribute("type"),
      role: el.getAttribute("role"),
      accessibleName: document.querySelector('label[for="assessment-bp1"]')?.textContent?.trim() ?? "",
      initialValue: el.value,
      options: Array.from(el.options).map((o) => o.text.trim()),
    };
  });
  const bp1Steps: StepRecord[] = [{ key: "(initial focus on trade select)", focus: await readFocused(page) }];
  const t1 = await recordTransition(page, "ArrowDown", "BP1", bp1Steps[0]!.focus);
  bp1Steps.push({ key: "ArrowDown", focus: t1.focusAfter, selectedValue: t1.selectedValue });
  const t2 = await recordTransition(page, "ArrowDown", "BP1", t1.focusAfter);
  bp1Steps.push({ key: "ArrowDown", focus: t2.focusAfter, selectedValue: t2.selectedValue });
  const t3 = await recordTransition(page, "ArrowDown", "BP1", t2.focusAfter);
  bp1Steps.push({ key: "ArrowDown", focus: t3.focusAfter, selectedValue: t3.selectedValue });
  const t4 = await recordTransition(page, "Tab", "BP1", t3.focusAfter);
  bp1Steps.push({ key: "Tab (leave select)", focus: t4.focusAfter });
  const t5 = await recordTransition(page, "Enter", "BP1 Continue", t4.focusAfter);
  const bp1ContinueTransition = t5;

  await page.waitForSelector("#assessment-bp2", { timeout: 10000 });
  const bp2Meta = await page.evaluate(() => {
    const el = document.querySelector("#assessment-bp2") as HTMLSelectElement | null;
    if (!el) return null;
    return {
      tag: el.tagName,
      type: el.getAttribute("type"),
      role: el.getAttribute("role"),
      accessibleName: document.querySelector('label[for="assessment-bp2"]')?.textContent?.trim() ?? "",
      initialValue: el.value,
      options: Array.from(el.options).map((o) => o.text.trim()),
    };
  });
  const bp2Steps: StepRecord[] = [{ key: "(after BP1 Continue)", focus: await readFocused(page) }];
  await page.keyboard.down("Shift");
  await page.keyboard.press("Tab");
  await page.keyboard.up("Shift");
  bp2Steps.push({ key: "Shift+Tab", focus: await readFocused(page) });
  await page.keyboard.down("Shift");
  await page.keyboard.press("Tab");
  await page.keyboard.up("Shift");
  bp2Steps.push({ key: "Shift+Tab", focus: await readFocused(page) });
  const bd1 = await recordTransition(page, "ArrowDown", "BP2", bp2Steps.at(-1)!.focus);
  bp2Steps.push({ key: "ArrowDown", focus: bd1.focusAfter, selectedValue: bd1.selectedValue });
  const bd2 = await recordTransition(page, "ArrowDown", "BP2", bd1.focusAfter);
  bp2Steps.push({ key: "ArrowDown", focus: bd2.focusAfter, selectedValue: bd2.selectedValue });
  const bt1 = await recordTransition(page, "Tab", "BP2", bd2.focusAfter);
  bp2Steps.push({ key: "Tab", focus: bt1.focusAfter });
  const bt2 = await recordTransition(page, "Tab", "BP2", bt1.focusAfter);
  bp2Steps.push({ key: "Tab", focus: bt2.focusAfter });
  const bp2ContinueTransition = await recordTransition(page, "Enter", "BP2 Continue", bt2.focusAfter);

  return {
    bp1: { meta: bp1Meta, keyboardModel: "native SELECT — ArrowDown changes option; Tab leaves to Continue", steps: bp1Steps, continueTransition: bp1ContinueTransition },
    bp2: { meta: bp2Meta, keyboardModel: "native SELECT — Shift+Tab from body reaches select; ArrowDown changes option; Tab to Back then Continue", steps: bp2Steps, continueTransition: bp2ContinueTransition },
  };
}

async function captureRespondToGfs(page: Page): Promise<Record<string, unknown>> {
  await page.waitForSelector("#respond-R1", { timeout: 10000 });
  const respondContinueFocus = await readFocused(page);
  const backwardSteps: StepRecord[] = [{ key: "(starting Continue on respond review)", focus: respondContinueFocus }];
  let current = respondContinueFocus;
  for (let i = 0; i < 7; i += 1) {
    await page.keyboard.down("Shift");
    await page.keyboard.press("Tab");
    await page.keyboard.up("Shift");
    current = await readFocused(page);
    backwardSteps.push({ key: "Shift+Tab", focus: current });
  }
  const forwardFromR1: StepRecord[] = [];
  await page.keyboard.type("450");
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    forwardFromR1.push({ key: "Tab", focus: await readFocused(page) });
  }
  const gfsTransition = await recordTransition(page, "Enter", "Respond Continue", forwardFromR1.at(-1)!.focus);
  return { backwardFromContinueToR1: backwardSteps, forwardFromR1, respondContinueToGfs: gfsTransition };
}

async function choiceAnswerSequence(page: Page, choiceLabel: string): Promise<StepRecord[]> {
  const steps: StepRecord[] = [];
  for (let i = 0; i < 7; i += 1) {
    await page.keyboard.press("Tab");
    steps.push({ key: "Tab", focus: await readFocused(page) });
  }
  while (true) {
    const f = await readFocused(page);
    if (f.name.includes(choiceLabel)) break;
    await page.keyboard.press("Tab");
    steps.push({ key: "Tab", focus: await readFocused(page) });
  }
  await page.keyboard.press("Space");
  steps.push({
    key: "Space",
    focus: await readFocused(page),
    selectedValue: choiceLabel,
  });
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press("Tab");
    steps.push({ key: "Tab", focus: await readFocused(page) });
  }
  await page.keyboard.press("Enter");
  steps.push({ key: "Enter", focus: await readFocused(page) });
  await new Promise((r) => setTimeout(r, 350));
  steps[steps.length - 1] = { key: "Enter", focus: await readFocused(page) };
  return steps;
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
    evidence.headerRoutes = await captureHeaderRoutes(page);
    evidence.bpControls = await captureBpControls(page);
    evidence.respondPath = await captureRespondToGfs(page);

    evidence.choiceControlModel = {
      tag: "BUTTON",
      type: "button",
      role: null,
      ariaPressed: true,
      keyboardModel: "Tab between choice buttons; Space selects focused button; Tab to Not sure, Back, Continue; Enter activates Continue",
    };

    const gfHigh = await choiceAnswerSequence(page, "Consistently / always");
    evidence.gfScreeningHigh = gfHigh;
    const gfF1 = await choiceAnswerSequence(page, "Mostly / often");
    evidence.gfF1Answer = gfF1;
    const gfF2 = await choiceAnswerSequence(page, "Not at all / rarely");
    evidence.gfF2Answer = gfF2;
    const gfF3 = await choiceAnswerSequence(page, "Not at all / rarely");
    evidence.gfF3Answer = gfF3;
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
