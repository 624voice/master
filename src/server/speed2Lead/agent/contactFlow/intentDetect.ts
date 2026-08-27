const DIRECT_MEETING_RE =
  /\b(can we schedule|when are you available|let'?s talk|send me (some )?times|can you show me|book a (call|meeting|appointment)|set up a (call|meeting)|schedule a (call|meeting|time))\b/i;

const PRICING_RE =
  /\b(how much|what does it cost|what'?s the price|pricing|what do you charge|cost\b|expensive)\b/i;

const TIMING_OBJECTION_RE =
  /\b(not a priority|not right now|not now|maybe later|too busy|no time|check back|another time|not interested right now|priority right now)\b/i;

const SKEPTICISM_OBJECTION_RE =
  /\b(not convinced|won'?t work|doesn'?t work|doubt|skeptic|already tried|won'?t solve|doesn'?t solve|not sure it|probably not)\b/i;

export function isDirectMeetingIntent(message: string): boolean {
  return DIRECT_MEETING_RE.test(message.trim());
}

export function isPricingQuestion(message: string): boolean {
  return PRICING_RE.test(message.trim());
}

export function classifyDeclineReasonReply(message: string): "timing" | "skepticism" | null {
  const normalized = message.trim().toLowerCase();
  if (TIMING_OBJECTION_RE.test(normalized)) return "timing";
  if (SKEPTICISM_OBJECTION_RE.test(normalized)) return "skepticism";
  if (/\bpriority\b/.test(normalized) && !/\bconvinced\b/.test(normalized)) return "timing";
  if (/\bconvinced\b|\bsolve\b|\bwork\b/.test(normalized)) return "skepticism";
  return null;
}

export function isPromptInjectionAttempt(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /ignore (all )?(previous|prior|above) instructions/.test(lower) ||
    /you are now|pretend you are|act as|system prompt|developer mode/.test(lower) ||
    /reveal (your )?(instructions|prompt|rules)/.test(lower)
  );
}

export function isOffTopicRedirect(message: string): boolean {
  const lower = message.toLowerCase();
  if (isDirectMeetingIntent(message) || isPricingQuestion(message)) return false;
  return (
    /\b(weather|bitcoin|recipe|write me a|poem|joke|who is the president|translate this)\b/.test(lower) ||
    /\b(call|text|email) (him|her|them|my wife|my husband)\b/.test(lower)
  );
}
