import type { AgentProfile } from "~/server/speed2Lead/agent/profile";
import type { AgentSession } from "~/server/speed2Lead/agent/state";

function heyPrefix(firstName?: string): string {
  return firstName ? `Hey ${firstName}` : "Hey";
}

function hiDotPrefix(firstName?: string): string {
  return firstName ? `Hi ${firstName}. ` : "";
}

function businessName(session: AgentSession): string {
  return session.businessName?.trim() || "your business";
}

/** +4h — stage index 0 in shared no-response campaign. */
export function buildDemoNoResponseMessage0(_profile: AgentProfile, session: AgentSession): string {
  return (
    `${heyPrefix(session.firstName)} — curious what you thought after trying Jessica earlier. ` +
    `Could you see something like that being useful in ${businessName(session)}?`
  );
}

/** Day 1 — stage index 1. */
export function buildDemoNoResponseMessage1(_profile: AgentProfile, session: AgentSession): string {
  return (
    `${hiDotPrefix(session.firstName)}One thing I'm curious about — when customers call and your team can't answer right away, ` +
    "what usually happens to those calls today?"
  );
}

/** Day 3 — stage index 2. */
export function buildDemoNoResponseMessage2(_profile: AgentProfile, _session: AgentSession): string {
  return (
    "Quick question — if Jessica could solve one thing for you first, would it be answering more calls, " +
    "booking more jobs, or taking scheduling work off your team?"
  );
}

/** Day 6 — stage index 3. */
export function buildDemoNoResponseMessage3(_profile: AgentProfile, session: AgentSession): string {
  return (
    "No pressure if this isn't a priority right now. But if I could show you how to put something like Jessica " +
    `to work for ${businessName(session)} without adding another person to the payroll, would it be worth 25 minutes to take a look?`
  );
}

/** Day 10 — stage index 4. */
export function buildDemoNoResponseMessage4(_profile: AgentProfile, session: AgentSession): string {
  return (
    "I'll close the loop for now so I don't keep chasing you. If you ever want to look at what Jessica could handle " +
    `for ${businessName(session)}, just text me here and we can pick it back up.`
  );
}

export const DEMO_NO_RESPONSE_BUILDERS = [
  buildDemoNoResponseMessage0,
  buildDemoNoResponseMessage1,
  buildDemoNoResponseMessage2,
  buildDemoNoResponseMessage3,
  buildDemoNoResponseMessage4,
] as const;

export function buildDemoNoResponseMessage(
  profile: AgentProfile,
  session: AgentSession,
  stageIndex: number,
): string {
  const builder = DEMO_NO_RESPONSE_BUILDERS[stageIndex];
  if (!builder) {
    throw new Error(`Invalid demo no-response stage index: ${stageIndex}`);
  }
  return builder(profile, session);
}
