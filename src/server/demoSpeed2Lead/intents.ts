import type { DemoConversationState } from "~/server/demoSpeed2Lead/types";

export type DemoIntent =
  | "stop"
  | "decline"
  | "feature_faq"
  | "feature_booking"
  | "feature_confirmation"
  | "feature_maintenance"
  | "feature_multiple"
  | "not_sure"
  | "positive_feedback"
  | "negative_feedback"
  | "demo_error"
  | "faq_624voice"
  | "customization"
  | "orchestration"
  | "price"
  | "office_staff"
  | "answering_service"
  | "already_uses_ai"
  | "ready_to_book"
  | "just_testing"
  | "not_ready"
  | "vague_response"
  | "meeting_booked"
  | "after_hours"
  | "consistent_information"
  | "routine_questions"
  | "capturing_after_hours"
  | "reducing_scheduling"
  | "easier_booking"
  | "fewer_missed"
  | "less_manual"
  | "professional_experience"
  | "recurring_revenue"
  | "offer_consistently"
  | "reaching_customers"
  | "capturing_revenue"
  | "reducing_workload"
  | "both"
  | "immediate_response"
  | "taking_work_off"
  | "yes"
  | "no"
  | "detail";

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function isFreeFormSelectionState(state: DemoConversationState): boolean {
  return (
    state === "awaiting_faq_business_value" ||
    state === "awaiting_booking_value" ||
    state === "awaiting_confirmation_value" ||
    state === "awaiting_maintenance_value" ||
    state === "awaiting_multiple_priority" ||
    state === "awaiting_not_sure_relevance" ||
    state === "awaiting_vague_clarification"
  );
}

