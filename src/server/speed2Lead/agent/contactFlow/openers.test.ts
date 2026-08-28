import { describe, expect, test } from "bun:test";
import {
  classifyInquiryClarity,
  summarizeHelpText,
} from "~/server/speed2Lead/agent/contactFlow/inquiryClarity";
import {
  buildAlreadyClearOpener,
  buildClearNeedOpener,
  buildVagueInquiryOpener,
} from "~/server/speed2Lead/agent/contactFlow/openers";
import { createAgentSession } from "~/server/speed2Lead/agent/state";

function contactSession(overrides: Record<string, unknown> = {}) {
  return createAgentSession({
    tenantId: "624voice",
    phone: "+12149722278",
    flow: "contact",
    firstName: "Alex",
    businessName: "Test Plumbing",
    trade: "Plumbing",
    fleetSize: "3",
    helpTextSummary: "better call handling",
    formMessage: "We miss calls after hours",
    inquiryClarity: "clear",
    ...overrides,
  });
}

describe("classifyInquiryClarity", () => {
  test("classifies vague generic interest", () => {
    expect(classifyInquiryClarity("interested in AI")).toBe("vague");
    expect(classifyInquiryClarity("need more info")).toBe("vague");
  });

  test("classifies clear problem statement", () => {
    expect(classifyInquiryClarity("We keep missing calls after hours every night")).toBe("clear");
  });

  test("classifies already-clear when problem and outcome present", () => {
    expect(
      classifyInquiryClarity(
        "We miss calls after hours and it's costing us booked jobs — can we schedule a call?",
      ),
    ).toBe("already_clear");
  });
});

describe("contact openers", () => {
  test("clear need opener uses help summary and diagnostic question", () => {
    const message = buildClearNeedOpener(contactSession());
    expect(message).toContain("Hey Alex, Chris with 624Voice");
    expect(message).toContain("Test Plumbing");
    expect(message).toContain("better call handling");
    expect(message).toContain("what's happening today that made you start looking into this?");
  });

  test("vague opener asks what is prompting them now", () => {
    const message = buildVagueInquiryOpener(
      contactSession({ inquiryClarity: "vague", helpTextSummary: "your request" }),
    );
    expect(message).toContain("What's prompting you to look into this now?");
  });

  test("already-clear opener bridges toward meeting", () => {
    const message = buildAlreadyClearOpener(
      contactSession({
        inquiryClarity: "already_clear",
        formMessage: "We miss calls after hours and lose jobs",
        helpTextSummary: "better call handling",
      }),
    );
    expect(message).toContain("would it be worth 25 minutes to take a look?");
    expect(message).not.toContain("what's happening today");
  });

  test("summarizeHelpText delegates to need summary", () => {
    expect(summarizeHelpText("Need a new website")).toBe("a new website");
  });
});
