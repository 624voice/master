import { describe, expect, test } from "bun:test";
import {
  analyzeMessage,
  shouldAskPersonalizationQuestion,
  shouldSendCalendarNow,
} from "~/server/speed2Lead/naturalLanguage";

describe("analyzeMessage", () => {
  test("detects missed calls and after hours from natural language", () => {
    const signals = analyzeMessage("We miss a ton of calls after 5");
    expect(signals.pains).toContain("missed_calls");
    expect(signals.pains).toContain("after_hours");
  });

  test("detects office workload pain", () => {
    const signals = analyzeMessage("My CSR is drowning");
    expect(signals.pains).toContain("workload");
  });

  test("detects multiple problems", () => {
    const signals = analyzeMessage("All of it lol");
    expect(signals.pains).toContain("multiple");
  });

  test("detects explicit meeting readiness", () => {
    const signals = analyzeMessage("Can we talk?");
    expect(signals.explicitMeetingReady).toBe(true);
    expect(shouldSendCalendarNow(signals)).toBe(true);
  });

  test("treats interested as mild positive not explicit meeting ready", () => {
    const signals = analyzeMessage("interested");
    expect(signals.mildPositiveInterest).toBe(true);
    expect(signals.explicitMeetingReady).toBe(false);
    expect(shouldSendCalendarNow(signals)).toBe(false);
    expect(shouldAskPersonalizationQuestion(signals)).toBe(true);
  });

  test("treats sounds good as mild positive without context", () => {
    const signals = analyzeMessage("sounds good");
    expect(signals.mildPositiveInterest).toBe(true);
    expect(shouldSendCalendarNow(signals)).toBe(false);
  });

  test("sends calendar for mild positive when context exists", () => {
    const signals = analyzeMessage("sounds good");
    expect(
      shouldSendCalendarNow(signals, {
        detectedPains: ["missed_calls"],
      }),
    ).toBe(true);
  });

  test("detects pain plus urgency for immediate calendar", () => {
    const signals = analyzeMessage(
      "We're losing a ton of jobs after hours and need to fix it.",
    );
    expect(shouldSendCalendarNow(signals)).toBe(true);
  });

  test("detects strong positive separately from mild", () => {
    const awesome = analyzeMessage("That was awesome");
    expect(awesome.positiveReaction).toBe("strong");
    expect(shouldSendCalendarNow(awesome)).toBe(true);

    const cool = analyzeMessage("pretty cool");
    expect(cool.positiveReaction).toBe("mild");
    expect(cool.mildPositiveInterest).toBe(true);
    expect(shouldSendCalendarNow(cool)).toBe(false);
  });
});
