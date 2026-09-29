/**
 * Browser-driven smoke against protected Netlify owner-QA preview.
 *
 * Required:
 *   PHASE2_NETLIFY_OWNER_QA_SMOKE_URL
 *   NETLIFY_PREVIEW_PASSWORD
 * Optional:
 *   NETLIFY_PREVIEW_BASIC_AUTH_USER (default owner-qa)
 */
const baseUrl = process.env.PHASE2_NETLIFY_OWNER_QA_SMOKE_URL?.replace(/\/$/, "");
const password = process.env.NETLIFY_PREVIEW_PASSWORD?.trim();
const basicUser = process.env.NETLIFY_PREVIEW_BASIC_AUTH_USER?.trim() || "owner-qa";

const FORBIDDEN_HOST_PATTERNS = [
  /twilio\.com/i,
  /sendgrid\.net/i,
  /api\.sendgrid\.com/i,
  /upstash\.io/i,
  /openai\.com/i,
  /googleapis\.com/i,
  /vapi\.ai/i,
  /segment\.(io|com)/i,
  /posthog\.com/i,
  /mixpanel\.com/i,
  /hubspot\.com/i,
  /salesforce\.com/i,
  /api\.anthropic\.com/i,
];

const ALLOWED_THIRD_PARTY = [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i];

function isForbiddenOutbound(url: string, origin: string): boolean {
  if (url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:")) {
    return false;
  }
  if (ALLOWED_THIRD_PARTY.some((p) => p.test(url))) return false;
  return FORBIDDEN_HOST_PATTERNS.some((p) => p.test(url));
}

async function fetchAudit(origin: string): Promise<Record<string, unknown>> {
  const auth = Buffer.from(`${basicUser}:${password}`).toString("base64");
  const res = await fetch(`${origin}/api/phase2-owner-qa-audit`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Audit endpoint failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

async function main(): Promise<void> {
  if (!baseUrl || !password) {
    console.error("PHASE2_NETLIFY_OWNER_QA_SMOKE_URL and NETLIFY_PREVIEW_PASSWORD are required");
    process.exit(1);
  }

  process.env.BROWSER_JOURNEY_BASE_URL = baseUrl;
  process.env.BROWSER_JOURNEY_SUBMIT_TIMEOUT_MS = "120000";

  const { clickButtonMatching, fastForwardToGate, launchAssessmentBrowser } = await import(
    "../../src/browser-journey/assessmentBrowserJourneySupport"
  );

  const forbiddenRequests: string[] = [];
  const browser = await launchAssessmentBrowser();
  const page = await browser.newPage();
  await page.authenticate({ username: basicUser, password });
  await page.setViewport({ width: 1280, height: 900 });
  page.setDefaultTimeout(120_000);
  page.setDefaultNavigationTimeout(120_000);

  page.on("request", (req) => {
    const url = req.url();
    if (isForbiddenOutbound(url, baseUrl)) forbiddenRequests.push(url);
  });

  let reportTokenFromNetwork: string | null = null;
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/_serverFn/") || response.status() !== 200) return;
    try {
      const text = await response.text();
      const match = text.match(/"reportToken"\s*:\s*"([^"]+)"/);
      if (match?.[1]) reportTokenFromNetwork = match[1];
    } catch {
      /* ignore */
    }
  });

  await page.goto(`${baseUrl}/assessment`, { waitUntil: "networkidle0", timeout: 120_000 });
  await fastForwardToGate(page);
  const uniqueSuffix = crypto.randomUUID().replace(/\D/g, "").slice(0, 6).padEnd(6, "0");
  await page.type("#gate-first-name", "Pat");
  await page.type("#gate-last-name", "Lee");
  await page.type("#gate-business", "Pat Plumbing");
  await page.type("#gate-email", `pat.browser.${uniqueSuffix}@example.invalid`);
  await page.type("#gate-phone", `555010${uniqueSuffix}`);
  await clickButtonMatching(page, "See My Full Results");
  await page.waitForFunction(
    () => /Your priority areas/i.test(document.body.innerText),
    { timeout: 120_000 },
  );
  await page.waitForSelector('[data-testid="assessment-report-download"]', {
    timeout: 60_000,
  });

  const reportUrlFromDom = await page.$eval(
    '[data-testid="assessment-report-download"]',
    (el) => el.getAttribute("data-report-url") ?? "",
  );
  const tokenFromUrl = reportUrlFromDom.match(/\/assessment-report\/([^/?#]+)/)?.[1] ?? null;
  if (tokenFromUrl) reportTokenFromNetwork = tokenFromUrl;

  if (!reportTokenFromNetwork) {
    throw new Error("Expected report token in data-report-url after browser submit");
  }

  let auditSnapshot: Record<string, unknown> | null = null;
  try {
    auditSnapshot = await fetchAudit(baseUrl);
  } catch {
    auditSnapshot = { note: "audit_unavailable_or_cold_instance" };
  }

  const reportUrl = await page.$eval(
    '[data-testid="assessment-report-download"]',
    (el) => el.getAttribute("data-report-url") ?? "",
  );
  const firstResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes("/assessment-report/"),
    { timeout: 120_000 },
  );
  await page.click('[data-testid="assessment-report-download"]');
  const firstResponse = await firstResponsePromise;
  const firstReportStatus = firstResponse.status();
  if (firstReportStatus !== 503) {
    throw new Error(`Expected first report download 503 (got ${firstReportStatus})`);
  }
  await page.waitForSelector('[role="alert"]', { timeout: 60_000 });

  const secondResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes("/assessment-report/"),
    { timeout: 120_000 },
  );
  await page.click('[aria-label="Try downloading assessment report again"]');
  const secondResponse = await secondResponsePromise;
  const secondReportStatus = secondResponse.status();
  const secondContentType = secondResponse.headers()["content-type"] ?? "";
  const secondPdfBytes =
    secondReportStatus === 200 && secondContentType.includes("pdf")
      ? (await secondResponse.buffer()).byteLength
      : 0;
  if (secondReportStatus !== 200 || secondPdfBytes < 1000) {
    throw new Error(
      `Expected second report PDF 200 with bytes (got status=${secondReportStatus} bytes=${secondPdfBytes})`,
    );
  }

  await browser.close();

  const result = {
    ok: true,
    baseUrl,
    submitVia: "browser_ui",
    reportTokenPresent: Boolean(reportTokenFromNetwork),
    auditSnapshot,
    reportUrl,
    firstReportStatus,
    secondReportStatus,
    secondReportPdfBytes: secondPdfBytes,
    forbiddenOutboundRequestCount: forbiddenRequests.length,
    forbiddenOutboundSample: forbiddenRequests.slice(0, 5),
    deployContext: auditSnapshot?.deployContext ?? null,
    boundaryActive: auditSnapshot?.boundaryActive ?? null,
    inMemoryLeadCount: auditSnapshot?.inMemoryLeadCount ?? null,
  };

  console.log(JSON.stringify(result, null, 2));

  if (forbiddenRequests.length > 0) {
    throw new Error(`Forbidden outbound provider requests observed: ${forbiddenRequests.length}`);
  }
}

try {
  await main();
  process.exit(0);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
