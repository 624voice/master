/**
 * Probe edge Basic Auth coverage on deployed owner-QA preview (no secrets logged).
 */
const baseUrl = process.env.PHASE2_NETLIFY_OWNER_QA_PROBE_URL?.replace(/\/$/, "");
const password = process.env.NETLIFY_PREVIEW_PASSWORD?.trim();
const user = process.env.NETLIFY_PREVIEW_BASIC_AUTH_USER?.trim() || "owner-qa";

if (!baseUrl || !password) {
  console.error("PHASE2_NETLIFY_OWNER_QA_PROBE_URL and NETLIFY_PREVIEW_PASSWORD required");
  process.exit(1);
}

const auth = Buffer.from(`${user}:${password}`).toString("base64");

type Case = { name: string; path: string; headers?: Record<string, string> };

const cases: Case[] = [
  { name: "no_credentials_home", path: "/" },
  {
    name: "wrong_credentials_home",
    path: "/",
    headers: {
      Authorization: `Basic ${Buffer.from("wrong:wrong").toString("base64")}`,
    },
  },
  { name: "malformed_auth_scheme", path: "/", headers: { Authorization: "Bearer x" } },
  { name: "malformed_base64", path: "/", headers: { Authorization: "Basic !!!" } },
  { name: "correct_home", path: "/", headers: { Authorization: `Basic ${auth}` } },
  { name: "correct_api_health", path: "/api/health", headers: { Authorization: `Basic ${auth}` } },
  { name: "correct_api_audit", path: "/api/phase2-owner-qa-audit", headers: { Authorization: `Basic ${auth}` } },
  { name: "correct_static_logo", path: "/logo.png", headers: { Authorization: `Basic ${auth}` } },
  { name: "correct_assessment", path: "/assessment", headers: { Authorization: `Basic ${auth}` } },
  { name: "no_credentials_api", path: "/api/health" },
  { name: "no_credentials_logo", path: "/logo.png" },
];

async function probe(c: Case): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}${c.path}`, {
    headers: c.headers,
    redirect: "manual",
  });
  const bodySample =
    res.status === 401 || res.status === 429
      ? (await res.text()).slice(0, 80)
      : res.status === 200 && (res.headers.get("content-type") ?? "").includes("html")
        ? "html"
        : res.status;
  return {
    case: c.name,
    path: c.path,
    status: res.status,
    wwwAuthenticate: res.headers.get("www-authenticate") ?? null,
    bodySample,
  };
}

const results = [];
for (const c of cases) {
  results.push(await probe(c));
}

console.log(JSON.stringify({ baseUrl, results }, null, 2));

const noCred = results.filter((r) => String(r.case).startsWith("no_credentials"));
if (noCred.some((r) => r.status === 200 && r.bodySample === "html")) {
  process.exit(1);
}
