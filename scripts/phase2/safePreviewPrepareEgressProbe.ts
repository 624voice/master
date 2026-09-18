import "./safePreviewPrepareNetworkGuard.ts";

const BLOCKED_INTEGRATION_DESTINATIONS = [
  { label: "Twilio", url: "https://api.twilio.com/2010-04-01/Accounts" },
  { label: "SendGrid", url: "https://api.sendgrid.com/v3/mail/send" },
  { label: "Upstash", url: "https://us1-example.upstash.io/ping" },
  { label: "Google", url: "https://www.google.com/generate_204" },
  { label: "CRM webhook", url: "https://hooks.zapier.com/hooks/catch/000000/phase2-probe/" },
  { label: "Analytics", url: "https://www.google-analytics.com/collect" },
  { label: "Agent provider", url: "https://api.openai.com/v1/models" },
] as const;

let blocked = 0;

for (const dest of BLOCKED_INTEGRATION_DESTINATIONS) {
  try {
    await fetch(dest.url);
    console.error(`FAIL: ${dest.label} destination reachable during prep (${dest.url})`);
    process.exit(1);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Prep egress blocked")) {
      blocked += 1;
      console.log(`PASS: blocked ${dest.label}`);
      continue;
    }
    console.error(`FAIL: unexpected error for ${dest.label}: ${msg}`);
    process.exit(2);
  }
}

console.log(`PASS: preparation blocked ${blocked}/${BLOCKED_INTEGRATION_DESTINATIONS.length} integration destinations`);
process.exit(0);
