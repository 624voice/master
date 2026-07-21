import { describe, expect, test } from "bun:test";
import { demoUsageKeys } from "./demoUsage";

describe("demoUsageKeys", () => {
  test("normalizes email to lowercase", () => {
    expect(demoUsageKeys("Chris@Example.com", "(555) 123-4567").emailKey).toBe(
      "vapi:demo:email:chris@example.com",
    );
  });

  test("normalizes phone to E.164", () => {
    expect(demoUsageKeys("a@b.com", "(555) 123-4567").phoneKey).toBe(
      "vapi:demo:phone:+15551234567",
    );
  });
});
