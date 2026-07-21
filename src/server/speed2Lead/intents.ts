import type { ConversationState } from "~/server/speed2Lead/types";

export type Intent =
  | "stop"
  | "decline"
  | "goal_booking_jobs"
  | "goal_growing_staff"
  | "goal_both"
  | "goal_not_sure"
  | "faq"
  | "request_report"
  | "not_ready"
  | "schedule_yes"
  | "vague_yes"
  | "price"
  | "answering_service"
  | "office_staff"
  | "subgoal_answering_calls"
  | "subgoal_responding_faster"
  | "subgoal_follow_up"
  | "subgoal_booking_revenue"
  | "subgoal_freeing_time"
  | "yes"
  | "no"
  | "detail";

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

export function classifySubgoalIntent(rawText: string): Intent | null {
  const text = normalize(rawText);

  if (
    includesAny(text, [
      "answering more calls",
      "answer more calls",
      "answering calls",
      "unanswered calls",
      "missed calls",
    ])
  ) {
    return "subgoal_answering_calls";
  }

  if (
    includesAny(text, [
      "responding to new leads faster",
      "responding to leads faster",
      "respond to new leads faster",
      "respond to leads faster",
      "responding to new leads",
      "responding to leads",
      "slow responses to new leads",
      "slow response",
      "new leads faster",
      "leads faster",
      "responding faster",
      "respond faster",
      "response speed",
      "faster response",
    ])
  ) {
    return "subgoal_responding_faster";
  }

  if (
    includesAny(text, [
      "following up more consistently",
      "follow up more consistently",
      "inconsistent follow-up",
      "inconsistent follow up",
      "following up more",
      "follow up more",
      "following up",
      "follow up",
      "follow-up",
      "followup",
    ])
  ) {
    return "subgoal_follow_up";
  }

  return null;
}

function isSubgoalSelectionState(state?: ConversationState): boolean {
  return (
    state === "awaiting_booking_subgoal" ||
    state === "awaiting_both_revenue_subgoal" ||
    state === "awaiting_vague_booking_subgoal"
  );
}

export function classifyIntent(
  rawText: string,
  state?: ConversationState,
): Intent {
  const text = normalize(rawText);

  if (!text) {
    return "detail";
  }

  if (
    includesAny(text, [
      "stop",
      "unsubscribe",
      "cancel texts",
      "opt out",
      "remove me",
    ])
  ) {
    return "stop";
  }

  if (
    includesAny(text, [
      "not interested",
      "no thanks",
      "leave me alone",
      "don't contact",
      "do not contact",
    ])
  ) {
    return "decline";
  }

  if (isSubgoalSelectionState(state)) {
    const subgoal = classifySubgoalIntent(text);
    if (subgoal) {
      return subgoal;
    }
  }

  if (
    includesAny(text, [
      "how does it work",
      "what do you guys do",
      "what do you do",
      "how does this work",
    ])
  ) {
    return "faq";
  }

  if (
    includesAny(text, [
      "just send me the report",
      "send me the report",
      "send the report",
      "where is my report",
    ])
  ) {
    return "request_report";
  }

  if (
    includesAny(text, [
      "just curious",
      "i'm not ready",
      "im not ready",
      "not ready",
    ])
  ) {
    return "not_ready";
  }

  if (
    includesAny(text, [
      "yes let's talk",
      "lets talk",
      "let's talk",
      "schedule",
      "book a time",
      "book a call",
      "set up a call",
    ])
  ) {
    return "schedule_yes";
  }

  if (
    includesAny(text, [
      "price",
      "pricing",
      "cost",
      "how much",
      "what does it cost",
    ])
  ) {
    return "price";
  }

  if (includesAny(text, ["answering service", "call center"])) {
    return "answering_service";
  }

  if (
    includesAny(text, [
      "office staff",
      "already have staff",
      "have a team",
    ])
  ) {
    return "office_staff";
  }

  if (
    includesAny(text, [
      "i don't know",
      "i dont know",
      "don't know",
      "dont know",
    ])
  ) {
    return "goal_not_sure";
  }

  const subgoal = classifySubgoalIntent(text);
  if (subgoal) {
    return subgoal;
  }

  if (
    includesAny(text, [
      "booking more jobs",
      "book more jobs",
      "more jobs",
    ])
  ) {
    return "goal_booking_jobs";
  }

  if (
    includesAny(text, [
      "reducing the workload",
      "reducing workload",
      "reduce the workload",
      "reduce workload",
      "growing without",
      "without adding",
      "freeing up your team",
      "freeing up time",
      "free up time",
      "freeing time",
      "free up",
    ])
  ) {
    return "goal_growing_staff";
  }

  if (text === "both" || includesAny(text, ["both of those", "both goals"])) {
    return "goal_both";
  }

  if (includesAny(text, ["not sure", "i'm not sure", "im not sure", "unsure"])) {
    return "goal_not_sure";
  }

  if (
    includesAny(text, [
      "booking more revenue",
      "book more revenue",
      "bringing in more booked revenue",
      "more booked revenue",
      "more revenue first",
      "revenue first",
      "more revenue",
    ])
  ) {
    return "subgoal_booking_revenue";
  }

  if (
    includesAny(text, [
      "freeing up your team's time",
      "freeing up team time",
      "team's time",
      "team time",
      "save time",
    ])
  ) {
    return "subgoal_freeing_time";
  }

  if (text === "sure" || text === "sounds good" || text === "ok") {
    return "vague_yes";
  }

  if (text === "yes" || text === "yeah" || text === "yep") {
    return "yes";
  }

  if (text === "no" || text === "nope") {
    return "no";
  }

  return "detail";
}
