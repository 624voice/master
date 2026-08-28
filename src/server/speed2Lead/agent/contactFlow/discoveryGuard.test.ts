import { describe, expect, test } from "bun:test";
import {
  canAskDiscoveryQuestion,
  closeDiscovery,
  markDiscoveryQuestionAsked,
  shouldBlockDiscoveryReply,
} from "~/server/speed2Lead/agent/contactFlow/discoveryGuard";
import { createAgentSession } from "~/server/speed2Lead/agent/state";

describe("discoveryGuard", () => {
  test("caps discovery questions at two", () => {
    let session = createAgentSession({
      tenantId: "624voice",
      phone: "+12149722278",
      flow: "contact",
    });
    expect(canAskDiscoveryQuestion(session)).toBe(true);
    session = markDiscoveryQuestionAsked(session);
    expect(canAskDiscoveryQuestion(session)).toBe(true);
    session = markDiscoveryQuestionAsked(session);
    expect(canAskDiscoveryQuestion(session)).toBe(false);
    expect(session.discoveryClosed).toBe(true);
  });

  test("blocks discovery questions once closed", () => {
    const session = closeDiscovery(
      createAgentSession({ tenantId: "624voice", phone: "+12149722278", flow: "contact" }),
    );
    expect(shouldBlockDiscoveryReply(session, "What usually happens to those calls?")).toBe(true);
    expect(shouldBlockDiscoveryReply(session, "What day works best for a quick chat?")).toBe(false);
  });

  test("does not block scheduling preference replies during offering_slots", () => {
    const session = {
      ...closeDiscovery(
        createAgentSession({ tenantId: "624voice", phone: "+12149722278", flow: "contact" }),
      ),
      stage: "offering_slots" as const,
      offeredSlots: [],
      slotPool: [],
    };
    expect(
      shouldBlockDiscoveryReply(session, "What day or time range works best?", "Tomorrow"),
    ).toBe(false);
  });
});
