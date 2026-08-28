import { describe, expect, test } from "bun:test";
import { DEFAULT_624VOICE_PROFILE } from "~/server/speed2Lead/agent/profile";
import { createAgentSession } from "~/server/speed2Lead/agent/state";
import {
  countQuestions,
  enforceAtMostOneQuestion,
  guardAgentReply,
  looksLikeFabricatedBookingClaim,
  looksLikeUnauthorizedMeetingPlatform,
} from "~/server/speed2Lead/agent/scheduling/replyGuard";

describe("scheduling replyGuard", () => {
  test("detects fabricated booking claims", () => {
    expect(looksLikeFabricatedBookingClaim("Great, I've booked you for 3pm tomorrow.")).toBe(true);
    expect(looksLikeFabricatedBookingClaim("You're all set for Monday at 2pm.")).toBe(true);
    expect(looksLikeFabricatedBookingClaim("Tuesday at 10am is open.")).toBe(false);
  });

  test("detects unauthorized meeting platforms", () => {
    expect(looksLikeUnauthorizedMeetingPlatform("I'll send the Zoom link shortly.")).toBe(true);
    expect(looksLikeUnauthorizedMeetingPlatform("Join via Google Meet at meet.google.com/abc")).toBe(false);
  });

  test("keeps at most one question", () => {
    const combined =
      "Would it be worth 25 minutes to take a look? What day works best for a quick chat?";
    expect(countQuestions(combined)).toBe(2);
    expect(enforceAtMostOneQuestion(combined)).toBe(
      "Would it be worth 25 minutes to take a look?",
    );
  });

  test("strips combined bridge and day ask with one question mark", () => {
    const combined =
      "If I could show you a way to capture more calls without adding headcount, would it be worth 25 minutes to take a look, and what day works best for a quick chat?";
    expect(enforceAtMostOneQuestion(combined)).toBe(
      "If I could show you a way to capture more calls without adding headcount, would it be worth 25 minutes to take a look?",
    );
  });

  test("blocks booked stage without a real event", () => {
    const session = {
      ...createAgentSession({
        tenantId: "624voice",
        phone: "+12149722278",
        flow: "contact",
      }),
      stage: "confirming" as const,
    };
    const result = guardAgentReply({
      reply: "Great, I've booked you for 3pm tomorrow on Zoom.",
      session,
      fetchFailed: true,
      modelStage: "booked",
      bookingConfirmed: false,
    });
    expect(result.stage).not.toBe("booked");
    expect(result.reply).toContain("trouble finalizing");
    expect(result.flaggedFailure).toBe(true);
    expect(result.session.schedulingFailureReason).toBeTruthy();
  });

  test("allows code-owned confirmation path marker", () => {
    const session = {
      ...createAgentSession({
        tenantId: "624voice",
        phone: "+12149722278",
        flow: "contact",
      }),
      stage: "booked" as const,
      bookedEventId: "evt-123",
    };
    const confirmation = "You're booked for Thursday 2pm CT — Google Meet link in your inbox.";
    const result = guardAgentReply({
      reply: confirmation,
      session,
      fetchFailed: false,
      modelStage: "booked",
      bookingConfirmed: true,
    });
    expect(result.reply).toBe(confirmation);
    expect(result.flaggedFailure).toBe(false);
  });
});
