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

const UNSUPPORTED_CLAIM_RE =
  /\b(track(?:ing)?\s+missed\s+calls?|missed[\s-]call\s+(?:report(?:s|ing)?|dashboard|analytics|log(?:s|ging)?)|flag(?:ging)?\s+missed\s+calls?|call[\s-]log\s+report(?:s|ing)?|merely\s+flag(?:s|ging)?\s+(?:calls?|missed\s+calls?)\s+for\s+(?:humans?|staff|someone)\s+to\s+follow\s+up)\b/i;

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

export function containsUnsupportedProductClaim(text: string): boolean {
  return UNSUPPORTED_CLAIM_RE.test(text);
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
