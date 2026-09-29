/**
 * Full edge-auth coverage probe (deployed). Never logs passwords or Authorization secrets.
 */
const deployUrl = process.env.PHASE2_NETLIFY_OWNER_QA_PROBE_DEPLOY_URL?.replace(/\/$/, "");
const siteUrl = (
  process.env.PHASE2_NETLIFY_OWNER_QA_PROBE_SITE_URL ?? "https://624voice-phase2-owner-qa.netlify.app"
).replace(/\/$/, "");
const password = process.env.NETLIFY_PREVIEW_PASSWORD?.trim();
const user = process.env.NETLIFY_PREVIEW_BASIC_AUTH_USER?.trim() || "owner-qa";
const serverFnPath =
  process.env.PHASE2_NETLIFY_SUBMIT_SERVER_FN_PATH?.trim() ||
  "/_serverFn/8e7258fe472ce68ca508b91bb5c63e8caf68dcf8eb30e67aeffd7d0d20c13db2";

if (!password) {
  console.error("NETLIFY_PREVIEW_PASSWORD required");
  process.exit(1);
}

const validAuth = Buffer.from(`${user}:${password}`).toString("base64");
const wrongUserAuth = Buffer.from(`not-${user}:${password}`).toString("base64");
const wrongPassAuth = Buffer.from(`${user}:not-the-password`).toString("base64");

type ProbeCase = {
  id: string;
  classification: string;
  hostname: string;
  path: string;
  headers?: Record<string, string>;
};

function hostCases(hostname: string): ProbeCase[] {
  const base = (path: string, headers?: Record<string, string>) => ({
    hostname,
    path,
    headers,
  });
  return [
    { id: "no_authorization", classification: "No Authorization header", ...base("/") },
    {
      id: "wrong_username",
      classification: "Wrong username",
      ...base("/", { Authorization: `Basic ${wrongUserAuth}` }),
    },
    {
      id: "wrong_password",
      classification: "Wrong password",
      ...base("/", { Authorization: `Basic ${wrongPassAuth}` }),
    },
    {
      id: "correct_credentials",
      classification: "Correct credentials",
      ...base("/", { Authorization: `Basic ${validAuth}` }),
    },
    {
      id: "missing_basic_prefix",
      classification: "Missing Basic prefix",
      ...base("/", { Authorization: validAuth }),
    },
    {
      id: "wrong_scheme",
      classification: "Wrong authentication scheme",
      ...base("/", { Authorization: `Digest ${validAuth}` }),
    },
    {
      id: "malformed_base64",
      classification: "Malformed Base64",
      ...base("/", { Authorization: "Basic !!!not-base64!!!" }),
    },
    {
      id: "decoded_without_colon",
      classification: "Decoded payload without colon",
      ...base("/", { Authorization: `Basic ${Buffer.from("nocolonpayload").toString("base64")}` }),
    },
    {
      id: "header_name_casing",
      classification: "Header-name casing variation",
      ...base("/", { AUTHORIZATION: `Basic ${validAuth}` }),
    },
    {
      id: "scheme_casing",
      classification: "Scheme casing variation",
      ...base("/", { Authorization: `basic ${validAuth}` }),
    },
    {
      id: "leading_trailing_whitespace",
      classification: "Leading/trailing whitespace on Authorization",
      ...base("/", { Authorization: `  Basic ${validAuth}  ` }),
    },
    {
      id: "direct_api_health_no_auth",
      classification: "Direct /api/health without auth",
      ...base("/api/health"),
    },
    {
      id: "direct_api_health_auth",
      classification: "Direct /api/health with auth",
      ...base("/api/health", { Authorization: `Basic ${validAuth}` }),
    },
    {
      id: "direct_api_audit_no_auth",
      classification: "Direct /api/phase2-owner-qa-audit without auth",
      ...base("/api/phase2-owner-qa-audit"),
    },
    {
      id: "direct_api_audit_auth",
      classification: "Direct /api/phase2-owner-qa-audit with auth",
      ...base("/api/phase2-owner-qa-audit", { Authorization: `Basic ${validAuth}` }),
    },
    {
      id: "direct_server_fn_no_auth",
      classification: "Direct TanStack server-function POST without auth",
      ...base(serverFnPath),
    },
    {
      id: "direct_server_fn_auth",
      classification: "Direct TanStack server-function POST with auth",
      ...base(serverFnPath, { Authorization: `Basic ${validAuth}` }),
    },
    {
      id: "direct_report_no_auth",
      classification: "Direct report route without auth",
      ...base("/assessment-report/0000000000000000000000000000000000000000000000000000000001"),
    },
    {
      id: "direct_report_auth",
      classification: "Direct report route with auth",
      ...base("/assessment-report/0000000000000000000000000000000000000000000000000000000001", {
        Authorization: `Basic ${validAuth}`,
      }),
    },
    {
      id: "direct_static_no_auth",
      classification: "Direct static asset without auth",
      ...base("/logo.png"),
    },
    {
      id: "direct_static_auth",
      classification: "Direct static asset with auth",
      ...base("/logo.png", { Authorization: `Basic ${validAuth}` }),
    },
    {
      id: "trailing_slash_bypass",
      classification: "Trailing-slash path variant without auth",
      ...base("//api//health"),
    },
    {
      id: "encoded_path_bypass",
      classification: "Path-encoding bypass attempt without auth",
      ...base("/%61ssessment"),
    },
  ];
}

const hostnames: { label: string; url: string }[] = [];
if (deployUrl) hostnames.push({ label: "deploy_specific", url: deployUrl });
if (siteUrl) hostnames.push({ label: "site_default", url: siteUrl });

async function runCase(c: ProbeCase): Promise<Record<string, unknown>> {
  const url = `${c.hostname}${c.path}`;
  const method = c.path.includes("_serverFn") ? "POST" : "GET";
  const headers: Record<string, string> = { ...(c.headers ?? {}) };
  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? "{}" : undefined,
    redirect: "manual",
  });
  const headerPick = {
    "www-authenticate": res.headers.get("www-authenticate"),
    "x-robots-tag": res.headers.get("x-robots-tag"),
    "retry-after": res.headers.get("retry-after"),
    "content-type": res.headers.get("content-type"),
  };
  let bodySample: string | number = res.status;
  if (res.status === 401 || res.status === 429) {
    bodySample = (await res.text()).slice(0, 100);
  } else if (res.status === 200 && (headerPick["content-type"] ?? "").includes("html")) {
    bodySample = "html";
  }
  return {
    id: c.id,
    classification: c.classification,
    hostname: c.hostname,
    path: c.path,
    method,
    status: res.status,
    headers: headerPick,
    bodySample,
  };
}

const results = [];
for (const host of hostnames) {
  for (const c of hostCases(host.url)) {
    results.push(await runCase(c));
  }
}

console.log(JSON.stringify({ hostnames: hostnames.map((h) => h.url), results }, null, 2));

const leaks = results.filter((r) => {
  const needsAuth =
    !String(r.classification).includes("with auth") &&
    !String(r.classification).includes("Correct credentials");
  if (!needsAuth) return false;
  return r.status === 200 && (r.bodySample === "html" || r.method === "GET");
});
if (leaks.length > 0) {
  console.error(JSON.stringify({ authBypassLeaks: leaks }, null, 2));
  process.exit(1);
}
