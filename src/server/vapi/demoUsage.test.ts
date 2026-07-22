import { describe, expect, test } from "bun:test";
import { demoFormKeys, demoUsageKeys } from "./demoUsage";

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

describe("demoFormKeys", () => {
  test("uses separate form submission keys", () => {
    expect(demoFormKeys("Chris@Example.com", "(555) 123-4567").emailKey).toBe(
      "vapi:demo:form:email:chris@example.com",
    );
    expect(demoFormKeys("a@b.com", "(555) 123-4567").phoneKey).toBe(
      "vapi:demo:form:phone:+15551234567",
    );
  });
});
