import { describe, expect, test } from "bun:test";
import { resolveSpeed2LeadEnvFlag } from "~/server/speed2Lead/envFlags";

describe("resolveSpeed2LeadEnvFlag", () => {
  test("prefers runtime env when set", () => {
    process.env.SPEED2LEAD_AGENT_V2 = "true";
    expect(resolveSpeed2LeadEnvFlag("SPEED2LEAD_AGENT_V2")).toBe(true);
    delete process.env.SPEED2LEAD_AGENT_V2;
  });
});
