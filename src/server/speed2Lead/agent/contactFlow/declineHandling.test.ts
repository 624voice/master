import { describe, expect, test } from "bun:test";
import {
  buildDeclineDiagnosisQuestion,
  buildSkepticismDeclineResponse,
  buildTimingDeclineExit,
} from "~/server/speed2Lead/agent/contactFlow/openers";
import { resolveContactDeclineAction } from "~/server/speed2Lead/agent/contactFlow/declineHandling";
import { DEFAULT_624VOICE_PROFILE } from "~/server/speed2Lead/agent/profile";
import { createAgentSession } from "~/server/speed2Lead/agent/state";

function contactSession(overrides: Partial<import("~/server/speed2Lead/agent/state").AgentSession> = {}) {
  return {
    ...createAgentSession({
      tenantId: "624voice",
      phone: "+12149722278",
      flow: "contact",
      firstName: "Alex",
      businessName: "Test Plumbing",
    }),
    stage: "bridge" as const,
    ...overrides,
  };
}

describe("resolveContactDeclineAction", () => {
  test("first decline sends diagnosis question", () => {
    const action = resolveContactDeclineAction(contactSession(), "probably not worth a meeting");
    expect(action.type).toBe("send");
    if (action.type === "send") {
      expect(action.reply).toBe(buildDeclineDiagnosisQuestion());
      expect(action.sessionPatch.declineDiagnosisSent).toBe(true);
    }
  });

  test("skepticism path uses profile resultsGuarantee", () => {
    const action = resolveContactDeclineAction(
      contactSession({ declineAwaitingReason: true, declineDiagnosisSent: true }),
      "I'm not convinced this would actually solve the problem",
    );
    expect(action.type).toBe("send");
    if (action.type === "send") {
      expect(action.reply).toBe(
        buildSkepticismDeclineResponse(DEFAULT_624VOICE_PROFILE, "Test Plumbing"),
      );
      expect(action.reply).toContain("90-day");
    }
  });

  test("timing reply after diagnosis exits gracefully", () => {
    const action = resolveContactDeclineAction(
      contactSession({ declineAwaitingReason: true, declineDiagnosisSent: true }),
      "not a priority right now",
    );
    expect(action.type).toBe("terminal");
    if (action.type === "terminal") {
      expect(action.reply).toBe(buildTimingDeclineExit());
      expect(action.sessionPatch.stage).toBe("declined");
    }
  });
});
