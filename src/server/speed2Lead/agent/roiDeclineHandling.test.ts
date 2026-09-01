import { describe, expect, test } from "bun:test";
import { DEFAULT_624VOICE_PROFILE, type AgentProfile } from "~/server/speed2Lead/agent/profile";
import {
  buildRoiDeclineReframeFallback,
  resolveRoiDeclineAction,
  ROI_DECLINE_EXIT,
} from "~/server/speed2Lead/agent/roiDeclineHandling";
import { createAgentSession } from "~/server/speed2Lead/agent/state";

function roiSession(overrides: Record<string, unknown> = {}) {
  return {
    ...createAgentSession({
      tenantId: "624voice",
      phone: "+12149722278",
      flow: "roi",
      firstName: "Jamie",
      businessName: "Acme HVAC",
      annualOpportunity: "$118,500",
      primaryOpportunity: "Missed calls",
    }),
    stage: "bridge" as const,
    ...overrides,
  };
}

function profileWithoutGuarantee(): AgentProfile {
  const { resultsGuarantee: _omit, ...rest } = DEFAULT_624VOICE_PROFILE;
  return rest;
}

describe("buildRoiDeclineReframeFallback", () => {
  test("cites report context and the profile guarantee", () => {
    const reply = buildRoiDeclineReframeFallback(roiSession());
    expect(reply).toContain("$118,500");
    expect(reply).toContain("Missed calls");
    expect(reply).toContain("90-day");
    expect(reply).toContain(DEFAULT_624VOICE_PROFILE.resultsGuarantee);
  });

  test("omits the guarantee clause when the field is unset", () => {
    const reply = buildRoiDeclineReframeFallback(roiSession(), profileWithoutGuarantee());
    expect(reply).not.toContain("90-day");
    expect(reply).toContain("$118,500");
    expect(reply).toContain("Worth a look?");
  });
});

describe("resolveRoiDeclineAction", () => {
  test("returns none for non-roi flows", async () => {
    const session = {
      ...createAgentSession({
        tenantId: "624voice",
        phone: "+12149722278",
        flow: "contact",
      }),
      stage: "bridge" as const,
    };
    const action = await resolveRoiDeclineAction(session, "probably not worth a meeting");
    expect(action.type).toBe("none");
  });

  test("first decline sends a reframe and is not terminal", async () => {
    const session = roiSession();
    const action = await resolveRoiDeclineAction(session, "probably not worth a meeting", {
      generateReframe: async (current) => buildRoiDeclineReframeFallback(current),
    });
    expect(action.type).toBe("send");
    if (action.type === "send") {
      expect(action.sessionPatch.stage).not.toBe("declined");
      expect(action.sessionPatch.meetingDeclineCount).toBe(1);
      expect(action.reply).toContain("$118,500");
      expect(action.reply).toContain("90-day");
    }
  });

  test("second consecutive decline is a terminal graceful exit", async () => {
    const action = await resolveRoiDeclineAction(
      roiSession({ meetingDeclineCount: 1 }),
      "nah I'm good, still not interested",
    );
    expect(action.type).toBe("terminal");
    if (action.type === "terminal") {
      expect(action.reply).toBe(ROI_DECLINE_EXIT);
      expect(action.sessionPatch.stage).toBe("declined");
      expect(action.sessionPatch.meetingDeclineCount).toBe(2);
    }
  });
});
