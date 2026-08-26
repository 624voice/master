/**
 * Deterministic inbound guards the LLM turn must not be solely trusted for.
 * Keeps ambiguous discovery and meeting-decline transitions code-owned.
 */
import { buildPainPromptMessage } from "~/server/speed2Lead/agent/painPrompt";
import type { AgentProfile } from "~/server/speed2Lead/agent/profile";
import type { AgentSession, AgentStage } from "~/server/speed2Lead/agent/state";

const PAIN_PROMPT_MARKER = "which part of the report stood out";

const AMBIGUOUS_REPLY_EXACT = new Set([
  "not sure",
  "unsure",
  "maybe",
  "idk",
  "i dont know",
  "i don't know",
  "dont know",
  "don't know",
  "no idea",
  "not really",
  "hmm",
  "hm",
  "i guess",
  "dunno",
]);

const MEETING_DECLINE_PATTERNS = [
  /\bnot worth\b/,
  /\bprobably not\b/,
  /\bnot interested\b/,
  /\bno thanks\b/,
  /\bnah\b/,
  /\bi'?m good\b/,
  /\bwe'?re fine\b/,
  /\balready have\b/,
  /\bdon'?t think so\b/,
  /\bnot right now\b/,
  /\bpass on that\b/,
  /\bnot for me\b/,
  /\bstill not interested\b/,
];

function normalizeReplyText(body: string): string {
  return body.trim().toLowerCase().replace(/[^\w\s']/g, " ").replace(/\s+/g, " ").trim();
}

export function sessionAwaitingPainAnswer(session: AgentSession): boolean {
  if (session.primaryPain) return false;
  if (session.stage !== "discovery") return false;
  return session.messages.some(
    (message) => message.role === "assistant" && message.content.toLowerCase().includes(PAIN_PROMPT_MARKER),
  );
}

export function containsPainHint(body: string, profile: AgentProfile): boolean {
  const lower = body.toLowerCase();
  if (profile.headlinePainKeys.some((key) => lower.includes(key.replace(/_/g, " ")))) {
    return true;
  }
  return profile.painOutcomes.some((outcome) => {
    const short = outcome.shortLabel.toLowerCase();
    const label = outcome.label.toLowerCase();
    return lower.includes(short) || lower.includes(label);
  });
}

export function isAmbiguousDiscoveryReply(body: string): boolean {
  const normalized = normalizeReplyText(body);
  if (!normalized) return true;
  if (AMBIGUOUS_REPLY_EXACT.has(normalized)) return true;
  if (normalized.length <= 16 && /^(not sure|maybe|unsure|idk|hmm|i guess)/.test(normalized)) {
    return true;
  }
  return false;
}

export function buildPainClarifyingReply(profile: AgentProfile): string {
  const labels = profile.headlinePainKeys
    .map((key) => profile.painOutcomes.find((p) => p.key === key)?.shortLabel)
    .filter((label): label is string => Boolean(label));
  const list =
    labels.length > 1
      ? `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`
      : labels[0] ?? "missed opportunities";
  return `No worries — even a rough take helps. Was it more about ${list}?`;
}

export function isMeetingDecline(body: string): boolean {
  const normalized = normalizeReplyText(body);
  if (/stop texting|remove me|unsubscribe|leave me alone/.test(normalized)) {
    return false;
  }
  return MEETING_DECLINE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isMeetingDeclineStage(stage: AgentStage): boolean {
  return stage === "bridge" || stage === "offering_slots" || stage === "confirming";
}

export function painPromptText(profile: AgentProfile): string {
  return buildPainPromptMessage(profile).trim();
}
