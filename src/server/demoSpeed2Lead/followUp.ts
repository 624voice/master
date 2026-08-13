import type { DemoConversationContext, DemoFollowUpStage } from "~/server/demoSpeed2Lead/types";

export const MIN_DEMO_DURATION_SECONDS = 15;
export const FOLLOW_UP_1_DELAY_MS = 45 * 60 * 1000;

const CENTRAL_TIMEZONE = "America/Chicago";

function parseCentralParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function centralDateAt(
  year: number,
  month: number,
  day: number,
  hour = 10,
  minute = 0,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour + 6, minute));
  const observed = parseCentralParts(guess);
  const deltaHours = hour - observed.hour;
  const deltaMinutes = minute - observed.minute;
  return new Date(guess.getTime() + deltaHours * 3_600_000 + deltaMinutes * 60_000);
}

function isWeekendWeekday(weekday: string): boolean {
  return weekday === "Sat" || weekday === "Sun";
}

export function addBusinessDays(from: Date, businessDays: number): Date {
  let cursor = new Date(from.getTime());
  let remaining = businessDays;

  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    const { weekday, year, month, day } = parseCentralParts(cursor);
    if (!isWeekendWeekday(weekday)) {
      remaining -= 1;
      if (remaining === 0) {
        return centralDateAt(year, month, day, 10, 0);
      }
    }
  }

  const { year, month, day } = parseCentralParts(cursor);
  return centralDateAt(year, month, day, 10, 0);
}

export function scheduleFirstFollowUp(
  context: DemoConversationContext,
  demoCompletedAt: string,
): DemoConversationContext {
  const completedAt = new Date(demoCompletedAt);
  const nextFollowUpAt = new Date(completedAt.getTime() + FOLLOW_UP_1_DELAY_MS).toISOString();

  return {
    ...context,
    followUpStage: 0,
    nextFollowUpAt,
  };
}

export function getNextFollowUpStage(stage: DemoFollowUpStage | undefined): DemoFollowUpStage | null {
  if (stage === 0) return 1;
  if (stage === 1) return 2;
  if (stage === 2) return 3;
  return null;
}

export function computeNextFollowUpAt(
  context: DemoConversationContext,
  stage: DemoFollowUpStage,
): string | undefined {
  const completedAt = new Date(context.demoCompletedAt);

  if (stage === 1) {
    return new Date(completedAt.getTime() + FOLLOW_UP_1_DELAY_MS).toISOString();
  }

  if (stage === 2) {
    return addBusinessDays(completedAt, 1).toISOString();
  }

  if (stage === 3) {
    const followUp2At = addBusinessDays(completedAt, 1);
    return addBusinessDays(followUp2At, 3).toISOString();
  }

  return undefined;
}

export function shouldSendFollowUp(context: DemoConversationContext, now = new Date()): boolean {
  if (!context.nextFollowUpAt) {
    return false;
  }

  if (
    context.meetingBooked ||
    context.customerDeclined ||
    context.customerOptedOut ||
    context.humanTakeover
  ) {
    return false;
  }

  if (hasCustomerReplied(context)) {
    return false;
  }

  if (context.state !== "awaiting_fit" && context.state !== "completed") {
    return false;
  }

  return new Date(context.nextFollowUpAt).getTime() <= now.getTime();
}

export function hasCustomerReplied(context: DemoConversationContext): boolean {
  return Boolean(context.lastCustomerMessage);
}
