import { describe, expect, test } from "bun:test";
import {
  buildContactNoResponseMessage3,
} from "~/server/speed2Lead/agent/contactFlow/noResponseCampaign";
import { DEFAULT_624VOICE_PROFILE, type AgentProfile } from "~/server/speed2Lead/agent/profile";
import { createAgentSession } from "~/server/speed2Lead/agent/state";

function contactSession() {
  return createAgentSession({
    tenantId: "624voice",
    phone: "+12149722278",
    flow: "contact",
    firstName: "Alex",
    businessName: "Test Plumbing",
  });
}

function profileWithoutGuarantee(): AgentProfile {
  const { resultsGuarantee: _omit, ...rest } = DEFAULT_624VOICE_PROFILE;
  return rest;
}

describe("buildContactNoResponseMessage3", () => {
  test("includes the profile 90-day guarantee", () => {
    const message = buildContactNoResponseMessage3(DEFAULT_624VOICE_PROFILE, contactSession());
    expect(message).toContain("90-day");
    expect(message).toContain("pay for itself in booked revenue");
    expect(message).not.toMatch(/does\.\./);
  });

  test("omits the guarantee clause when the field is unset", () => {
    const message = buildContactNoResponseMessage3(profileWithoutGuarantee(), contactSession());
    expect(message).not.toContain("90-day");
    expect(message).toContain("without adding more work or headcount.");
    expect(message).toContain("Would it be worth 25 minutes");
  });
});
