export type PainCategory =
  | "missed_calls"
  | "slow_response"
  | "follow_up"
  | "after_hours"
  | "workload"
  | "website"
  | "scheduling"
  | "multiple";

export type UrgencyLevel = "none" | "low" | "medium" | "high";

export type MeetingReadiness = "none" | "low" | "medium" | "high";

export type PositiveReaction = "none" | "mild" | "strong";

export type FitResponse = "yes" | "probably" | "maybe" | "no" | "unknown";

export type MessageSignals = {
  pains: PainCategory[];
  urgency: UrgencyLevel;
  meetingReadiness: MeetingReadiness;
  explicitMeetingReady: boolean;
  mildPositiveInterest: boolean;
  positiveReaction: PositiveReaction;
  negativeReaction: boolean;
  objection: boolean;
  notInterested: boolean;
  tellMeMore: boolean;
  priceQuestion: boolean;
  faqQuestion: boolean;
  identityQuestion: boolean;
  meetingBooked: boolean;
  stop: boolean;
  decline: boolean;
  requestReport: boolean;
  notReady: boolean;
  justTesting: boolean;
  requestInformation: boolean;
  answeringService: boolean;
  officeStaff: boolean;
  alreadyUsesAi: boolean;
  customization: boolean;
  orchestration: boolean;
  faq624voice: boolean;
  demoError: boolean;
  fitResponse: FitResponse;
  yes: boolean;
  no: boolean;
  vague: boolean;
  hasSubstance: boolean;
};

export type ConversationContextSignals = {
  detectedPains?: PainCategory[];
  lastCustomerMessage?: string;
  priorContextMessage?: string;
};

export function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function tokenize(text: string): string[] {
  return text.split(/[^a-z0-9]+/).filter(Boolean);
}

function tokenOverlap(text: string, keywords: string[]): number {
  const tokens = new Set(tokenize(text));
  if (tokens.size === 0 || keywords.length === 0) {
    return 0;
  }
  let hits = 0;
  for (const keyword of keywords) {
    const parts = keyword.split(/\s+/);
    if (parts.length === 1) {
      if (tokens.has(keyword)) {
        hits += 1;
      }
    } else if (includesAny(text, [keyword])) {
      hits += 1;
    }
  }
  return hits / keywords.length;
}

const MISSED_CALLS_PHRASES = [
  "missed call",
  "miss calls",
  "missing calls",
  "unanswered call",
  "don't answer",
  "dont answer",
  "not answering",
  "calls go unanswered",
  "lose calls",
  "losing calls",
  "ton of calls",
  "a ton of calls",
  "fewer missed",
];

const SLOW_RESPONSE_PHRASES = [
  "slow response",
  "slow to respond",
  "respond faster",
  "responding faster",
  "response time",
  "take too long",
  "too long to respond",
  "slow leads",
  "new leads",
  "lead response",
];

const FOLLOW_UP_PHRASES = [
  "follow up",
  "follow-up",
  "followup",
  "follow through",
  "never call back",
  "don't call back",
  "dont call back",
  "inconsistent follow",
];

const AFTER_HOURS_PHRASES = [
  "after hours",
  "after-hours",
  "after 5",
  "after five",
  "nights",
  "weekends",
  "weekend",
  "evenings",
  "outside business hours",
  "when we're closed",
  "when were closed",
  "when we are closed",
];

const WORKLOAD_PHRASES = [
  "drowning",
  "overwhelmed",
  "stretched",
  "too busy",
  "no bandwidth",
  "short staffed",
  "understaffed",
  "office team",
  "office staff",
  "csr",
  "receptionist",
  "my team",
  "workload",
  "capacity",
  "take off",
  "off our plate",
  "off their plate",
  "repetitive",
];

const WEBSITE_PHRASES = [
  "website",
  "web site",
  "webpage",
  "online presence",
  "no site",
  "need a site",
  "new site",
];

const SCHEDULING_PHRASES = [
  "scheduling",
  "book appointments",
  "booking appointments",
  "dispatch",
  "calendar",
  "appointment",
];

const URGENCY_HIGH_PHRASES = [
  "desperately",
  "urgent",
  "urgently",
  "asap",
  "right away",
  "immediately",
  "need to fix",
  "have to fix",
  "must fix",
  "need this now",
  "need something",
  "losing a ton",
  "losing tons",
  "losing jobs",
  "can't keep up",
  "cant keep up",
];

