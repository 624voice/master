import { describe, expect, test } from "bun:test";
import {
  analyzeMessage,
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

  test("detects strong positive reaction", () => {
    const signals = analyzeMessage("That was awesome");
    expect(signals.positiveReaction).toBe("strong");
    expect(shouldSendCalendarNow(signals)).toBe(true);
  });

  test("detects meeting readiness", () => {
    const signals = analyzeMessage("Can we talk?");
    expect(signals.scheduleReady).toBe(true);
    expect(signals.meetingReadiness).toBe("high");
  });

  test("detects pain plus urgency for immediate calendar", () => {
    const signals = analyzeMessage(
      "We're losing a ton of jobs after hours and need to fix it.",
    );
    expect(shouldSendCalendarNow(signals)).toBe(true);
  });

  test("detects buying signal", () => {
    const signals = analyzeMessage("I need this");
    expect(signals.buyingSignal).toBe(true);
  });
});
