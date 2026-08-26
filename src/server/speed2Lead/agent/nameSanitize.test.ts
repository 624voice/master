import { describe, expect, test } from "bun:test";
import { sanitizeFirstName } from "~/server/speed2Lead/agent/nameSanitize";

describe("sanitizeFirstName", () => {
  test("accepts plausible real names", () => {
    expect(sanitizeFirstName("Johnny")).toBe("Johnny");
    expect(sanitizeFirstName("chris")).toBe("Chris");
    expect(sanitizeFirstName("O'Brien")).toBe("O'Brien");
    expect(sanitizeFirstName("Mary-Jane")).toBe("Mary-Jane");
  });

  test("rejects the junk values seen in real testing", () => {
    // Covers the single-letter and known-placeholder values that produced
    // "Hey d," "Hey f," "Hey test," etc. in the transcripts. Arbitrary
    // keyboard-mash strings that happen to look word-shaped (e.g. "dadf")
    // can't be reliably distinguished from a short real name without a name
    // dictionary or an extra model call — out of scope for this pass.
    for (const junk of ["d", "f", "r", "t", "7", "test", "asdf", "speed"]) {
      expect(sanitizeFirstName(junk)).toBeUndefined();
    }
  });

  test("rejects empty, whitespace-only, and digit-only input", () => {
    expect(sanitizeFirstName("")).toBeUndefined();
    expect(sanitizeFirstName("   ")).toBeUndefined();
    expect(sanitizeFirstName("12345")).toBeUndefined();
    expect(sanitizeFirstName(undefined)).toBeUndefined();
    expect(sanitizeFirstName(null)).toBeUndefined();
  });

  test("rejects repeated-character noise", () => {
    expect(sanitizeFirstName("aaaa")).toBeUndefined();
    expect(sanitizeFirstName("ffff")).toBeUndefined();
  });
});
