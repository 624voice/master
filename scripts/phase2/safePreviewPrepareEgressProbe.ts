import "./safePreviewPrepareNetworkGuard.ts";

try {
  await fetch("https://api.twilio.com/2010-04-01/Accounts");
  console.error("FAIL: integration destination reachable during prep");
  process.exit(1);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Prep egress blocked")) {
    console.log("PASS: preparation integration egress blocked");
    process.exit(0);
  }
  console.error(msg);
  process.exit(2);
}
