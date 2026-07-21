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

export function classifyIntent(rawText: string): Intent {
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
      "booking more jobs",
      "book more jobs",
      "more jobs",
      "booking more revenue",
      "book more revenue",
      "more revenue",
    ])
  ) {
    return "goal_booking_jobs";
  }

  if (
    includesAny(text, [
      "growing without",
      "without adding",
      "freeing up",
      "free up",
      "reduce workload",
      "freeing time",
      "free up time",
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
      "answering more calls",
      "answer more calls",
      "missed calls",
    ])
  ) {
    return "subgoal_answering_calls";
  }

  if (
    includesAny(text, [
      "responding faster",
      "respond faster",
      "response speed",
      "faster response",
    ])
  ) {
    return "subgoal_responding_faster";
  }

  if (
    includesAny(text, ["follow up", "follow-up", "followup", "following up"])
  ) {
    return "subgoal_follow_up";
  }

  if (
    includesAny(text, [
      "booking more revenue",
      "more revenue first",
      "revenue first",
    ])
  ) {
    return "subgoal_booking_revenue";
  }

  if (
    includesAny(text, [
      "freeing up time",
      "free up time",
      "freeing time",
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
