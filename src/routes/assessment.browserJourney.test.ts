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
  activateConditionalFollowUp,
  advanceThroughUniversalSteps,
  advanceToRespondReview,
  BROWSER_JOURNEY_BASE_URL,
  buildAssessmentBrowserServer,
  clickButtonMatching,
  clickChoiceMatching,
  attachSubmitAnswerKeyCapture,
  clickDownloadReport,
  continueToTeaserFromCurrent,
  deleteReportToken,
  ensureAssessmentBrowserBuild,
  fastForwardToGate,
  fastForwardToGateWithTieAnswers,
  fastForwardToTeaser,
  fillValidLead,
  launchAssessmentBrowser,
  stopAssessmentBrowserServer,
  stopRedisStub,
  submitLeadToResults,
  waitForServer,
} from "./assessmentBrowserJourneySupport";

let browser: Browser;
let page: Page;

describe("Assessment browser journey X-JRN-DOM (fail-closed backend)", () => {
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

  test("X-JRN-DOM-11: priority ordering presentation in results DOM", async () => {
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

describe("Assessment browser journey X-JRN-DOM (safe backend)", () => {
  beforeAll(async () => {
    stopAssessmentBrowserServer();
    stopRedisStub();
    ensureAssessmentBrowserBuild();
    buildAssessmentBrowserServer({ safeBackend: true });
    await new Promise((resolve) => setTimeout(resolve, 4000));
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
    stopRedisStub();
  });

  test("X-JRN-DOM-15: rendered stale-answer removal after branch downgrade", async () => {
    await activateConditionalFollowUp(page);
    await clickButtonMatching(page, "^Continue$");
    await clickButtonMatching(page, "^Back$");
    await clickChoiceMatching(page, "Not at all / rarely");
    await clickButtonMatching(page, "^Continue$");

    const bodyAfterDowngrade = await page.evaluate(() => document.body.innerText);
    expect(bodyAfterDowngrade).not.toMatch(/track where new leads come from/i);

    const staleControls = await page.evaluate(() => {
      const text = document.body.innerText;
      const hidden = Array.from(document.querySelectorAll('input[type="hidden"]'));
      return {
        followUpVisible: /track where new leads come from/i.test(text),
        hiddenNames: hidden.map((el) => el.getAttribute("name")).filter(Boolean),
      };
    });
    expect(staleControls.followUpVisible).toBe(false);
    expect(staleControls.hiddenNames.join(" ")).not.toMatch(/GF-F1/i);

    await continueToTeaserFromCurrent(page);
    await clickButtonMatching(page, "Unlock Full Results");
    const submitCapture = attachSubmitAnswerKeyCapture(page);
    await fillValidLead(page);
    await clickButtonMatching(page, "See My Full Results");
    const submitKeys = await submitCapture.waitForKeys();
    await page.waitForFunction(() =>
      /Your priority areas/i.test(document.body.innerText),
    );
    expect(submitKeys).not.toContain("GF-F1");
  }, 180_000);

  test("X-JRN-DOM-16: successful report access through visitor UI", async () => {
    await fastForwardToGate(page);
    await submitLeadToResults(page);
    const hasDownload = await page.evaluate(() =>
      /Download Assessment Report/i.test(document.body.innerText),
    );
    expect(hasDownload).toBe(true);

    const { access } = await clickDownloadReport(page);
    expect(access.contentType).toContain("application/pdf");
    expect(access.pdfBytes).toBeGreaterThan(1000);
  }, 180_000);

  test("X-JRN-DOM-17: repeat report access through same visitor link", async () => {
    await fastForwardToGate(page);
    await submitLeadToResults(page);
    const first = await clickDownloadReport(page);
    expect(first.access.contentType).toContain("application/pdf");

    const second = await clickDownloadReport(page);
    expect(second.access.contentType).toContain("application/pdf");
    expect(second.reportUrl).toBe(first.reportUrl);
  }, 180_000);

  test("X-JRN-DOM-18: invalid report-link UI state", async () => {
    const response = await page.goto(
      `${BROWSER_JOURNEY_BASE_URL}/assessment-report/not-a-valid-token-abc123`,
      { waitUntil: "networkidle0" },
    );
    const body = await page.evaluate(() => document.body.innerText);
    expect(response?.status()).toBe(404);
    expect(body).toBe("This assessment report link has expired or is invalid.");
    expect(body).not.toMatch(/stack|Error:|UPSTASH|Redis/i);
  }, 60_000);

  test("X-JRN-DOM-19: expired report-link UI state", async () => {
    await fastForwardToGate(page);
    await submitLeadToResults(page);
    const reportUrl = await page.evaluate(() => {
      const open = window.open;
      let captured = "";
      window.open = (url) => {
        captured = String(url ?? "");
        return null;
      };
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /Download Assessment Report/i.test(b.textContent ?? ""),
      );
      btn?.click();
      window.open = open;
      return captured;
    });
    const token = reportUrl.split("/assessment-report/")[1] ?? "";
    expect(token.length).toBeGreaterThan(10);
    await deleteReportToken(token);

    const expired = await page.goto(
      `${BROWSER_JOURNEY_BASE_URL}/assessment-report/${token}`,
      { waitUntil: "networkidle0" },
    );
    const body = await page.evaluate(() => document.body.innerText);
    expect(expired?.status()).toBe(404);
    expect(body).toBe("This assessment report link has expired or is invalid.");
  }, 180_000);

  test("X-JRN-DOM-20: retryable report failure and visitor recovery", async () => {
    await fastForwardToGate(page);
    await submitLeadToResults(page);

    const failed = await clickDownloadReport(page, {
      failFirstWith503: true,
    });
    expect(failed.access.bodyText).toMatch(/temporarily unavailable|expired or is invalid/i);
    expect(failed.access.status).toBe(503);
    expect(failed.access.attempts).toBe(1);

    expect(await page.evaluate(() => /Your priority areas/i.test(document.body.innerText))).toBe(
      true,
    );

    const recovered = await clickDownloadReport(page);
    expect(recovered.access.contentType).toContain("application/pdf");
    expect(recovered.access.pdfBytes).toBeGreaterThan(1000);
  }, 180_000);

  test("X-JRN-DOM-21: PDF access without SMS consent through rendered route", async () => {
    await fastForwardToGate(page);
    const consentDefault = await page.$eval('input[type="checkbox"]', (el) => {
      return (el as HTMLInputElement).checked;
    });
    expect(consentDefault).toBe(false);
    await submitLeadToResults(page, { smsConsent: false });
    expect(await page.evaluate(() => /Download Assessment Report/i.test(document.body.innerText))).toBe(
      true,
    );
    const { access } = await clickDownloadReport(page);
    expect(access.contentType).toContain("application/pdf");
    expect(access.pdfBytes).toBeGreaterThan(1000);
  }, 180_000);

  test("X-JRN-DOM-22: tied-priority presentation in rendered results", async () => {
    await fastForwardToGateWithTieAnswers(page);
    await submitLeadToResults(page);
    await page.waitForFunction(() => /Priority 1/i.test(document.body.innerText));
    const tieEvidence = await page.evaluate(() => {
      const tiedBadge = Array.from(document.querySelectorAll("span")).some((el) =>
        /^Tied$/i.test(el.textContent?.trim() ?? ""),
      );
      const priorityBlock = Array.from(document.querySelectorAll("ol > li")).find((li) =>
        /Priority 1/i.test(li.textContent ?? ""),
      );
      const labels = priorityBlock
        ? Array.from(priorityBlock.querySelectorAll("li span.font-semibold")).map(
            (el) => el.textContent?.trim() ?? "",
          )
        : [];
      return { tiedBadge, labels, labelCount: labels.length };
    });
    expect(tieEvidence.tiedBadge).toBe(true);
    expect(tieEvidence.labelCount).toBeGreaterThanOrEqual(2);
  }, 180_000);
});
