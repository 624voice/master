import { describe, expect, test } from "bun:test";
import {
  buildDemoNoResponseMessage3,
  buildDemoNoResponseMessage4,
} from "~/server/speed2Lead/agent/demoFlow/noResponseCampaign";
import { DEFAULT_624VOICE_PROFILE, type AgentProfile } from "~/server/speed2Lead/agent/profile";
import { createAgentSession } from "~/server/speed2Lead/agent/state";

function demoSession() {
  return createAgentSession({
    tenantId: "624voice",
    phone: "+12149722278",
    flow: "demo",
    firstName: "Alex",
    businessName: "Test Plumbing",
  });
}

function profileWithoutGuarantee(): AgentProfile {
  const { resultsGuarantee: _omit, ...rest } = DEFAULT_624VOICE_PROFILE;
  return rest;
}

describe("demo no-response guarantee copy", () => {
  test("stage 3 includes the profile 90-day guarantee and Jessica/business copy", () => {
    const message = buildDemoNoResponseMessage3(DEFAULT_624VOICE_PROFILE, demoSession());
    expect(message).toContain("Jessica");
    expect(message).toContain("Test Plumbing");
    expect(message).toContain("90-day");
    expect(message).toContain("pay for itself in booked revenue");
  });

  test("stage 4 includes the profile 90-day guarantee", () => {
    const message = buildDemoNoResponseMessage4(DEFAULT_624VOICE_PROFILE, demoSession());
    expect(message).toContain("Jessica");
    expect(message).toContain("Test Plumbing");
    expect(message).toContain("90-day");
  });

  test("omits the guarantee clause when the field is unset", () => {
    const profile = profileWithoutGuarantee();
    const session = demoSession();
    expect(buildDemoNoResponseMessage3(profile, session)).not.toContain("90-day");
    expect(buildDemoNoResponseMessage4(profile, session)).not.toContain("90-day");
    expect(buildDemoNoResponseMessage3(profile, session)).toContain("payroll, would it be worth 25 minutes");
  });
});
