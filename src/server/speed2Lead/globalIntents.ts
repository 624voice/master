import { analyzeMessage, type MessageSignals } from "~/server/speed2Lead/naturalLanguage";

export type GlobalIntent =
  | "stop"
  | "decline"
  | "meeting_booked"
  | "schedule_ready"
  | "price"
  | "faq"
  | "tell_me_more"
  | "request_report"
  | "not_ready"
  | "request_information"
  | "answering_service"
  | "office_staff"
  | "already_uses_ai"
  | "customization"
  | "orchestration"
  | "faq_624voice"
  | "just_testing"
  | "detail";

export function classifyGlobalIntent(rawText: string): GlobalIntent {
  const signals = analyzeMessage(rawText);

  if (signals.stop) {
    return "stop";
  }
  if (signals.decline) {
    return "decline";
  }
  if (signals.meetingBooked) {
    return "meeting_booked";
  }
  if (signals.scheduleReady || signals.buyingSignal) {
    return "schedule_ready";
  }
  if (signals.priceQuestion) {
    return "price";
  }
  if (signals.faq624voice) {
    return "faq_624voice";
  }
  if (signals.customization) {
    return "customization";
  }
  if (signals.orchestration) {
    return "orchestration";
  }
  if (signals.alreadyUsesAi) {
    return "already_uses_ai";
  }
  if (signals.answeringService) {
    return "answering_service";
  }
  if (signals.officeStaff) {
    return "office_staff";
  }
  if (signals.justTesting) {
    return "just_testing";
  }
  if (signals.requestReport) {
    return "request_report";
  }
  if (signals.requestInformation) {
    return "request_information";
  }
  if (signals.notReady) {
    return "not_ready";
  }
  if (signals.tellMeMore || signals.faqQuestion) {
    return "tell_me_more";
  }

  return "detail";
}

export function getSignals(rawText: string): MessageSignals {
  return analyzeMessage(rawText);
}
