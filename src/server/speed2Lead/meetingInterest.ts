import type { KnownFacts } from "~/server/speed2Lead/sessionMemoryTypes";

/** Canonical meeting-interest flag — replaces scattered bridge-complete concepts. */
export function isMeetingInterestConfirmed(facts?: KnownFacts): boolean {
  if (!facts) return false;
  return Boolean(facts.meetingInterestConfirmed ?? facts.meetingBridgeComplete);
}

export function withMeetingInterestConfirmed(facts: KnownFacts): KnownFacts {
  return {
    ...facts,
    meetingInterestConfirmed: true,
    meetingBridgeComplete: true,
  };
}

export function normalizeMeetingInterestFacts(facts: KnownFacts): KnownFacts {
  const confirmed = Boolean(facts.meetingInterestConfirmed ?? facts.meetingBridgeComplete);
  if (!confirmed) {
    return facts;
  }
  return {
    ...facts,
    meetingInterestConfirmed: true,
    meetingBridgeComplete: true,
  };
}
