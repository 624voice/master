import { describe, expect, test } from "bun:test";
import { DEFAULT_624VOICE_PROFILE } from "~/server/speed2Lead/agent/profile";
import {
  buildNoResponseMessage,
  buildNoResponseMessage1,
  buildNoResponseMessage2,
  buildNoResponseMessage3,
  buildNoResponseMessage4,
  buildNoResponseMessage5,
  cancelPendingNoResponseCampaign,
  noResponseDueAt,
  scheduleNoResponseCampaign,
} from "~/server/speed2Lead/agent/noResponseCampaign";
import { createAgentSession } from "~/server/speed2Lead/agent/state";

function sessionWithName(firstName?: string) {
  return createAgentSession({
    tenantId: "624voice",
    phone: "+12149722278",
    firstName,
    businessName: "Acme HVAC",
  });
}

describe("buildNoResponseMessage1", () => {
  test("greets by name with em dash when first name is known", () => {
    const message = buildNoResponseMessage1(DEFAULT_624VOICE_PROFILE, sessionWithName("Jamie"));

    expect(message.startsWith("Hi Jamie — ")).toBe(true);
    expect(message).toContain("ROI report");
    expect(message).toContain("missed calls");
  });

  test("drops the name greeting when none is known", () => {
    const message = buildNoResponseMessage1(DEFAULT_624VOICE_PROFILE, sessionWithName());

    expect(message.startsWith("Hi ")).toBe(false);
    expect(message.startsWith("saw the ROI report come through")).toBe(true);
  });
});

describe("buildNoResponseMessage2", () => {
  test("greets by name with a period when first name is known", () => {
    const message = buildNoResponseMessage2(DEFAULT_624VOICE_PROFILE, sessionWithName("Jamie"));

    expect(message.startsWith("Hi Jamie. ")).toBe(true);
    expect(message).toContain("lost revenue");
  });

  test("drops the name greeting when none is known", () => {
    const message = buildNoResponseMessage2(DEFAULT_624VOICE_PROFILE, sessionWithName());

    expect(message.startsWith("Hi ")).toBe(false);
    expect(message.startsWith("Quick thought —")).toBe(true);
  });
});

describe("buildNoResponseMessage3", () => {
  test("asks which pain to fix first without a name greeting", () => {
    const message = buildNoResponseMessage3(DEFAULT_624VOICE_PROFILE, sessionWithName("Jamie"));

    expect(message).not.toContain("Hi Jamie");
    expect(message).toContain("missed calls");
    expect(message).toContain("faster lead response");
  });
});

describe("buildNoResponseMessage4", () => {
  test("uses the profile meeting length and does not greet by name", () => {
    const message = buildNoResponseMessage4(DEFAULT_624VOICE_PROFILE, sessionWithName("Jamie"));

    expect(message).not.toContain("Hi Jamie");
    expect(message).toContain(`${DEFAULT_624VOICE_PROFILE.meetingLengthMinutes} minutes`);
  });
});

describe("buildNoResponseMessage5", () => {
  test("closes the loop without an ask", () => {
    const message = buildNoResponseMessage5(DEFAULT_624VOICE_PROFILE, sessionWithName("Jamie"));

    expect(message).toContain("close the loop");
    expect(message).not.toContain("?");
  });
});

describe("buildNoResponseMessage", () => {
  test("dispatches to the stage builder by index", () => {
    const session = sessionWithName("Jamie");
    expect(buildNoResponseMessage(DEFAULT_624VOICE_PROFILE, session, 0)).toBe(
      buildNoResponseMessage1(DEFAULT_624VOICE_PROFILE, session),
    );
    expect(buildNoResponseMessage(DEFAULT_624VOICE_PROFILE, session, 4)).toBe(
      buildNoResponseMessage5(DEFAULT_624VOICE_PROFILE, session),
    );
  });
});

describe("noResponseDueAt", () => {
  test("offsets from session.createdAt using profile delay minutes", () => {
    const session = sessionWithName("Jamie");
    session.createdAt = "2026-01-01T12:00:00.000Z";

    const stage0 = noResponseDueAt(session, DEFAULT_624VOICE_PROFILE, 0);
    expect(stage0).toBe("2026-01-01T16:00:00.000Z");

    const stage1 = noResponseDueAt(session, DEFAULT_624VOICE_PROFILE, 1);
    expect(stage1).toBe("2026-01-02T12:00:00.000Z");
  });
});

describe("scheduleNoResponseCampaign", () => {
  test("enqueues stage 0 with the first due time", async () => {
    const session = sessionWithName("Jamie");
    session.createdAt = "2026-01-01T12:00:00.000Z";

    const scheduled = await scheduleNoResponseCampaign(session, DEFAULT_624VOICE_PROFILE);

    expect(scheduled.noResponseStage).toBe(0);
    expect(scheduled.noResponseNextAt).toBe("2026-01-01T16:00:00.000Z");
    expect(scheduled.noResponseResolved).toBe(false);
  });
});

describe("cancelPendingNoResponseCampaign", () => {
  test("marks the campaign resolved and clears the next due time", async () => {
    const session = {
      ...sessionWithName("Jamie"),
      noResponseStage: 2,
      noResponseNextAt: "2026-01-05T12:00:00.000Z",
      noResponseResolved: false,
    };

    const cancelled = await cancelPendingNoResponseCampaign(session);

    expect(cancelled.noResponseResolved).toBe(true);
    expect(cancelled.noResponseNextAt).toBeUndefined();
  });

  test("is a no-op when already resolved", async () => {
    const session = {
      ...sessionWithName("Jamie"),
      noResponseResolved: true,
      noResponseNextAt: undefined,
    };

    const cancelled = await cancelPendingNoResponseCampaign(session);
    expect(cancelled).toEqual(session);
  });
});
