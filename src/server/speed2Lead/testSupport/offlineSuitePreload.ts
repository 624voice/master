/**
 * Default `bun test src` fixture layer. Does not change test assertions.
 *
 * - Keeps ambient SPEED2LEAD_TEST_PHONES from leaking into tests that
 *   assert unset / first-allowlist behavior.
 * - Blocks live Google Calendar / Twilio HTTP in the offline suite.
 *   Set SPEED2LEAD_LIVE_SMOKE=1 to leave the network alone for smoke files.
 */
import { beforeEach } from "bun:test";
import { resetSpeed2LeadTestPhonesCacheForTests } from "~/server/speed2Lead/testPhoneAllowlist";

const liveSmoke = process.env.SPEED2LEAD_LIVE_SMOKE === "1";

if (!liveSmoke) {
  process.env.SPEED2LEAD_TEST_PHONES = "";
  resetSpeed2LeadTestPhonesCacheForTests();
}

const originalFetch = globalThis.fetch.bind(globalThis);

if (!liveSmoke) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (
      url.includes("googleapis.com") ||
      url.includes("api.twilio.com") ||
      url.includes("oauth2.googleapis.com")
    ) {
      return new Response(
        JSON.stringify({ error: "offline_suite_blocked_live_network", url }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }
    return originalFetch(input, init);
  }) as typeof fetch;
}

beforeEach(() => {
  if (!liveSmoke) {
    resetSpeed2LeadTestPhonesCacheForTests();
  }
});
