import { describe, expect, test } from "bun:test";
import { countSmsSegments, isGsm7Safe } from "~/server/appointmentLifecycle/smsEncoding";

describe("smsEncoding", () => {
  test("detects non-GSM-7 em dash", () => {
    expect(isGsm7Safe("Hello — world")).toBe(false);
  });

  test("accepts hyphen and apostrophe", () => {
    expect(isGsm7Safe("Perfect, Jane - you're booked.")).toBe(true);
  });

  test("counts single-segment GSM-7 message", () => {
    const text = "A".repeat(160);
    const result = countSmsSegments(text);
    expect(result.encoding).toBe("GSM-7");
    expect(result.segments).toBe(1);
  });

  test("counts multi-segment GSM-7 message", () => {
    const text = "A".repeat(161);
    const result = countSmsSegments(text);
    expect(result.segments).toBe(2);
  });
});
