import { describe, expect, test } from "bun:test";
import { appendMessage, createAgentSession } from "~/server/speed2Lead/agent/state";

describe("createAgentSession", () => {
  test("starts in discovery with empty history and no offered slots", () => {
    const session = createAgentSession({
      tenantId: "624voice",
      phone: "5125551234",
      firstName: "Chris",
      businessName: "Acme HVAC",
    });

    expect(session.stage).toBe("discovery");
    expect(session.messages).toEqual([]);
    expect(session.offeredSlots).toEqual([]);
    expect(session.phone).toBe("+15125551234");
  });
});

describe("appendMessage", () => {
  test("appends without mutating the original session", () => {
    const session = createAgentSession({ tenantId: "624voice", phone: "+15125551234" });
    const next = appendMessage(session, "user", "hello");

    expect(session.messages).toEqual([]);
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]?.content).toBe("hello");
    expect(next.messages[0]?.role).toBe("user");
  });
});
