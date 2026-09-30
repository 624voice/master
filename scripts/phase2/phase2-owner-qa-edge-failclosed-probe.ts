/**
 * Probe edge gate misconfiguration vs open preview (no secrets required).
 * - both_missing: public preview with noindex (200)
 * - username_missing | password_missing: partial creds → 503
 */
const baseUrl = process.env.PHASE2_NETLIFY_OWNER_QA_PROBE_URL?.replace(/\/$/, "");
const scenario = process.env.PHASE2_EDGE_FAILCLOSED_SCENARIO ?? "unknown";

if (!baseUrl) {
  console.error("PHASE2_NETLIFY_OWNER_QA_PROBE_URL required");
  process.exit(1);
}

const paths = ["/", "/assessment", "/api/health", "/logo.png"];

const results = [];
for (const path of paths) {
  const res = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  results.push({
    scenario,
    path,
    status: res.status,
    xRobotsTag: res.headers.get("x-robots-tag"),
    wwwAuthenticate: res.headers.get("www-authenticate"),
    bodySample: (await res.text()).slice(0, 100),
  });
}

console.log(JSON.stringify({ baseUrl, scenario, results }, null, 2));

const expectOpenPreview = scenario === "both_missing";
const bad = results.filter((r) => {
  const hasNoindex = String(r.xRobotsTag ?? "").includes("noindex");
  if (expectOpenPreview) {
    return r.status !== 200 || !hasNoindex || r.wwwAuthenticate;
  }
  return r.status !== 503 || !hasNoindex;
});
if (bad.length > 0) process.exit(1);
