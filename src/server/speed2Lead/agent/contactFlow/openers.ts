import { exampleLinkForTrade } from "~/server/speed2Lead/agent/contactFlow/exampleLinks";
import { restateNeedForBridge } from "~/server/speed2Lead/agent/contactFlow/inquiryClarity";
import { usableGreetingName } from "~/server/speed2Lead/agent/greetingName";
import type { AgentProfile } from "~/server/speed2Lead/agent/profile";
import type { AgentSession, InquiryClarity } from "~/server/speed2Lead/agent/state";

function heyPrefix(firstName?: string): string {
  const name = usableGreetingName(firstName);
  return name ? `Hey ${name}, ` : "Hey, ";
}

/** Opener — need clear from form. */
export function buildClearNeedOpener(session: AgentSession): string {
  const summary = session.helpTextSummary ?? "your request";
  return (
    `${heyPrefix(session.firstName)}Chris with 624Voice. I saw your note from ${session.businessName} about ${summary}. ` +
    "Curious — what's happening today that made you start looking into this?"
  );
}

/** Opener — need already fully clear (skip toward bridge). */
export function buildAlreadyClearOpener(session: AgentSession): string {
  const restated = restateNeedForBridge(session.formMessage ?? "", session.helpTextSummary ?? "your request");
  const example = exampleLinkForTrade(session.trade);
  return (
    `${heyPrefix(session.firstName)}Chris with 624Voice. I saw your note from ${session.businessName} about ${restated}. ` +
    `If I could show you a way to ${example.outcome} without adding more headcount or effort, would it be worth 25 minutes to take a look?`
  );
}

/** Opener — vague inquiry. */
export function buildVagueInquiryOpener(session: AgentSession): string {
  return (
    `${heyPrefix(session.firstName)}Chris with 624Voice — saw your note from ${session.businessName}. ` +
    "What's prompting you to look into this now?"
  );
}

export function buildContactOpener(session: AgentSession): string {
  switch (session.inquiryClarity) {
    case "already_clear":
      return buildAlreadyClearOpener(session);
    case "vague":
      return buildVagueInquiryOpener(session);
    case "clear":
    default:
      return buildClearNeedOpener(session);
  }
}

export function buildSchedulingKickoffMessage(_profile: AgentProfile, _session: AgentSession): string {
  return "What day works best for a quick 25-minute chat?";
}

export const PRICING_RESPONSE_COPY =
  "It depends on what you're trying to automate and the volume you're handling. I'd rather understand the setup first than throw out a number that may not fit. If it looks like we can actually help, I can walk you through the options on the call.";

export function buildDeclineDiagnosisQuestion(): string {
  return (
    "Totally fair. Just so I don't make the wrong assumption — is it more that this isn't a priority right now, " +
    "or you're not convinced it would solve the problem?"
  );
}

export function buildTimingDeclineExit(): string {
  return "Fair enough. I'll leave it there. If anything changes, just text me here.";
}

export function buildSkepticismDeclineResponse(
  profile: AgentProfile,
  businessName?: string,
): string {
  const name = businessName?.trim() || "your business";
  const guarantee = profile.resultsGuarantee?.trim();
  if (!guarantee) {
    return `That's fair. Want me to show you how it'd work for ${name}?`;
  }
  return (
    `That's fair — for what it's worth, that's part of why ${guarantee} ` +
    `Want me to show you how it'd work for ${name}?`
  );
}

export function buildOffTopicRedirect(): string {
  return "I'm just here to help with your inquiry and scheduling — happy to pick that back up if you want.";
}

export function buildConsequenceQuestion(alreadyAsked = 0): string {
  const variants = [
    "What's that been costing you, would you say?",
    "Roughly what kind of impact has that had on revenue or jobs?",
    "Any sense what that's adding up to over a month or so?",
  ] as const;
  return variants[Math.min(Math.max(alreadyAsked, 0), variants.length - 1)]!;
}

export function buildInjectionRedirect(): string {
  return "I'm just handling scheduling for the business — what can I help you with on your inquiry?";
}

export function inquiryClarityFromSeed(value: InquiryClarity | undefined): InquiryClarity {
  return value ?? "clear";
}