export function classifyDemoIntent(
  rawText: string,
  state?: DemoConversationState,
): DemoIntent {
  const text = normalize(rawText);

  if (!text) {
    return "detail";
  }

  if (
    includesAny(text, [
      "stop",
      "unsubscribe",
      "cancel",
      "end",
      "quit",
      "remove me",
      "do not text me",
      "don't text me",
      "opt out",
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
      "i booked",
      "i've booked",
      "ive booked",
      "already booked",
      "scheduled",
      "booked a time",
      "made an appointment",
      "appointment booked",
    ])
  ) {
    return "meeting_booked";
  }

  if (
    includesAny(text, [
      "let's talk",
      "lets talk",
      "learn more",
      "show me",
      "next step",
      "what is the next step",
      "want to speak",
      "can we talk",
    ])
  ) {
    return "ready_to_book";
  }

  if (
    includesAny(text, [
      "what does 624",
      "what do you guys do",
      "what do you do",
      "what is 624voice",
      "what does 624voice",
    ])
  ) {
    return "faq_624voice";
  }

  if (
    includesAny(text, [
      "custom version",
      "customized",
      "custom agent",
      "how would a custom",
      "how would my version",
    ])
  ) {
    return "customization";
  }

  if (includesAny(text, ["orchestration", "orchestrated", "orchestrate"])) {
    return "orchestration";
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

  if (
    includesAny(text, [
      "office staff",
      "already have staff",
      "have a team",
      "my team",
    ])
  ) {
    return "office_staff";
  }

  if (includesAny(text, ["answering service", "call center"])) {
    return "answering_service";
  }

  if (
    includesAny(text, [
      "already use ai",
      "already using ai",
      "we use ai",
      "have ai",
    ])
  ) {
    return "already_uses_ai";
  }

  if (
    includesAny(text, [
      "just testing",
      "just checking",
      "only testing",
      "was just testing",
      "just curious",
    ])
  ) {
    return "just_testing";
  }

  if (
    includesAny(text, [
      "not ready",
      "i'm not ready",
      "im not ready",
    ])
  ) {
    return "not_ready";
  }

  if (state && isFreeFormSelectionState(state)) {
    return classifySubBranchIntent(text);
  }

  if (
    includesAny(text, [
      "not very good",
      "not good",
      "made mistakes",
      "felt robotic",
      "did not work",
      "didn't work",
      "was bad",
      "was terrible",
      "didn't like",
      "did not like",
    ])
  ) {
    return "negative_feedback";
  }

  if (
    includesAny(text, [
      "misunderstood",
      "handled incorrectly",
      "got it wrong",
      "made an error",
      "demo error",
      "bug",
      "glitch",
    ])
  ) {
    return "demo_error";
  }

  if (
    includesAny(text, [
      "impressive",
      "pretty cool",
      "good job",
      "she did a good job",
      "i liked it",
      "that was cool",
      "that was great",
      "loved it",
    ])
  ) {
    return "positive_feedback";
  }

  if (
    includesAny(text, [
      "all of it",
      "the whole thing",
      "several parts",
      "multiple",
      "everything",
      "booking and the maintenance",
      "booking and maintenance",
      "all of the above",
    ])
  ) {
    return "feature_multiple";
  }

  if (
    includesAny(text, [
      "not sure",
      "i'm not sure",
      "im not sure",
      "unsure",
      "i don't know",
      "i dont know",
      "don't know",
      "dont know",
    ])
  ) {
    return "not_sure";
  }

  if (
    includesAny(text, [
      "maintenance plan",
      "maintenance",
      "care plan",
      "recurring",
      "membership",
    ])
  ) {
    return "feature_maintenance";
  }

  if (
    includesAny(text, [
      "confirmation",
      "confirmed",
      "confirm",
      "reminder",
    ])
  ) {
    return "feature_confirmation";
  }

  if (
    includesAny(text, [
      "booked the visit",
      "booking",
      "schedule",
      "scheduled",
      "appointment",
      "book a visit",
    ])
  ) {
    return "feature_booking";
  }

  if (
    includesAny(text, [
      "answered questions",
      "answering questions",
      "questions",
      "faq",
      "information",
    ])
  ) {
    return "feature_faq";
  }

  if (text === "yes" || text === "yeah" || text === "yep") {
    return "yes";
  }

  if (text === "no" || text === "nope") {
    return "no";
  }

  if (
    includesAny(text, [
      "sure",
      "sounds good",
      "maybe",
      "interesting",
      "ok",
      "okay",
    ])
  ) {
    return "vague_response";
  }

  return "detail";
}

function classifySubBranchIntent(text: string): DemoIntent {
  if (
    includesAny(text, [
      "after hours",
      "after-hours",
      "afterhours",
    ])
  ) {
    if (
      includesAny(text, [
        "capturing",
        "requests",
        "book outside",
      ])
    ) {
      return "capturing_after_hours";
    }
    return "after_hours";
  }

  if (
    includesAny(text, [
      "consistent information",
      "consistent answers",
      "consistent",
      "same information",
    ])
  ) {
    return "consistent_information";
  }

  if (
    includesAny(text, [
      "routine questions",
      "repetitive questions",
      "same questions",
      "common questions",
    ])
  ) {
    return "routine_questions";
  }

  if (
    includesAny(text, [
      "capturing requests",
      "capture requests",
      "book outside",
      "outside business hours",
    ])
  ) {
    return "capturing_after_hours";
  }

  if (
    includesAny(text, [
      "reducing scheduling",
      "scheduling work",
      "reduce scheduling",
      "scheduling workload",
    ])
  ) {
    return "reducing_scheduling";
  }

  if (
    includesAny(text, [
      "easier to book",
      "easier booking",
      "making it easier",
      "easier for customers",
    ])
  ) {
    return "easier_booking";
  }

  if (
    includesAny(text, [
      "fewer missed",
      "missed appointments",
      "no-shows",
      "no shows",
    ])
  ) {
    return "fewer_missed";
  }

  if (
    includesAny(text, [
      "manual follow-up",
      "manual follow up",
      "less manual",
      "manual tasks",
    ])
  ) {
    return "less_manual";
  }

  if (
    includesAny(text, [
      "professional",
      "customer experience",
      "more professional",
    ])
  ) {
    return "professional_experience";
  }

  if (
    includesAny(text, [
      "recurring revenue",
      "creating recurring",
      "recurring",
    ])
  ) {
    return "recurring_revenue";
  }

  if (
    includesAny(text, [
      "consistently",
      "making the offer",
      "offer consistently",
    ])
  ) {
    return "offer_consistently";
  }

  if (
    includesAny(text, [
      "reaching more",
      "reach more customers",
      "more customers",
    ])
  ) {
    return "reaching_customers";
  }

  if (
    includesAny(text, [
      "capturing more revenue",
      "more revenue",
      "capturing revenue",
      "unanswered inquiries",
      "slow follow-up",
      "unbooked",
    ])
  ) {
    return "capturing_revenue";
  }

  if (
    includesAny(text, [
      "reducing workload",
      "reduce workload",
      "reducing the workload",
      "office workload",
      "team workload",
      "taking work off",
      "repetitive work",
    ])
  ) {
    return "reducing_workload";
  }

  if (
    includesAny(text, [
      "immediate response",
      "immediate answer",
      "faster response",
      "get an immediate",
    ])
  ) {
    return "immediate_response";
  }

  if (
    includesAny(text, [
      "taking work",
      "off my team",
      "off the team",
      "repetitive task",
    ])
  ) {
    return "taking_work_off";
  }

  if (text === "both" || includesAny(text, ["both of those", "both goals"])) {
    return "both";
  }

  if (text === "yes" || text === "yeah" || text === "yep") {
    return "yes";
  }

  if (text === "no" || text === "nope") {
    return "no";
  }

  return "detail";
}

export function classifyInitialFeatureIntent(rawText: string): DemoIntent {
  const intent = classifyDemoIntent(rawText);

  if (
    intent === "feature_faq" ||
    intent === "feature_booking" ||
    intent === "feature_confirmation" ||
    intent === "feature_maintenance" ||
    intent === "feature_multiple" ||
    intent === "not_sure" ||
    intent === "positive_feedback" ||
    intent === "negative_feedback" ||
    intent === "demo_error"
  ) {
    return intent;
  }

  const text = normalize(rawText);

  if (includesAny(text, ["question", "answer", "info", "faq"])) {
    return "feature_faq";
  }

  if (includesAny(text, ["book", "schedule", "visit", "appointment"])) {
    return "feature_booking";
  }

  if (includesAny(text, ["confirm", "reminder", "confirmation"])) {
    return "feature_confirmation";
  }

  if (includesAny(text, ["maintenance", "plan", "recurring", "membership"])) {
    return "feature_maintenance";
  }

  return intent;
}
