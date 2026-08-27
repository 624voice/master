import { beforeEach, describe, expect, test } from "bun:test";
import {
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const { isTerminalAgentSession, shouldSkipAgentOpener } = await import(
  "~/server/speed2Lead/agent/contactFlow/crossFlow"
);
const { createAgentSession, saveAgentSession } = await import(
  "~/server/speed2Lead/agent/state"
);
const { createSession, saveSession } = await import("~/server/speed2Lead/session");

const PHONE = "+15551234567";

beforeEach(() => {
  resetSpeed2LeadIntegrationMocks();
});

describe("isTerminalAgentSession", () => {
  test("booked, declined, and handoff are terminal", () => {
    for (const stage of ["booked", "declined", "handoff"] as const) {
      const session = createAgentSession({
        tenantId: "624voice",
        phone: PHONE,
        flow: "roi",
      });
      expect(isTerminalAgentSession({ ...session, stage })).toBe(true);
    }
  });

  test("in-progress stages are not terminal", () => {
    for (const stage of ["discovery", "bridge", "offering_slots", "confirming"] as const) {
      const session = createAgentSession({
        tenantId: "624voice",
        phone: PHONE,
        flow: "contact",
      });
      expect(isTerminalAgentSession({ ...session, stage })).toBe(false);
    }
  });
});

describe("shouldSkipAgentOpener", () => {
  test("terminal agent session on one flow does not block a new opener", async () => {
    const session = createAgentSession({
      tenantId: "624voice",
      phone: PHONE,
      flow: "roi",
    });
    await saveAgentSession({ ...session, stage: "booked" });
    expect(await shouldSkipAgentOpener(PHONE, "contact")).toEqual({ skip: false });
  });

  test("terminal agent session without flow field does not block", async () => {
    const session = createAgentSession({
      tenantId: "624voice",
      phone: PHONE,
      flow: "roi",
    });
    const legacyShape = { ...session, stage: "booked" as const };
    delete (legacyShape as { flow?: string }).flow;
    await saveAgentSession(legacyShape);
    expect(await shouldSkipAgentOpener(PHONE, "contact")).toEqual({ skip: false });
  });

  test("non-terminal agent session blocks a new opener on another flow", async () => {
    const session = createAgentSession({
      tenantId: "624voice",
      phone: PHONE,
      flow: "demo",
    });
    await saveAgentSession({ ...session, stage: "discovery" });
    expect(await shouldSkipAgentOpener(PHONE, "contact")).toEqual({
      skip: true,
      reason: "agent_session:demo",
    });
  });

  test("non-terminal agent session missing flow still blocks", async () => {
    const session = createAgentSession({
      tenantId: "624voice",
      phone: PHONE,
      flow: "roi",
    });
    const inProgress = { ...session, stage: "bridge" as const };
    delete (inProgress as { flow?: string }).flow;
    await saveAgentSession(inProgress);
    expect(await shouldSkipAgentOpener(PHONE, "contact")).toEqual({
      skip: true,
      reason: "agent_session:unknown",
    });
  });

  test("non-terminal legacy session still blocks", async () => {
    await saveSession(
      createSession({
        phone: PHONE,
        firstName: "Test",
        businessName: "Test Co",
        email: "test@example.com",
        annualOpportunity: "$50,000",
        primaryOpportunity: "Missed calls",
        reportUrl: "https://example.com/report",
        bookingUrl: "https://example.com/book",
      }),
    );
    expect(await shouldSkipAgentOpener(PHONE, "contact")).toEqual({
      skip: true,
      reason: "legacy_session:roi",
    });
  });
});
