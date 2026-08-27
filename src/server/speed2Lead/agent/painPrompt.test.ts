import { describe, expect, test } from "bun:test";
import { DEFAULT_624VOICE_PROFILE } from "~/server/speed2Lead/agent/profile";
import { buildOpenerMessage1, buildPainPromptMessage } from "~/server/speed2Lead/agent/painPrompt";

describe("buildOpenerMessage1", () => {
  test("greets by name and states the opportunity with no question attached", () => {
    const message = buildOpenerMessage1(DEFAULT_624VOICE_PROFILE, {
      firstName: "Jamie",
      businessName: "Acme HVAC",
      annualOpportunity: "$120,000",
    });

    expect(message).toContain("Hey Jamie,");
    expect(message).toContain("Acme HVAC");
    expect(message).toContain("$120,000");
    expect(message).toContain(DEFAULT_624VOICE_PROFILE.senderFullName);
    expect(message).not.toContain("?");
  });

  test("omits the name when none is known", () => {
    const message = buildOpenerMessage1(DEFAULT_624VOICE_PROFILE, {
      businessName: "Acme HVAC",
      annualOpportunity: "$120,000",
    });

    expect(message.startsWith("Hey, ")).toBe(true);
  });
});

describe("buildPainPromptMessage", () => {
  test("lists the profile's headline pain labels as a question", () => {
    const message = buildPainPromptMessage(DEFAULT_624VOICE_PROFILE);

    expect(message).toContain("missed calls");
    expect(message).toContain("slow response");
    expect(message).toContain("follow-up");
    expect(message).toContain("?");
  });
});
