import { describe, expect, test } from "bun:test";
import {
  applyRoiDiscoveryCap,
  buildDiscoveryClosedFallback,
  canAskDiscoveryQuestion,
  markDiscoveryQuestionAsked,
  maxDiscoveryQuestionsForFlow,
  ROI_MAX_DISCOVERY_QUESTIONS,
} from "~/server/speed2Lead/agent/discoveryGuard";
import { createAgentSession } from "~/server/speed2Lead/agent/state";

function roiSession(overrides: Record<string, unknown> = {}) {
  return {
    ...createAgentSession({
      tenantId: "624voice",
      phone: "+12149722278",
      flow: "roi",
      firstName: "Jamie",
      businessName: "Acme HVAC",
    }),
    stage: "discovery" as const,
    ...overrides,
  };
}

describe("maxDiscoveryQuestionsForFlow", () => {
  test("returns 2 for roi, contact, and demo", () => {
    expect(maxDiscoveryQuestionsForFlow("roi")).toBe(ROI_MAX_DISCOVERY_QUESTIONS);
    expect(maxDiscoveryQuestionsForFlow("roi")).toBe(2);
    expect(maxDiscoveryQuestionsForFlow("contact")).toBe(2);
    expect(maxDiscoveryQuestionsForFlow("demo")).toBe(2);
  });
});

describe("applyRoiDiscoveryCap", () => {
  test("increments the counter when a discovery question is still allowed", () => {
    const session = roiSession({ discoveryQuestionCount: 0 });
    const result = applyRoiDiscoveryCap(session, {
      reply: "When a call goes unanswered, what usually happens to that job?",
      stage: "discovery",
    });
    expect(result.capped).toBe(false);
    expect(result.session.discoveryQuestionCount).toBe(1);
    expect(result.output.reply).toContain("what usually happens");
  });

  test("overrides a third discovery question with the scheduling kickoff", () => {
    let session = roiSession({ discoveryQuestionCount: 0 });
    session = markDiscoveryQuestionAsked(session);
    session = markDiscoveryQuestionAsked(session);
    expect(canAskDiscoveryQuestion(session)).toBe(false);

    const result = applyRoiDiscoveryCap(session, {
      reply: "How's that been affecting follow-up on your end?",
      stage: "discovery",
    });
    expect(result.capped).toBe(true);
    expect(result.output.stage).toBe("bridge");
    expect(result.output.reply).toBe(buildDiscoveryClosedFallback({ ...session, stage: "bridge" }));
    expect(result.output.reply).toBe("What day works best for a quick 25-minute chat?");
    expect(result.session.discoveryClosed).toBe(true);
    expect(result.session.stage).toBe("bridge");
  });

  test("does not rewrite contact or demo turns", () => {
    const session = {
      ...createAgentSession({
        tenantId: "624voice",
        phone: "+12149722278",
        flow: "contact" as const,
      }),
      stage: "discovery" as const,
      discoveryQuestionCount: 2,
    };
    const result = applyRoiDiscoveryCap(session, {
      reply: "What's that been costing you?",
      stage: "discovery",
    });
    expect(result.capped).toBe(false);
    expect(result.output.reply).toBe("What's that been costing you?");
  });
});
