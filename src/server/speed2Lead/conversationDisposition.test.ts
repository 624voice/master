import { describe, expect, test } from "bun:test";
import {
  detectTimingPushback,
  isGenericAcknowledgment,
  isSubstantiveReengagement,
  resolveDispositionAfterInbound,
  shouldBlockSchedulingTurn,
} from "~/server/speed2Lead/conversationDisposition";
import type { ConversationContext } from "~/server/speed2Lead/types";

function roiSession(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    flow: "roi",
    phone: "+15551234567",
    firstName: "Chris",
    businessName: "Test Plumbing",
    annualOpportunity: "$120,000",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/test",
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_problem",
    messages: [],
    knownFacts: {
      firstName: "Chris",
      phone: "+15551234567",
      flow: "roi",
      businessName: "Test Plumbing",
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("conversation disposition", () => {
  test("not right now sets soft_closed", () => {
    const disposition = resolveDispositionAfterInbound(
      roiSession(),
      "Not right now, im busy",
    );
    expect(disposition).toBe("soft_closed");
  });

  test("OK after soft close does not unblock scheduling", () => {
    const session = roiSession({ disposition: "soft_closed" });
    expect(shouldBlockSchedulingTurn(session, "Ok")).toBe(true);
    expect(isGenericAcknowledgment("Ok")).toBe(true);
    expect(isSubstantiveReengagement("Ok")).toBe(false);
  });

  test("substantive re-engagement reopens soft close", () => {
    const session = roiSession({ disposition: "soft_closed" });
    expect(isSubstantiveReengagement("Can we talk tomorrow?")).toBe(true);
    expect(resolveDispositionAfterInbound(session, "Can we talk tomorrow?")).toBe("active");
    expect(shouldBlockSchedulingTurn(session, "Can we talk tomorrow?")).toBe(false);
  });

  test("detects timing pushback variants", () => {
    expect(detectTimingPushback("I'm busy right now")).toBe(true);
    expect(detectTimingPushback("maybe later")).toBe(true);
  });
});
