/**
 * Per-tenant business profile for the Speed2Lead SMS agent.
 *
 * This is the ONLY place that should differ between customers. Everything
 * downstream (the LLM turn engine, the scheduling wrapper, the webhook) reads
 * from an `AgentProfile` instead of hardcoding a business's name, positioning,
 * or booking details. To sell this agent to a new home-services customer,
 * write a new profile object (or load one from env/config storage) — no
 * engine code changes.
 */

export type PainOutcome = {
  /** Matches against the pain the LLM extracts, e.g. "missed_calls". */
  key: string;
  /** Descriptive label used inside the LLM's own instructions, e.g. "slow
   * response to new leads" — can be longer/more precise since the prospect
   * never sees it directly. */
  label: string;
  /** Terse label safe to put directly in a customer-facing SMS, e.g. "slow
   * response". Keep these short — they get listed together in one text. */
  shortLabel: string;
  /** Business outcomes to bridge to a meeting — technology is secondary. */
  outcomes: string[];
};

export type AgentProfile = {
  /** Slug identifying this tenant, e.g. "624voice". Used in session keys. */
  tenantId: string;
  /** The name the agent texts as, e.g. "Chris". */
  senderFirstName: string;
  /** Full name used in the opening message's signature, e.g. "Chris Hutson". */
  senderFullName: string;
  /** The company the agent represents, e.g. "624Voice". */
  companyName: string;
  /** Company name as shown in the opener's signature block, e.g. "624 Voice". */
  signatureCompanyName: string;
  /** One-line positioning statement, no product-feature jargon. */
  positioningSummary: string;
  /** What the product can do — used to keep the LLM's claims truthful. */
  capabilities: string[];
  /** What the product explicitly is NOT, to prevent overclaiming. */
  nonCapabilities: string[];
  /** Pain -> business-outcome bridges used for the meeting ask. */
  painOutcomes: PainOutcome[];
  /** Consultation length in minutes, shown to the prospect. */
  meetingLengthMinutes: number;
  /** IANA timezone the business (and its calendar) operates in. */
  timezone: string;
  /** Twilio number this tenant sends from (must match TWILIO_FROM_NUMBER for now). */
  fromPhoneDisplay?: string;
  /** Pain-outcome keys (must exist in painOutcomes) named in the second
   * opener message, e.g. "which stood out most: missed calls, slow
   * response, or follow-up?" Order is the order they're listed in the text. */
  headlinePainKeys: string[];
  /** Minutes to wait after the first opener message before sending the
   * second one, so the prospect has a chance to read the report first. */
  painPromptDelayMinutes: number;
  /** Minutes after session.createdAt for each no-response follow-up stage
   * (+4h, Day 1, Day 3, Day 6, Day 10 by default). */
  noResponseDelaysMinutes: number[];
  /**
   * Optional results-guarantee sentence used in decline/no-response copy.
   * Omit to drop the guarantee clause without changing the rest of the message.
   */
  resultsGuarantee?: string;
};

export const DEFAULT_624VOICE_PROFILE: AgentProfile = {
  tenantId: "624voice",
  senderFirstName: "Chris",
  senderFullName: "Chris Hutson",
  companyName: "624Voice",
  signatureCompanyName: "624 Voice",
  positioningSummary:
    "624Voice helps home-service businesses stop losing revenue to missed calls, slow lead response, and inconsistent follow-up by responding and taking action automatically.",
  capabilities: [
    "answer or respond quickly when the business can't",
    "capture and qualify inbound leads",
    "handle missed-call, after-hours, and overflow opportunities",
    "follow up with leads and customers conversationally",
    "book appointments when it makes sense",
  ],
  nonCapabilities: [
    "missed-call analytics or a reporting dashboard",
    "a system that only flags calls for a human to follow up on later",
  ],
  painOutcomes: [
    {
      key: "missed_calls",
      label: "missed calls",
      shortLabel: "missed calls",
      outcomes: ["respond faster to missed opportunities", "book more of those jobs", "without adding headcount"],
    },
    {
      key: "slow_response",
      label: "slow response to new leads",
      shortLabel: "slow response",
      outcomes: ["respond before leads go elsewhere", "convert more inbound opportunities", "without adding headcount"],
    },
    {
      key: "follow_up",
      label: "inconsistent follow-up",
      shortLabel: "follow-up",
      outcomes: ["take manual follow-up off your team", "convert more of those leads", "without adding headcount"],
    },
    {
      key: "after_hours",
      label: "after-hours calls going unanswered",
      shortLabel: "after-hours calls",
      outcomes: ["capture opportunities when nobody's available", "book more jobs from after-hours demand", "without adding headcount"],
    },
    {
      key: "workload",
      label: "front-office workload",
      shortLabel: "front-office workload",
      outcomes: ["handle more demand", "cut repetitive office work", "without adding another person"],
    },
  ],
  meetingLengthMinutes: 25,
  timezone: "America/Chicago",
  headlinePainKeys: ["missed_calls", "slow_response", "follow_up"],
  painPromptDelayMinutes: 5,
  noResponseDelaysMinutes: [240, 1440, 4320, 8640, 14400],
  resultsGuarantee:
    "we back it with a 90-day results guarantee: you either see it pay for itself in booked revenue within 90 days, or we keep working for free until it does.",
};

export function getActiveProfile(): AgentProfile {
  // Single-tenant today; swap this for a lookup keyed by phone number / site
  // once a second customer is onboarded onto the same codebase.
  return DEFAULT_624VOICE_PROFILE;
}

export function painOutcomeFor(profile: AgentProfile, painKey: string | undefined): PainOutcome {
  const found = painKey ? profile.painOutcomes.find((p) => p.key === painKey) : undefined;
  return (
    found ?? {
      key: "general",
      label: "missed opportunities",
      shortLabel: "missed opportunities",
      outcomes: ["capture more inbound opportunities", "respond faster and book more jobs", "without adding headcount"],
    }
  );
}
