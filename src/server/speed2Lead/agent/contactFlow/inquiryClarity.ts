import { buildShortNeedSummary } from "~/server/contactSpeed2Lead/needSummary";
import type { InquiryClarity } from "~/server/speed2Lead/agent/state";

const VAGUE_INQUIRY_RE =
  /\b(interested|need more info|more info|tell me more|automation|ai voice|voice ai|ai agent|virtual receptionist|just curious|learning about|exploring options)\b/i;

const SCHEDULE_IN_FORM_RE =
  /\b(schedule|book|appointment|meet|call me|when are you available|send me times|can we talk)\b/i;

const PROBLEM_SIGNAL_RE =
  /\b(miss(ed|ing)? calls?|after hours|follow[- ]?up|slow response|voicemail|answering service|lead(s)?|scheduling|website|dispatch|overflow|drowning|can't keep up|cant keep up)\b/i;

const OUTCOME_SIGNAL_RE =
  /\b(book more|capture more|respond faster|lost (jobs|opportunities|revenue)|more work|headcount|revenue|customers can't reach)\b/i;

export function classifyInquiryClarity(formMessage: string): InquiryClarity {
  const text = formMessage.trim();
  const lower = text.toLowerCase();

  if (!text || text.length <= 12) {
    return "vague";
  }

  if (VAGUE_INQUIRY_RE.test(lower) && !PROBLEM_SIGNAL_RE.test(lower)) {
    return "vague";
  }

  if (SCHEDULE_IN_FORM_RE.test(lower)) {
    return "already_clear";
  }

  const hasProblem = PROBLEM_SIGNAL_RE.test(lower);
  const hasOutcome = OUTCOME_SIGNAL_RE.test(lower);
  if (hasProblem && (hasOutcome || text.length > 80)) {
    return "already_clear";
  }

  if (hasProblem) {
    return "clear";
  }

  if (VAGUE_INQUIRY_RE.test(lower)) {
    return "vague";
  }

  return "clear";
}

export function summarizeHelpText(formMessage: string): string {
  return buildShortNeedSummary(formMessage);
}

export function restateNeedForBridge(formMessage: string, helpTextSummary: string): string {
  const trimmed = formMessage.trim();
  if (trimmed.length <= 90) {
    return helpTextSummary.startsWith("a ") || helpTextSummary.startsWith("an ")
      ? helpTextSummary
      : trimmed.length <= 60
        ? trimmed
        : helpTextSummary;
  }
  return helpTextSummary;
}
