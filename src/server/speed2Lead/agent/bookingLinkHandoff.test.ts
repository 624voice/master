import { describe, expect, test, beforeEach } from "bun:test";
import {
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const { createAgentSession } = await import("~/server/speed2Lead/agent/state");
const {
  isBridgeAgreement,
  shouldResendBookingLink,
  shouldTransitionToBookingLink,
  updateLeadBookingLinkSentAt,
} = await import("~/server/speed2Lead/agent/bookingLinkHandoff");
const { bookingLinkHandoffCopy, bookingLinkFollowUpCopy, bookingLinkResendCopy } = await import(
  "~/server/speed2Lead/agent/bookingLinkCopy"
);
const { computeFollowUpTimes } = await import("~/server/speed2Lead/agent/bookingLinkFollowUps");
const { saveLeadIndex, getLeadsByPhone } = await import("~/server/appointmentLifecycle/store");

describe("§4 meeting-intent evaluators", () => {
  test("4a Path A fires on explicit scheduling ask before pending", () => {
    const session = createAgentSession({ tenantId: "t", phone: "+15551111111", flow: "roi" });
    expect(shouldTransitionToBookingLink(session, "can we schedule a call")).toBe(true);
    expect(shouldResendBookingLink(session, "can we schedule a call")).toBe(false);
  });

  test("4a Path B fires on bare yes only after a delivered bridge", () => {
    const session = createAgentSession({ tenantId: "t", phone: "+15551111111", flow: "contact" });
    session.stage = "bridge";
    expect(shouldTransitionToBookingLink(session, "yes")).toBe(false);
    session.bridgeDeliveredAt = "2026-01-01T12:00:00.000Z";
    expect(isBridgeAgreement("yes")).toBe(true);
    expect(shouldTransitionToBookingLink(session, "yes")).toBe(true);
    expect(shouldTransitionToBookingLink(session, "maybe later")).toBe(false);
  });

  test("4a does not fire when already pending", () => {
    const session = createAgentSession({ tenantId: "t", phone: "+15551111111", flow: "demo" });
    session.stage = "booking_link_pending";
    session.bridgeDeliveredAt = "2026-01-01T12:00:00.000Z";
    expect(shouldTransitionToBookingLink(session, "yes")).toBe(false);
    expect(shouldResendBookingLink(session, "send the link again")).toBe(true);
  });
});

describe("§11 copy is exact", () => {
  const link = "https://example.test/book";
  test("ROI / Contact / Demo handoff + resend + follow-ups", () => {
    expect(bookingLinkHandoffCopy("roi", link)).toBe(
      `Sounds good — grab a time that works here: ${link}. Once you book I'll send the details, and I'm around if anything comes up before then.`,
    );
    expect(bookingLinkHandoffCopy("contact", link)).toBe(
      `Great — pick a time that works here: ${link}. I'll confirm once it's booked, and I'm here if you have questions in the meantime.`,
    );
    expect(bookingLinkHandoffCopy("demo", link)).toBe(
      `Awesome — grab a time here: ${link}. I'll send the confirmation once it's set, and I'm around if anything else comes up about Jessica before then.`,
    );
    expect(bookingLinkResendCopy(link)).toBe(`Here's that link again: ${link}`);
    expect(bookingLinkFollowUpCopy("roi", 0, "Jamie", link)).toBe(
      `Hey Jamie — did you get a chance to grab a time? Here's the link again if you need it: ${link}`,
    );
    expect(bookingLinkFollowUpCopy("roi", 1, "Jamie", link)).toBe(
      `Just circling back — still happy to walk through the report with you. Grab a time here whenever works: ${link}`,
    );
    expect(bookingLinkFollowUpCopy("contact", 1, "Jamie", link)).toBe(
      `Following up — still happy to go over what you're looking for. Grab a time here whenever works: ${link}`,
    );
    expect(bookingLinkFollowUpCopy("demo", 1, "Jamie", link)).toBe(
      `Following up on Jessica — still happy to dig into how it'd work for you. Grab a time here whenever works: ${link}`,
    );
    expect(bookingLinkFollowUpCopy("roi", 2, "Jamie", link)).toBe(
      "I'll close the loop here so I don't keep chasing you. If you want to look at this later, just text me and we can pick it back up.",
    );
  });
});

describe("§7 absolute offsets", () => {
  test("all three offsets are independent from bookingLinkSentAt", () => {
    const times = computeFollowUpTimes("2026-01-01T12:00:00.000Z", [240, 1440, 4320]);
    expect(times[0]).toBe("2026-01-01T16:00:00.000Z");
    expect(times[1]).toBe("2026-01-02T12:00:00.000Z");
    expect(times[2]).toBe("2026-01-04T12:00:00.000Z");
  });
});

describe("§5 precise lead write", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
  });

  test("updates only the sending session's record and never changes source", async () => {
    await saveLeadIndex({
      phone: "+15551230000",
      email: "a@example.com",
      firstName: "A",
      source: "roi",
      smsConsent: true,
      registeredAt: "2026-01-01T00:00:00.000Z",
    });
    await saveLeadIndex({
      phone: "+15551230000",
      email: "a@example.com",
      firstName: "A",
      source: "contact",
      smsConsent: true,
      registeredAt: "2026-01-02T00:00:00.000Z",
    });

    const session = createAgentSession({
      tenantId: "t",
      phone: "+15551230000",
      flow: "contact",
      email: "a@example.com",
    });
    session.leadRegisteredAt = "2026-01-02T00:00:00.000Z";
    await updateLeadBookingLinkSentAt(session, "2026-01-03T12:00:00.000Z");

    const leads = await getLeadsByPhone("+15551230000");
    const roi = leads.find((l) => l.source === "roi")!;
    const contact = leads.find((l) => l.source === "contact")!;
    expect(roi.bookingLinkSentAt).toBeUndefined();
    expect(contact.bookingLinkSentAt).toBe("2026-01-03T12:00:00.000Z");
    expect(roi.source).toBe("roi");
    expect(contact.source).toBe("contact");
  });
});
