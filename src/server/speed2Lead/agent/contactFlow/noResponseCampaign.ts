import type { AgentProfile } from "~/server/speed2Lead/agent/profile";
import { usableGreetingName } from "~/server/speed2Lead/agent/greetingName";
import type { AgentSession } from "~/server/speed2Lead/agent/state";

function hiDashPrefix(firstName?: string): string {
  const name = usableGreetingName(firstName);
  return name ? `Hi ${name} — ` : "";
}

function hiDotPrefix(firstName?: string): string {
  const name = usableGreetingName(firstName);
  return name ? `Hi ${name}. ` : "";
}

function helpSummary(session: AgentSession): string {
  return session.helpTextSummary ?? "your request";
}

export function buildContactNoResponseMessage0(_profile: AgentProfile, session: AgentSession): string {
  return (
    `${hiDashPrefix(session.firstName)}saw your note from ${session.businessName} about ${helpSummary(session)}. ` +
    "What's the main thing you're hoping to improve?"
  );
}

export function buildContactNoResponseMessage1Clear(_profile: AgentProfile, session: AgentSession): string {
  return (
    `${hiDotPrefix(session.firstName)}You mentioned ${helpSummary(session)}. ` +
    "Usually there's a reason something like that starts becoming a priority. " +
    "Is it creating more lost opportunities, more work for the team, or both?"
  );
}

export function buildContactNoResponseMessage1Vague(_profile: AgentProfile, session: AgentSession): string {
  return (
    `${hiDotPrefix(session.firstName)}Just curious — are you mainly looking to capture more opportunities, ` +
    "take work off the team, or a little of both?"
  );
}

export function buildContactNoResponseMessage1(profile: AgentProfile, session: AgentSession): string {
  if (session.inquiryClarity === "vague") {
    return buildContactNoResponseMessage1Vague(profile, session);
  }
  return buildContactNoResponseMessage1Clear(profile, session);
}

export function buildContactNoResponseMessage2(_profile: AgentProfile, _session: AgentSession): string {
  return (
    "Quick question — what's the bigger bottleneck right now: missed calls and slow follow-up, " +
    "or the amount of work it's putting on your team?"
  );
}

export function buildContactNoResponseMessage3(profile: AgentProfile, _session: AgentSession): string {
  const guarantee = profile.resultsGuarantee?.trim()?.replace(/[.\s]+$/, "");
  const guaranteeClause = guarantee ? ` — and ${guarantee}` : "";
  return (
    "No pressure if this isn't a priority right now. I can probably show you a way to capture more opportunities " +
    `without adding more work or headcount${guaranteeClause}. ` +
    "Would it be worth 25 minutes to take a look?"
  );
}

export function buildContactNoResponseMessage4(_profile: AgentProfile, _session: AgentSession): string {
  return (
    "I'll close the loop for now so I don't keep chasing you. If you decide you want to look at how to capture more opportunities " +
    "or take some work off the team, just text me here and we can pick it back up."
  );
}

export const CONTACT_NO_RESPONSE_BUILDERS = [
  buildContactNoResponseMessage0,
  buildContactNoResponseMessage1,
  buildContactNoResponseMessage2,
  buildContactNoResponseMessage3,
  buildContactNoResponseMessage4,
] as const;

export function buildContactNoResponseMessage(
  profile: AgentProfile,
  session: AgentSession,
  stageIndex: number,
): string {
  const builder = CONTACT_NO_RESPONSE_BUILDERS[stageIndex];
  if (!builder) {
    throw new Error(`Invalid contact no-response stage index: ${stageIndex}`);
  }
  return builder(profile, session);
}
