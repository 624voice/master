import "./safePreviewPrepareNetworkGuard.ts";

export type EgressProbeResult = {
  label: string;
  url: string;
  hostname: string;
  networkApi: "fetch";
  outcome: "policy_blocked" | "unexpected_success" | "unexpected_error";
  errorMessage: string | null;
  policyBlockMarker: "Prep egress blocked";
};

const BLOCKED_INTEGRATION_DESTINATIONS = [
  { label: "Twilio", url: "https://api.twilio.com/2010-04-01/Accounts" },
  { label: "SendGrid", url: "https://api.sendgrid.com/v3/mail/send" },
  { label: "Upstash", url: "https://us1-example.upstash.io/ping" },
  { label: "Google", url: "https://www.google.com/generate_204" },
  { label: "CRM webhook", url: "https://hooks.zapier.com/hooks/catch/000000/phase2-probe/" },
  { label: "Analytics", url: "https://www.google-analytics.com/collect" },
  { label: "Agent provider", url: "https://api.openai.com/v1/models" },
] as const;

const POLICY_BLOCK_MARKER = "Prep egress blocked" as const;

const results: EgressProbeResult[] = [];

for (const dest of BLOCKED_INTEGRATION_DESTINATIONS) {
  const hostname = new URL(dest.url).hostname;
  try {
    await fetch(dest.url);
    results.push({
      label: dest.label,
      url: dest.url,
      hostname,
      networkApi: "fetch",
      outcome: "unexpected_success",
      errorMessage: null,
      policyBlockMarker: POLICY_BLOCK_MARKER,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes(POLICY_BLOCK_MARKER)) {
      results.push({
        label: dest.label,
        url: dest.url,
        hostname,
        networkApi: "fetch",
        outcome: "policy_blocked",
        errorMessage: msg,
        policyBlockMarker: POLICY_BLOCK_MARKER,
      });
      continue;
    }
    results.push({
      label: dest.label,
      url: dest.url,
      hostname,
      networkApi: "fetch",
      outcome: "unexpected_error",
      errorMessage: msg,
      policyBlockMarker: POLICY_BLOCK_MARKER,
    });
  }
}

const blocked = results.filter((r) => r.outcome === "policy_blocked").length;
const unexpectedSuccess = results.filter((r) => r.outcome === "unexpected_success");
const unexpectedErrors = results.filter((r) => r.outcome === "unexpected_error");

console.log(`PHASE2_EGRESS_PROBE_JSON:${JSON.stringify({ results, blocked, total: results.length })}`);

if (unexpectedSuccess.length > 0) {
  console.error(`FAIL: ${unexpectedSuccess.length} prohibited destination(s) reachable during prep`);
  process.exit(1);
}
if (unexpectedErrors.length > 0) {
  for (const err of unexpectedErrors) {
    console.error(
      `FAIL: ${err.label} — expected policy block but got: ${err.errorMessage ?? "(empty)"}`,
    );
  }
  process.exit(2);
}
if (blocked !== BLOCKED_INTEGRATION_DESTINATIONS.length) {
  console.error(`FAIL: only ${blocked}/${BLOCKED_INTEGRATION_DESTINATIONS.length} policy blocks observed`);
  process.exit(3);
}

console.log(
  `PASS: preparation blocked ${blocked}/${BLOCKED_INTEGRATION_DESTINATIONS.length} integration destinations via ${POLICY_BLOCK_MARKER}`,
);
process.exit(0);
