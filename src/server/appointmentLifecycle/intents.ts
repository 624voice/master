import { analyzeMessage, includesAny, normalize } from "~/server/speed2Lead/naturalLanguage";

export type LifecycleIntent = "reschedule" | "cancel" | "none";

const RESCHEDULE_PHRASES = [
  "reschedule",
  "re-schedule",
  "need to reschedule",
  "need another time",
  "another time",
  "move it",
  "move my appointment",
  "move my meeting",
  "can we move",
  "can't make that time",
  "cant make that time",
  "change my appointment",
  "change the appointment",
  "different time",
  "pick a new time",
  "need to change",
];

const CANCEL_PHRASES = [
  "cancel my meeting",
  "cancel my appointment",
  "cancel the meeting",
  "cancel the appointment",
  "need to cancel",
  "please cancel",
  "won't be able to make it",
  "wont be able to make it",
  "can't make it",
  "cant make it",
  "have to cancel",
];

export function classifyLifecycleIntent(rawText: string): LifecycleIntent {
  const text = normalize(rawText);
  const signals = analyzeMessage(rawText);

  if (signals.stop) {
    return "none";
  }

  if (includesAny(text, CANCEL_PHRASES) || text === "cancel") {
    return "cancel";
  }

  if (includesAny(text, RESCHEDULE_PHRASES)) {
    return "reschedule";
  }

  return "none";
}

export function isAmbiguousCancellation(rawText: string): boolean {
  const text = normalize(rawText);
  return (
    includesAny(text, ["can't make it", "cant make it", "won't be able"]) &&
    !includesAny(text, ["cancel", "appointment", "meeting"])
  );
}
