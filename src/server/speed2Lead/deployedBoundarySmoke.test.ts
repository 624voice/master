import { describe, expect, test } from "bun:test";
import { buildDeployVersionInfo } from "~/server/deployVersion";
import {
  resolveOfferedSlotSelectionCandidate,
} from "~/server/speed2Lead/schedulingContext";
import { parseSchedulingIntentUpdate } from "~/server/scheduling/intentParser";
import { allowCalendarLinkFallback } from "~/server/speed2Lead/schedulingGate";
import { planSchedulingGate } from "~/server/speed2Lead/schedulingController";
import { createInitialToolState } from "~/server/speed2Lead/tools";
import { createSession } from "~/server/speed2Lead/session";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import type { ConversationContext } from "~/server/speed2Lead/types";

const PREVIEW_URL =
  process.env.DEPLOYED_BOUNDARY_URL ?? "https://deploy-preview-61--624voice.netlify.app";
const now = centralDateAt(2026, 8, 21, 10, 0, CONSULTATION_TIMEZONE);

function freshRoiSession(phone: string): ConversationContext {
  return createSession({
    phone,
    firstName: "Alex",
    businessName: "Test Plumbing",
    annualOpportunity: "$120,000",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/test",
    bookingUrl: "https://calendar.app.google/test",
  });
}

describe("deployed-boundary smoke (deterministic subset)", () => {
  test("health endpoint returns deploy metadata when preview is reachable", async () => {
    if (process.env.RUN_DEPLOYED_BOUNDARY_HTTP !== "true") {
      expect(buildDeployVersionInfo().gitCommitSha).toBeTruthy();
      return;
    }

    const response = await fetch(`${PREVIEW_URL}/api/health`, {
      headers: { Accept: "application/json" },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as ReturnType<typeof buildDeployVersionInfo>;
    expect(body.gitCommitSha).toMatch(/^[0-9a-f]{7,40}$/);
    expect(body.deployContext).toBeTruthy();
    expect(body.branch).toBeTruthy();
    expect(body.environment).toBe("preview");
  });

  test("A–C: opening replies cannot authorize generic calendar fallback", () => {
    for (const message of ["Nothing really stood out", "All of it", "Prob missed calls"]) {
      const plan = planSchedulingGate({
        inboundMessage: message,
        context: freshRoiSession("+15551112001"),
        now,
      });
      expect(
        allowCalendarLinkFallback({
          plan,
          toolState: createInitialToolState(),
          context: freshRoiSession("+15551112001"),
        }),
      ).toBe(false);
    }
  });

  test("D: evenings work better maps to evening preference", () => {
    const patch = parseSchedulingIntentUpdate(
      "Evenings work better",
      { status: "idle", requestedDate: "2026-08-27" },
      now,
    );
    expect(patch.availabilityPreference).toBe("evening");
  });

  test("G: negated 4:30 is never a slot selection", () => {
    const offered = [
      "2026-08-27T16:30:00.000Z",
      "2026-08-27T18:00:00.000Z",
      "2026-08-27T19:30:00.000Z",
    ];
    for (const message of ["No 430", "no 4:30", "not 4:30", "4:30 doesn't work"]) {
      expect(resolveOfferedSlotSelectionCandidate(message, offered)).toBeNull();
    }
  });

  test("H: two fresh sessions start with clean scheduling state", () => {
    const phoneA = "+15551113001";
    const phoneB = "+15551113002";
    const sessionA = freshRoiSession(phoneA);
    const sessionB = freshRoiSession(phoneB);

    expect(sessionA.scheduling?.status).toBe("idle");
    expect(sessionB.scheduling?.status).toBe("idle");
    expect(sessionA.scheduling?.offeredSlots).toBeUndefined();
    expect(sessionB.scheduling?.offeredSlots).toBeUndefined();
    expect(sessionA.knownFacts?.meetingInterestConfirmed).toBeFalsy();
    expect(sessionB.knownFacts?.meetingInterestConfirmed).toBeFalsy();
    expect(sessionA.phone).not.toBe(sessionB.phone);
  });
});
