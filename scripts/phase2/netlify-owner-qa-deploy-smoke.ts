/**
 * End-to-end smoke test for protected Netlify owner-QA preview.
 *
 * Required:
 *   PHASE2_NETLIFY_OWNER_QA_SMOKE_URL
 * Optional auth (never log values):
 *   NETLIFY_PREVIEW_PASSWORD (Basic auth if password protection enabled)
 *   NETLIFY_AUTH_COOKIE (Cookie header value for team-login session)
 */
import { AssessmentEngine } from "../../src/lib/assessment/engine";
import { buildAnswersPayload } from "../../src/lib/assessment/buildAnswersPayload";

const baseUrl = process.env.PHASE2_NETLIFY_OWNER_QA_SMOKE_URL?.replace(/\/$/, "");
if (!baseUrl) {
  console.error("PHASE2_NETLIFY_OWNER_QA_SMOKE_URL is required");
  process.exit(1);
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = { Accept: "text/html,application/json,*/*" };
  const password = process.env.NETLIFY_PREVIEW_PASSWORD?.trim();
  if (password) {
    headers.Authorization = `Basic ${Buffer.from(`preview:${password}`).toString("base64")}`;
  }
  const cookie = process.env.NETLIFY_AUTH_COOKIE?.trim();
  if (cookie) headers.Cookie = cookie;
  return headers;
}

async function fetchPath(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
}

async function main(): Promise<void> {
  const unauth = await fetch(baseUrl + "/");
  const unauthStatus = unauth.status;
  const unauthHtml = unauthStatus === 200 ? await unauth.text() : "";

  const home = await fetchPath("/");
  if (home.status !== 200) {
    throw new Error(`Authenticated home failed: ${home.status}`);
  }
  const homeHtml = await home.text();
  if (!homeHtml.includes("624 Voice")) {
    throw new Error("Home missing 624 Voice branding");
  }
  const robotsHeader = home.headers.get("x-robots-tag") ?? "";
  if (!robotsHeader.includes("noindex")) {
    throw new Error(`Missing X-Robots-Tag noindex (got: ${robotsHeader || "(none)"})`);
  }
  if (!homeHtml.includes('name="robots"') && !homeHtml.includes("noindex")) {
    throw new Error("Missing robots noindex meta in HTML");
  }

  const services = await fetchPath("/services", { redirect: "manual" });
  const servicesLocation = services.headers.get("location") ?? "";
  if (services.status !== 301 && services.status !== 302 && services.status !== 200) {
    throw new Error(`Unexpected /services status: ${services.status}`);
  }

  const notFound = await fetchPath("/does-not-exist-404");
  if (notFound.status !== 404 && !((await notFound.text()).includes("Page not found"))) {
    throw new Error("404 page not rendered");
  }

  const assessment = await fetchPath("/assessment");
  if (assessment.status !== 200) {
    throw new Error(`Assessment page failed: ${assessment.status}`);
  }

  const engine = new AssessmentEngine();
  engine.onScreeningAnswered("GF", 0);
  engine.setAnswer("CV-S", 0);
  engine.setAnswer("RG-S", 0);
  engine.setAnswer("RM-S", 0);
  engine.setAnswer("MI-S", 0);
  const answers = buildAnswersPayload("HVAC", "3-7", { monthlyCalls: 450 }, engine);

  const { submitAssessmentLeadHandler } = await import(
    "../../src/server/submitAssessmentLead.server"
  );
  const handlerResult = await submitAssessmentLeadHandler({
    lead: {
      firstName: "Alex",
      lastName: "Testowner",
      businessName: "Owner QA Fake HVAC Co",
      email: `owner-qa-fake-${Date.now()}@example.invalid`,
      phone: "5550100199",
    },
    smsConsent: false,
    idempotencyKey: `smoke-${Date.now()}`,
    answers,
  });

  const reportToken = handlerResult.reportToken;
  let firstReportStatus: number | null = null;
  let secondReportStatus: number | null = null;
  if (reportToken) {
    const first = await fetchPath(`/assessment-report/${reportToken}`);
    firstReportStatus = first.status;
    const second = await fetchPath(`/assessment-report/${reportToken}`);
    secondReportStatus = second.status;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        unauthStatus,
        unauthLooksLikeFullApp:
          unauthStatus === 200 && unauthHtml.includes("624 Voice") && unauthHtml.length > 5000,
        robotsHeader,
        servicesStatus: services.status,
        servicesLocation,
        assessmentStatus: assessment.status,
        handlerSubmitOk: handlerResult.ok === true,
        reportTokenPresent: Boolean(reportToken),
        firstReportStatus,
        secondReportStatus,
        note: "Handler path uses in-process adapters when boundary env is set in this shell; deployed boundary verified separately via route checks.",
      },
      null,
      2,
    ),
  );

  if (unauthStatus === 200 && unauthHtml.includes("624 Voice") && unauthHtml.length > 5000) {
    throw new Error("Unauthenticated request received full application HTML (protection failed)");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