const URGENCY_MEDIUM_PHRASES = [
  "need to",
  "need help",
  "looking for",
  "want to fix",
  "trying to",
  "big problem",
  "major problem",
  "really need",
];

const EXPLICIT_MEETING_READY_PHRASES = [
  "let's talk",
  "lets talk",
  "can we talk",
  "want to talk",
  "call me",
  "send me the link",
  "send the link",
  "how do we get started",
  "get started",
  "i want this",
  "i need this",
  "we need this",
  "this would solve",
  "book a time",
  "book a call",
  "set up a call",
  "grab a time",
  "when can we",
  "sign me up",
  "ready to move forward",
  "move forward",
  "yes let's talk",
  "schedule a call",
  "schedule a time",
];

const MILD_POSITIVE_PHRASES = [
  "interested",
  "sounds good",
  "pretty cool",
  "interesting",
  "i like it",
  "that's cool",
  "thats cool",
  "nice",
  "good demo",
  "not bad",
  "kind of cool",
  "kinda cool",
];

const STRONG_POSITIVE_PHRASES = [
  "that was awesome",
  "really impressive",
  "loved it",
  "amazing",
  "incredible",
  "blown away",
  "this would help us",
  "would help us",
];

const NEGATIVE_PHRASES = [
  "didn't like",
  "didnt like",
  "not for us",
  "wouldn't work",
  "wouldnt work",
  "doesn't fit",
  "doesnt fit",
  "not realistic",
  "felt fake",
  "felt robotic",
  "didn't work",
  "didnt work",
  "not impressed",
];

const FIT_YES_PHRASES = [
  "definitely",
  "absolutely",
  "for sure",
  "yes",
  "yeah",
  "yep",
  "100%",
  "could see it",
  "can see it",
  "see it working",
  "would work",
];

const FIT_PROBABLY_PHRASES = [
  "probably",
  "likely",
  "most likely",
  "think so",
  "i think so",
  "could work",
  "might work",
];

const FIT_MAYBE_PHRASES = ["maybe", "possibly", "potentially", "not sure yet", "unsure"];

const FIT_NO_PHRASES = [
  "don't think so",
  "dont think so",
  "probably not",
  "not really",
  "doesn't fit",
  "doesnt fit",
  "wouldn't work",
  "wouldnt work",
  "not for us",
  "no",
  "nope",
];

function detectPains(text: string): PainCategory[] {
  const pains: PainCategory[] = [];

  if (includesAny(text, MISSED_CALLS_PHRASES) || tokenOverlap(text, ["missed", "calls"]) >= 0.5) {
    pains.push("missed_calls");
  }
  if (includesAny(text, SLOW_RESPONSE_PHRASES)) {
    pains.push("slow_response");
  }
  if (includesAny(text, FOLLOW_UP_PHRASES)) {
    pains.push("follow_up");
  }
  if (includesAny(text, AFTER_HOURS_PHRASES)) {
    pains.push("after_hours");
  }
  if (includesAny(text, WORKLOAD_PHRASES)) {
    pains.push("workload");
  }
  if (includesAny(text, WEBSITE_PHRASES)) {
    pains.push("website");
  }
  if (includesAny(text, SCHEDULING_PHRASES)) {
    pains.push("scheduling");
  }

  if (
    includesAny(text, ["all of it", "all of the above", "everything", "multiple", "both"]) ||
    pains.length >= 2
  ) {
    if (!pains.includes("multiple")) {
      pains.push("multiple");
    }
  }

  return pains;
}

function detectUrgency(text: string): UrgencyLevel {
  if (includesAny(text, URGENCY_HIGH_PHRASES)) {
    return "high";
  }
  if (includesAny(text, URGENCY_MEDIUM_PHRASES)) {
    return "medium";
  }
  if (includesAny(text, ["eventually", "someday", "just curious", "down the road"])) {
    return "low";
  }
  return "none";
}

