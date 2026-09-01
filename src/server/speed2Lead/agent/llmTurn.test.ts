import { describe, expect, test } from "bun:test";
import { enforceReplyHygiene, MAX_SMS_LENGTH } from "~/server/speed2Lead/agent/llmTurn";

describe("enforceReplyHygiene", () => {
  test("leaves short replies unchanged", () => {
    expect(enforceReplyHygiene("  What day works best?  ")).toBe("What day works best?");
  });

  test("does not split a word when truncating past 320 chars", () => {
    const original = Array.from({ length: 80 }, () => "opportunity").join(" ");
    expect(original.length).toBeGreaterThan(MAX_SMS_LENGTH);

    const result = enforceReplyHygiene(original);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(MAX_SMS_LENGTH);

    const stem = result.slice(0, -1);
    expect(original.startsWith(stem)).toBe(true);
    expect(stem.endsWith(" ")).toBe(false);
    const nextChar = original[stem.length];
    expect(nextChar === undefined || /\s/.test(nextChar)).toBe(true);
    expect(stem.endsWith("opportunit")).toBe(false);
  });

  test("prefers a sentence boundary in the last 40 characters", () => {
    const lead = "a".repeat(285);
    const original = `${lead}. ${"morewords ".repeat(20)}`;
    expect(original.length).toBeGreaterThan(MAX_SMS_LENGTH);

    const result = enforceReplyHygiene(original);
    expect(result).toBe(`${lead}.…`);
  });
});
