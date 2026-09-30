/**
 * Deployed edge rate-limit probe. Uses wrong credentials only (never prints real password).
 */
const baseUrl = process.env.PHASE2_NETLIFY_OWNER_QA_PROBE_URL?.replace(/\/$/, "");
const runWindowReset = process.env.PHASE2_EDGE_RATE_PROBE_WINDOW_RESET === "1";

if (!baseUrl) {
  console.error("PHASE2_NETLIFY_OWNER_QA_PROBE_URL required");
  process.exit(1);
}

const wrongAuth = Buffer.from("rate-limit-probe:wrong").toString("base64");

async function attempt(label: string, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(`${baseUrl}/`, {
    headers: {
      Authorization: `Basic ${wrongAuth}`,
      ...extraHeaders,
    },
    redirect: "manual",
  });
  return {
    label,
    status: res.status,
    retryAfter: res.headers.get("retry-after"),
    wwwAuthenticate: res.headers.get("www-authenticate"),
    xRobotsTag: res.headers.get("x-robots-tag"),
    bodySample: (await res.text()).slice(0, 80),
  };
}

const belowThreshold = [];
for (let i = 1; i <= 5; i += 1) {
  belowThreshold.push(await attempt(`below_threshold_${i}`));
}

const toBlock = [];
for (let i = 1; i <= 35; i += 1) {
  toBlock.push(await attempt(`toward_block_${i}`));
}

const blocked = toBlock.find((r) => r.status === 429) ?? null;

const spoofedForward = [];
for (let i = 1; i <= 5; i += 1) {
  spoofedForward.push(
    await attempt(`spoofed_x_forwarded_for_${i}`, {
      "X-Forwarded-For": `203.0.113.${i}`,
    }),
  );
}

const spoofedNfClientIp = [];
for (let i = 1; i <= 5; i += 1) {
  spoofedNfClientIp.push(
    await attempt(`spoofed_x_nf_client_connection_ip_${i}`, {
      "x-nf-client-connection-ip": `198.51.100.${i}`,
    }),
  );
}

let afterWindowReset: Awaited<ReturnType<typeof attempt>> | null = null;
if (runWindowReset && blocked) {
  await new Promise((resolve) => setTimeout(resolve, 65_000));
  afterWindowReset = await attempt("after_window_reset");
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      maxAttemptsConfigured: 30,
      windowMs: 60_000,
      belowThresholdSample: belowThreshold,
      blockedResponse: blocked,
      afterBlockSpoofedForwardedFor: spoofedForward,
      afterBlockSpoofedNfClientConnectionIp: spoofedNfClientIp,
      afterWindowReset,
    },
    null,
    2,
  ),
);

if (!blocked || blocked.status !== 429) {
  process.exit(1);
}