function detectFitResponse(text: string): FitResponse {
  if (includesAny(text, FIT_NO_PHRASES) && !includesAny(text, ["not sure"])) {
    if (text === "no" || text === "nope" || includesAny(text, FIT_NO_PHRASES)) {
      return "no";
    }
  }
  if (includesAny(text, FIT_YES_PHRASES) || text === "yes" || text === "yeah" || text === "yep") {
    return "yes";
  }
  if (includesAny(text, FIT_PROBABLY_PHRASES)) {
    return "probably";
  }
  if (includesAny(text, FIT_MAYBE_PHRASES)) {
    return "maybe";
  }
  if (text === "no" || text === "nope") {
    return "no";
  }
  return "unknown";
}

function detectExplicitMeetingReady(text: string): boolean {
  return includesAny(text, EXPLICIT_MEETING_READY_PHRASES);
}

function detectMildPositiveInterest(text: string): boolean {
  return includesAny(text, MILD_POSITIVE_PHRASES);
}

function detectPositiveReaction(
  text: string,
  explicitMeetingReady: boolean,
  mildPositiveInterest: boolean,
): PositiveReaction {
  if (explicitMeetingReady || includesAny(text, STRONG_POSITIVE_PHRASES)) {
    return "strong";
  }
  if (includesAny(text, ["i need this", "i want this", "we need this"])) {
    return "strong";
  }
  if (mildPositiveInterest) {
    return "mild";
  }
  return "none";
}

function detectMeetingReadiness(
  text: string,
  pains: PainCategory[],
  urgency: UrgencyLevel,
  positiveReaction: PositiveReaction,
  explicitMeetingReady: boolean,
): MeetingReadiness {
  if (explicitMeetingReady) {
    return "high";
  }
  if (positiveReaction === "strong") {
    return "high";
  }
  if (pains.length > 0 && urgency === "high") {
    return "high";
  }
  if (pains.length > 0 && urgency === "medium") {
    return "medium";
  }
  if (positiveReaction === "mild") {
    return "medium";
  }
  if (pains.length > 0) {
    return "medium";
  }
  if (includesAny(text, ["?", "how", "what", "tell me", "explain", "curious"])) {
    return "low";
  }
  return "none";
}

export function analyzeMessage(rawText: string): MessageSignals {
  const text = normalize(rawText);
  const pains = detectPains(text);
  const urgency = detectUrgency(text);
  const explicitMeetingReady = detectExplicitMeetingReady(text);
  const mildPositiveInterest = detectMildPositiveInterest(text);
  const positiveReaction = detectPositiveReaction(
    text,
    explicitMeetingReady,
    mildPositiveInterest,
  );
  const meetingReadiness = detectMeetingReadiness(
    text,
    pains,
    urgency,
    positiveReaction,
    explicitMeetingReady,
  );

  const stop = includesAny(text, [
    "stop",
    "unsubscribe",
    "cancel texts",
    "opt out",
    "remove me",
    "do not text me",
    "don't text me",
    "dont text me",
  ]);

  const decline =
    !stop &&
    includesAny(text, [
      "not interested",
      "no thanks",
      "leave me alone",
      "don't contact",
      "do not contact",
    ]);

  return {
    pains,
    urgency,
    meetingReadiness,
    explicitMeetingReady,
    mildPositiveInterest,
    positiveReaction,
    negativeReaction: includesAny(text, NEGATIVE_PHRASES),
    objection: includesAny(text, [
      "too expensive",
      "not ready",
      "don't think",
      "dont think",
      "won't work",
      "wont work",
    ]),
    notInterested: decline,
    tellMeMore: includesAny(text, [
      "tell me more",
      "learn more",
      "how does it work",
      "how does this work",
      "how does this actually work",
      "what do you do",
      "what do you guys do",
      "explain",
    ]),
    priceQuestion: includesAny(text, [
      "price",
      "pricing",
      "cost",
      "how much",
      "what does it cost",
    ]),
    faqQuestion: includesAny(text, [
      "how does it work",
      "what do you do",
      "what do you guys do",
      "how does this work",
    ]),
    identityQuestion: includesAny(text, [
      "who is this",
      "who are you",
      "how did you get my number",
      "how did you get my info",
      "why are you texting",
    ]),
    meetingBooked: includesAny(text, [
      "i booked",
      "i've booked",
      "ive booked",
      "already booked",
      "scheduled",
      "booked a time",
      "made an appointment",
      "appointment booked",
    ]),
    stop,
    decline,
    requestReport: includesAny(text, [
      "just send me the report",
      "send me the report",
      "send the report",
      "where is my report",
    ]),
    notReady: includesAny(text, [
      "just curious",
      "i'm not ready",
      "im not ready",
      "not ready",
      "just looking",
      "i was just looking",
      "im just looking",
    ]),
    justTesting: includesAny(text, [
      "just testing",
      "just trying it",
      "just playing",
      "just checking it out",
    ]),
    requestInformation: includesAny(text, [
      "just send me information",
      "send me information",
      "just send information",
      "send information",
      "send me info",
    ]),
    answeringService: includesAny(text, [
      "answering service",
      "call center",
      "already have an answering service",
    ]),
    officeStaff: includesAny(text, [
      "office staff",
      "already have staff",
      "have a team",
      "my team handles",
      "our team handles",
      "receptionist handles",
      "my receptionist handles",
      "csr handles",
    ]),
    alreadyUsesAi: includesAny(text, [
      "already use ai",
      "already using ai",
      "we use ai",
      "we already use ai",
      "have ai",
    ]),
    customization: includesAny(text, [
      "custom version",
      "customized",
      "custom agent",
      "how would a custom",
      "how would my version",
    ]),
    orchestration: includesAny(text, ["orchestration", "orchestrated", "orchestrate"]),
    faq624voice: includesAny(text, [
      "what does 624",
      "what is 624voice",
      "what does 624voice",
    ]),
    demoError: includesAny(text, [
      "misunderstood",
      "handled incorrectly",
      "got it wrong",
      "didn't understand",
      "didnt understand",
      "broke",
      "error",
      "bug",
      "glitch",
    ]),
    fitResponse: detectFitResponse(text),
    yes: text === "yes" || text === "yeah" || text === "yep",
    no: text === "no" || text === "nope",
    vague:
      text.length <= 3 ||
      includesAny(text, ["idk", "i don't know", "i dont know", "not sure", "unsure"]) ||
      text === "ok" ||
      text === "k" ||
      text === "sure",
    hasSubstance: text.length > 12 && !includesAny(text, ["yes", "no", "ok"]),
  };
}

