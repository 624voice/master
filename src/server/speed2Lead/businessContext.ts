import type { PainCategory } from "~/server/speed2Lead/naturalLanguage";

export const SALES_OBJECTIVE = {
  summary:
    "Identify one operational/revenue problem relevant to 624Voice, connect it to a real capability, earn a 25-minute demo, and schedule it truthfully.",
  steps: [
    "identify one problem relevant to 624Voice",
    "connect that problem naturally to the appropriate capability",
    "earn a 25-minute demonstration",
    "schedule it",
  ],
} as const;

export const CORE_CAPABILITIES = [
  "Answer or respond quickly when the business cannot",
  "Capture and qualify inbound leads",
  "Handle missed-call, after-hours, and overflow opportunities",
  "Conversationally follow up with leads and customers",
  "Schedule or book when appropriate",
  "Reduce repetitive front-office workload",
  "Help convert more inbound opportunities",
  "Support AI receptionist, text, and website lead-response use cases depending on the solution",
] as const;

export const POSITIONING = {
  summary:
    "624Voice helps home-service businesses prevent opportunities from falling through the cracks by responding and taking action.",
} as const;

export const NOT_CAPABILITIES = [
  "Missed-call analytics software",
  "A missed-call reporting dashboard",
  "A system that merely flags calls for humans to follow up later",
  "A call-log reporting tool",
] as const;

const PAIN_CAPABILITY_MAP: Record<PainCategory, string> = {
  missed_calls: "Answer/respond quickly and capture missed-call opportunities",
  slow_response: "Respond faster to inbound leads before they go elsewhere",
  follow_up: "Conversationally follow up so leads do not go cold",
  after_hours: "Handle after-hours and overflow opportunities",
  workload: "Reduce repetitive front-office workload",
  website: "Respond to website and text leads quickly",
  scheduling: "Help schedule or book when appropriate",
  multiple: "Prevent inbound opportunities from falling through the cracks",
};

/** Business outcomes to sell in the meeting bridge — technology is secondary. */
const OUTCOME_BRIDGE_MAP: Record<PainCategory, string[]> = {
  missed_calls: [
    "respond faster to missed opportunities",
    "book more of those jobs",
    "without adding headcount",
  ],
  slow_response: [
    "respond faster before leads go elsewhere",
    "convert more inbound opportunities",
    "without adding headcount",
  ],
  follow_up: [
    "take manual follow-up off your team",
    "convert more of those leads",
    "without adding headcount",
  ],
  after_hours: [
    "capture more opportunities when nobody is available",
    "book more jobs from after-hours demand",
    "without adding headcount",
  ],
  workload: [
    "handle more demand",
    "reduce repetitive front-office work",
    "without adding another person",
  ],
  website: [
    "respond faster to website and text leads",
    "convert more inbound opportunities",
    "without adding headcount",
  ],
  scheduling: [
    "capture and book more inbound opportunities",
    "reduce scheduling gaps",
    "without adding headcount",
  ],
  multiple: [
    "capture more inbound opportunities",
    "respond faster and book more jobs",
    "without adding headcount",
  ],
};

const UNSUPPORTED_CLAIM_RE =
  /\b(track(?:ing)?\s+missed\s+calls?|missed[\s-]call\s+(?:report(?:s|ing)?|dashboard|analytics|log(?:s|ging)?)|flag(?:ging)?\s+missed\s+calls?|call[\s-]log\s+report(?:s|ing)?|merely\s+flag(?:s|ging)?\s+(?:calls?|missed\s+calls?)\s+for\s+(?:humans?|staff|someone)\s+to\s+follow\s+up)\b/i;

const AI_AS_PRIMARY_BENEFIT_RE =
  /\b(how (?:ai|using ai)(?: could| would| can| will)? help|worth (?:a )?(?:look|chat).*?\b(?:ai|using ai)\b|see how (?:ai|using ai) (?:could|would|can|will))\b/i;

export function painMapsToCapability(pains: PainCategory[]): boolean {
  return pains.length > 0;
}

export function capabilityForPain(pain: PainCategory): string {
  return PAIN_CAPABILITY_MAP[pain] ?? PAIN_CAPABILITY_MAP.multiple;
}

export function primaryCapabilitySummary(pains: PainCategory[]): string | undefined {
  if (pains.length === 0) return undefined;
  return capabilityForPain(pains[0] ?? "multiple");
}

export function outcomeBridgeOutcomes(painLabel?: string, pains: PainCategory[] = []): string[] {
  if (pains.length > 0) {
    return OUTCOME_BRIDGE_MAP[pains[0]!] ?? OUTCOME_BRIDGE_MAP.multiple;
  }
  const normalized = (painLabel ?? "").toLowerCase();
  if (/missed call/.test(normalized)) return OUTCOME_BRIDGE_MAP.missed_calls;
  if (/slow response|response time/.test(normalized)) return OUTCOME_BRIDGE_MAP.slow_response;
  if (/follow[- ]?up/.test(normalized)) return OUTCOME_BRIDGE_MAP.follow_up;
  if (/after[- ]?hours/.test(normalized)) return OUTCOME_BRIDGE_MAP.after_hours;
  if (/workload|staff|headcount|manual/.test(normalized)) return OUTCOME_BRIDGE_MAP.workload;
  if (/website|web lead/.test(normalized)) return OUTCOME_BRIDGE_MAP.website;
  if (/schedul/.test(normalized)) return OUTCOME_BRIDGE_MAP.scheduling;
  return OUTCOME_BRIDGE_MAP.multiple;
}

export function outcomeBridgeContextForPrompt(args: {
  primaryPain?: string;
  pains?: PainCategory[];
}): Record<string, unknown> {
  const outcomes = outcomeBridgeOutcomes(args.primaryPain, args.pains ?? []);
  return {
    sellBusinessOutcomeFirst: true,
    technologyIsSecondary: true,
    coreOutcomes: outcomes,
    bridgePattern:
      "Ask ONE conditional question: if you could show them a way to [outcomes joined naturally], would it be worth 25 minutes to see how it works?",
    avoid: ["Do not lead with AI as the benefit", "Do not hardcode one exact sentence"],
  };
}

export function containsUnsupportedProductClaim(text: string): boolean {
  return UNSUPPORTED_CLAIM_RE.test(text);
}

export function containsAiAsPrimaryBenefit(text: string): boolean {
  return AI_AS_PRIMARY_BENEFIT_RE.test(text);
}

export function businessContextForPrompt(): Record<string, unknown> {
  return {
    salesObjective: SALES_OBJECTIVE,
    coreCapabilities: CORE_CAPABILITIES,
    positioning: POSITIONING,
    notCapabilities: NOT_CAPABILITIES,
  };
}

export function allowedFactsForPrompt(): string[] {
  return [
    POSITIONING.summary,
    ...CORE_CAPABILITIES.slice(0, 4).map((capability) => `624Voice can ${capability.charAt(0).toLowerCase()}${capability.slice(1)}.`),
    "Jessica is a demo, not what a finished production setup looks like.",
    "Pricing depends on scope; exact pricing is not quoted over SMS.",
    "Next step for qualified interest: a 25-minute walkthrough with Chris.",
    `624Voice is NOT primarily: ${NOT_CAPABILITIES.join("; ")}.`,
  ];
}
