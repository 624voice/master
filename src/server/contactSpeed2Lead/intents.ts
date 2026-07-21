import type { ContactConversationState } from "~/server/contactSpeed2Lead/types";

export type ContactIntent =
  | "stop"
  | "decline"
  | "goal_booking_jobs"
  | "goal_growing_staff"
  | "goal_improving_calls"
  | "goal_both"
  | "goal_something_else"
  | "goal_not_sure"
  | "faq"
  | "faq_voice_ai"
  | "faq_website"
  | "request_information"
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
  | "call_fewer_missed"
  | "call_after_hours"
  | "call_consistent_answers"
  | "call_easier_scheduling"
  | "yes"
  | "no"
  | "detail";

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

export function classifySubgoalIntent(rawText: string): ContactIntent | null {
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
      "responding faster",
      "respond faster",
      "slow responses",
      "slow response",
      "new leads faster",
      "leads faster",
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

function isSubgoalSelectionState(state?: ContactConversationState): boolean {
  return (
    state === "awaiting_contact_booking_subgoal" ||
    state === "awaiting_contact_vague_booking_subgoal"
  );
}

export function classifyContactIntent(
  rawText: string,
  state?: ContactConversationState,
): ContactIntent {
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
      "just send me information",
      "send me information",
      "just send information",
      "send information",
    ])
  ) {
    return "request_information";
  }

  if (
    includesAny(text, [
      "just curious",
      "i was just looking",
      "im just looking",
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
      "voice ai",
      "ai agent",
      "ai voice",
      "voice agent",
    ])
  ) {
    return "faq_voice_ai";
  }

  if (includesAny(text, ["website", "web site"])) {
    return "faq_website";
  }

  if (
    includesAny(text, [
      "fewer missed calls",
      "missed calls",
      "fewer missed",
    ])
  ) {
    return "call_fewer_missed";
  }

  if (includesAny(text, ["after-hours coverage", "after hours coverage", "after hours"])) {
    return "call_after_hours";
  }

  if (includesAny(text, ["consistent answers", "more consistent answers"])) {
    return "call_consistent_answers";
  }

  if (includesAny(text, ["easier scheduling", "scheduling easier"])) {
    return "call_easier_scheduling";
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
      "reducing office workload",
      "reduce office workload",
      "reducing workload",
      "reduce the workload",
      "reduce workload",
      "office workload",
      "office team",
    ])
  ) {
    return "goal_growing_staff";
  }

  if (
    includesAny(text, [
      "improving how customer calls",
      "improving customer calls",
      "customer calls are handled",
      "call handling",
      "handle calls",
    ])
  ) {
    return "goal_improving_calls";
  }

  if (
    includesAny(text, [
      "something else",
      "something different",
    ])
  ) {
    return "goal_something_else";
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
      "more booked revenue",
      "bringing in more booked revenue",
      "more revenue",
    ])
  ) {
    return "subgoal_booking_revenue";
  }

  if (
    includesAny(text, [
      "freeing up your team's time",
      "freeing up team time",
      "freeing up time",
      "team's time",
      "team time",
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
