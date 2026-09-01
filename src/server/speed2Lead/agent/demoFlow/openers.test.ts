import { describe, expect, test } from "bun:test";
import { buildDemoOpenerPart1 } from "~/server/speed2Lead/agent/demoFlow/openers";
import { computeDemoCallOutcome } from "~/server/speed2Lead/agent/demoFlow/startConversation";
import { createAgentSession } from "~/server/speed2Lead/agent/state";

describe("demo openers", () => {
  test("full-call opener uses Jessica stand-out question", () => {
    const session = {
      ...createAgentSession({
        tenantId: "624voice",
        phone: "+12149722278",
        flow: "demo",
        firstName: "Alex",
        businessName: "Test Plumbing",
      }),
      callOutcome: "full" as const,
    };
    const opener = buildDemoOpenerPart1(session);
    expect(opener).toContain("Saw you just finished trying Jessica");
    expect(opener).toContain("what stood out most");
  });

  test("short-call opener mentions cut out early", () => {
    const session = {
      ...createAgentSession({
        tenantId: "624voice",
        phone: "+12149722278",
        flow: "demo",
        firstName: "Alex",
      }),
      callOutcome: "short" as const,
    };
    const opener = buildDemoOpenerPart1(session);
    expect(opener).toContain("cut out early");
    expect(opener).toContain("fresh link");
  });

  test("omits a clearly broken first name from the greeting", () => {
    const session = {
      ...createAgentSession({
        tenantId: "624voice",
        phone: "+12149722278",
        flow: "demo",
        firstName: "xxx",
        businessName: "Test Plumbing",
      }),
      callOutcome: "full" as const,
    };
    const opener = buildDemoOpenerPart1(session);
    expect(opener.startsWith("Hey, ")).toBe(true);
    expect(opener).not.toContain("Hey xxx,");
  });
});

describe("computeDemoCallOutcome", () => {
  test("under 45 seconds is short", () => {
    expect(computeDemoCallOutcome(44)).toBe("short");
    expect(computeDemoCallOutcome(45)).toBe("full");
  });
});