export function hasEstablishedContext(context: ConversationContextSignals): boolean {
  if (context.detectedPains && context.detectedPains.length > 0) {
    return true;
  }
  if (context.priorContextMessage) {
    const seed = analyzeMessage(context.priorContextMessage);
    if (seed.pains.length > 0 || seed.hasSubstance) {
      return true;
    }
  }
  if (context.lastCustomerMessage) {
    const prior = analyzeMessage(context.lastCustomerMessage);
    return prior.pains.length > 0 || prior.hasSubstance;
  }
  return false;
}

export function painAndUrgency(signals: MessageSignals): boolean {
  return signals.pains.length > 0 && (signals.urgency === "high" || signals.urgency === "medium");
}

export function shouldSendCalendarNow(
  signals: MessageSignals,
  context: ConversationContextSignals = {},
): boolean {
  if (signals.explicitMeetingReady) {
    return true;
  }
  if (signals.positiveReaction === "strong") {
    return true;
  }
  if (signals.pains.length > 0 && signals.urgency === "high") {
    return true;
  }
  if (signals.mildPositiveInterest && hasEstablishedContext(context)) {
    return true;
  }
  return false;
}

export function shouldAskPersonalizationQuestion(
  signals: MessageSignals,
  context: ConversationContextSignals = {},
): boolean {
  return (
    signals.mildPositiveInterest &&
    !shouldSendCalendarNow(signals, context) &&
    !hasEstablishedContext(context)
  );
}

export function primaryPainLabel(pains: PainCategory[]): string {
  if (pains.includes("after_hours") || pains.includes("missed_calls")) {
    return "after-hours and missed-call coverage";
  }
  if (pains.includes("slow_response")) {
    return "faster lead response";
  }
  if (pains.includes("follow_up")) {
    return "follow-up";
  }
  if (pains.includes("workload")) {
    return "reducing office workload";
  }
  if (pains.includes("website")) {
    return "your website";
  }
  if (pains.includes("scheduling")) {
    return "scheduling and booking";
  }
  if (pains.includes("multiple")) {
    return "your customer response workflow";
  }
  return "your current process";
}
