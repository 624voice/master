/**
 * Smoke test for Phase 2 Vercel Preview owner QA deployment.
 *
 * Usage:
 *   PHASE2_VERCEL_OWNER_QA_SMOKE_URL=https://... \
 *   VERCEL_DEPLOYMENT_PROTECTION_BYPASS=... (if protection enabled) \
 *   bun run scripts/phase2/vercel-owner-qa-smoke.ts
 */
const baseUrl = process.env.PHASE2_VERCEL_OWNER_QA_SMOKE_URL?.replace(/\/$/, "");
if (!baseUrl) {
  console.error("PHASE2_VERCEL_OWNER_QA_SMOKE_URL is required");
  process.exit(1);
}

const bypass = process.env.VERCEL_DEPLOYMENT_PROTECTION_BYPASS?.trim();

function smokeHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "text/html,application/json",
  };
  if (bypass) {
    headers["x-vercel-protection-bypass"] = bypass;
  }
  return headers;
}

async function fetchText(path: string): Promise<{ status: number; text: string; headers: Headers }> {
  const res = await fetch(`${baseUrl}${path}`, { headers: smokeHeaders() });
  return { status: res.status, text: await res.text(), headers: res.headers };
}

async function main(): Promise<void> {
  const home = await fetchText("/");
  if (home.status !== 200) {
    throw new Error(`Home failed: ${home.status}`);
  }
  if (!home.text.includes("624 Voice")) {
    throw new Error("Home missing 624 Voice branding");
  }

  const assessment = await fetchText("/assessment");
  if (assessment.status !== 200) {
    throw new Error(`Assessment route failed: ${assessment.status}`);
  }

  console.log(JSON.stringify({ ok: true, baseUrl, homeStatus: home.status, assessmentStatus: assessment.status }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
