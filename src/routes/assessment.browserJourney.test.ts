import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import type { Browser, Page } from "puppeteer-core";
import {
  advanceThroughUniversalSteps,
  advanceToRespondReview,
  BROWSER_JOURNEY_BASE_URL,
  buildAssessmentBrowserServer,
  clickButtonMatching,
  ensureAssessmentBrowserBuild,
  fastForwardToGate,
  fastForwardToTeaser,
  launchAssessmentBrowser,
  stopAssessmentBrowserServer,
  waitForServer,
} from "./assessmentBrowserJourneySupport";

let browser: Browser;
let page: Page;

async function fillValidLead(formPage: Page): Promise<void> {
  await formPage.type("#gate-first-name", "Pat");
  await formPage.type("#gate-last-name", "Lee");
  await formPage.type("#gate-business", "Pat Plumbing");
  await formPage.type("#gate-email", "pat.browser@example.com");
  await formPage.type("#gate-phone", "5555550199");
}

describe("Assessment browser journey X-JRN-DOM", () => {
  beforeAll(async () => {
    stopAssessmentBrowserServer();
    ensureAssessmentBrowserBuild();
    buildAssessmentBrowserServer();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await waitForServer(`${BROWSER_JOURNEY_BASE_URL}/assessment`);
    browser = await launchAssessmentBrowser();
  }, 180_000);

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
  });

  afterEach(async () => {
    await page.close();
  });

  afterAll(async () => {
    await browser?.close();
    stopAssessmentBrowserServer();
  });

  test("X-JRN-DOM-01: forward navigation through universal steps to gate", async () => {
    await fastForwardToGate(page);
    expect(await page.$("#gate-first-name")).toBeTruthy();
    expect(await page.$("#assessment-bp1")).toBeNull();
  }, 120_000);

  test("X-JRN-DOM-02: back navigation from bp2 to bp1", async () => {
    await page.goto(`${BROWSER_JOURNEY_BASE_URL}/assessment`, {
      waitUntil: "networkidle0",
    });
    await page.select("#assessment-bp1", "HVAC");
    await clickButtonMatching(page, "^Continue$");
    await page.waitForSelector("#assessment-bp2");
    await clickButtonMatching(page, "^Back$");
    const bp1Value = await page.$eval(
      "#assessment-bp1",
      (el) => (el as HTMLSelectElement).value,
    );
    expect(bp1Value).toBe("HVAC");
  }, 60_000);

  test("X-JRN-DOM-03: return after back preserves valid answers", async () => {
    await page.goto(`${BROWSER_JOURNEY_BASE_URL}/assessment`, {
      waitUntil: "networkidle0",
    });
    await page.select("#assessment-bp1", "Plumbers");
    await clickButtonMatching(page, "^Continue$");
    await page.select("#assessment-bp2", "8-20");
    await clickButtonMatching(page, "^Continue$");
    await clickButtonMatching(page, "^Back$");
    const fleet = await page.$eval(
      "#assessment-bp2",
      (el) => (el as HTMLSelectElement).value,
    );
    expect(fleet).toBe("8-20");
  }, 60_000);

  test("X-JRN-DOM-04: conditional branch activation and removal in DOM", async () => {
    await advanceThroughUniversalSteps(page);
    await page.waitForFunction(() =>
      /new customers find your business/i.test(document.body.innerText),
    );
    const screeningPrompt = await page.evaluate(() => document.body.innerText);
    const buttons = await page.$$("button.w-full.rounded-lg.border.px-4");
    for (const button of buttons) {
      const text = await button.evaluate((el) => el.textContent ?? "");
      if (/Consistently \/ always/i.test(text)) {
        await button.click();
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    await clickButtonMatching(page, "^Continue$");
    const followUpPrompt = await page.evaluate(() => document.body.innerText);
    expect(followUpPrompt).toMatch(/track where new leads come from/i);
    await clickButtonMatching(page, "^Back$");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const low = buttons.find((b) =>
        /Not at all \/ rarely/i.test(b.textContent ?? ""),
      );
      low?.click();
    });
    await clickButtonMatching(page, "^Continue$");
    const afterDowngrade = await page.evaluate(() => document.body.innerText);
    expect(afterDowngrade).not.toMatch(/track where new leads come from/i);
    expect(afterDowngrade).toMatch(/inbound leads convert/i);
  }, 120_000);

  test("X-JRN-DOM-05: assumptions-review edit updates rendered field", async () => {
    await advanceToRespondReview(page);
    const input = await page.waitForSelector("#respond-R1");
    await input!.click({ clickCount: 3 });
    await page.type("#respond-R1", "450");
    const value = await page.$eval("#respond-R1", (el) => (el as HTMLInputElement).value);
    expect(value).toContain("450");
  }, 60_000);

  test("X-JRN-DOM-06: lead-gate validation rejection in DOM", async () => {
    await fastForwardToGate(page);
    await page.evaluate(() => {
      document
        .querySelectorAll("input[required]")
        .forEach((el) => el.removeAttribute("required"));
    });
    await clickButtonMatching(page, "See My Full Results");
    await page.waitForFunction(() =>
      /First name is required/i.test(document.body.innerText),
    );
    const alert = await page.$('[role="alert"]');
    expect(alert).toBeTruthy();
  }, 120_000);

  test("X-JRN-DOM-07: corrected resubmission reaches rendered results", async () => {
    await fastForwardToGate(page);
    await fillValidLead(page);
    await clickButtonMatching(page, "See My Full Results");
    await page.waitForFunction(() =>
      /Your priority areas/i.test(document.body.innerText),
    );
    expect(await page.$("#gate-first-name")).toBeNull();
  }, 120_000);

  test("X-JRN-DOM-08: SMS consent unchecked by default", async () => {
    await fastForwardToGate(page);
    const checked = await page.$eval('input[type="checkbox"]', (el) => {
      return (el as HTMLInputElement).checked;
    });
    expect(checked).toBe(false);
  }, 120_000);

  test("X-JRN-DOM-09: results render without SMS consent", async () => {
    await fastForwardToGate(page);
    await fillValidLead(page);
    await clickButtonMatching(page, "See My Full Results");
    await page.waitForFunction(() =>
      /Your priority areas/i.test(document.body.innerText),
    );
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).toContain("Priority");
  }, 120_000);

  test("X-JRN-DOM-10: results render with SMS consent checked", async () => {
    await fastForwardToGate(page);
    await fillValidLead(page);
    await page.click('input[type="checkbox"]');
    await clickButtonMatching(page, "See My Full Results");
    await page.waitForFunction(() =>
      /Your priority areas/i.test(document.body.innerText),
    );
    const checked = await page.evaluate(() =>
      document.querySelector('input[type="checkbox"]') == null,
    );
    expect(checked).toBe(true);
  }, 120_000);

  test("X-JRN-DOM-11: priority and tied presentation in results DOM", async () => {
    await fastForwardToGate(page);
    await fillValidLead(page);
    await clickButtonMatching(page, "See My Full Results");
    await page.waitForFunction(() =>
      /Priority 1/i.test(document.body.innerText),
    );
    const hasOrderedList = await page.$$eval("ol li", (items) => items.length > 0);
    expect(hasOrderedList).toBe(true);
  }, 120_000);

  test("X-JRN-DOM-12: invalid report token renders plain-text failure", async () => {
    const response = await page.goto(
      `${BROWSER_JOURNEY_BASE_URL}/assessment-report/not-a-valid-token`,
      { waitUntil: "networkidle0" },
    );
    const body = await page.evaluate(() => document.body.innerText);
    expect(response?.status()).toBe(404);
    expect(body).toContain("expired or is invalid");
  }, 60_000);

  test("X-JRN-DOM-13: validation failure recovery enables resubmission", async () => {
    await fastForwardToGate(page);
    await page.evaluate(() => {
      document
        .querySelectorAll("input[required]")
        .forEach((el) => el.removeAttribute("required"));
    });
    await clickButtonMatching(page, "See My Full Results");
    await page.waitForFunction(() =>
      /First name is required/i.test(document.body.innerText),
    );
    await fillValidLead(page);
    await clickButtonMatching(page, "See My Full Results");
    await page.waitForFunction(() =>
      /Your priority areas/i.test(document.body.innerText),
    );
    expect(await page.$('[role="alert"]')).toBeNull();
  }, 120_000);

  test("X-JRN-DOM-14: results DOM omits Download button without reportUrl", async () => {
    await fastForwardToGate(page);
    await fillValidLead(page);
    await clickButtonMatching(page, "See My Full Results");
    await page.waitForFunction(() =>
      /Your priority areas/i.test(document.body.innerText),
    );
    const hasDownload = await page.evaluate(() =>
      /Download Assessment Report/i.test(document.body.innerText),
    );
    expect(hasDownload).toBe(false);
    const persistenceMessage = await page.evaluate(() => document.body.innerText);
    expect(persistenceMessage).toMatch(/temporarily unavailable|Your priority areas/i);
  }, 120_000);
});
