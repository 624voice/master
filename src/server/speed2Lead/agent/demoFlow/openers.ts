import type { AgentProfile } from "~/server/speed2Lead/agent/profile";
import { usableGreetingName } from "~/server/speed2Lead/agent/greetingName";
import type { AgentSession } from "~/server/speed2Lead/agent/state";

function heyPrefix(firstName?: string): string {
  const name = usableGreetingName(firstName);
  return name ? `Hey ${name}, ` : "Hey, ";
}

/** Opener part 1 — sent immediately after a completed demo call. */
export function buildDemoOpenerPart1(session: AgentSession): string {
  const firstName = session.firstName?.trim();
  if (session.callOutcome === "short") {
    return (
      `${heyPrefix(firstName)}Chris with 624Voice. Looks like the call with Jessica may have cut out early — ` +
      "did it work okay on your end, or want me to send a fresh link to try again?"
    );
  }
  return (
    `${heyPrefix(firstName)}Chris with 624Voice. Saw you just finished trying Jessica. ` +
    "Curious — what stood out most from going through it like one of your own customers would?"
  );
}

/** Code-owned fallback when the model tries to bridge before discovery cap is met. */
export function buildDemoDiscoveryFallback(): string {
  return "How are you handling those calls today when nobody's immediately available?";
}

export const DEMO_PRICING_RESPONSE_COPY =
  "It depends on what you're trying to automate and the volume you're handling. I'd rather understand the setup first than throw out a number that may not fit. If it looks like we can actually help, I can walk you through the options on the call.";

export function buildDemoOffTopicRedirect(): string {
  return "I'm just here to help with your Jessica demo and scheduling — happy to pick that back up if you want.";
}

export function buildDemoInjectionRedirect(): string {
  return "I'm Chris with 624Voice — just here to follow up on your demo. What stood out most from trying Jessica?";
}

export function buildDemoTimingDeclineExit(): string {
  return "Fair enough. I'll leave it there. If anything changes, just text me here.";
}

export function buildDemoResumeLinkMessage(firstName: string | undefined, link: string): string {
  const name = usableGreetingName(firstName);
  const prefix = name ? `Hey ${name} — ` : "Hey — ";
  return `${prefix}here's the link to pick the Jessica demo back up: ${link}`;
}
