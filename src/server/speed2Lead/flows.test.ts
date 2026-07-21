import { describe, expect, test } from "bun:test";
import { classifyIntent, classifySubgoalIntent } from "./intents";
import { advanceConversation } from "./stateMachine";
import type { ConversationContext } from "./types";

function createContext(
  overrides: Partial<ConversationContext> = {},
): ConversationContext {
  return {
    phone: "+15551234567",
    firstName: "Speed",
    businessName: "Test S2L",
    annualOpportunity: "$1,266,144",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/test",
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_goal",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("classifySubgoalIntent", () => {
  test("matches exact prompt phrases from booking subgoal question", () => {
    expect(classifySubgoalIntent("answering more calls")).toBe(
      "subgoal_answering_calls",
    );
    expect(classifySubgoalIntent("Responding to new leads faster")).toBe(
      "subgoal_responding_faster",
    );
    expect(classifySubgoalIntent("Responding to leads faster")).toBe(
      "subgoal_responding_faster",
    );
    expect(classifySubgoalIntent("Following up more consistently")).toBe(
      "subgoal_follow_up",
    );
  });
});

describe("classifyIntent", () => {
  test("detects stop", () => {
    expect(classifyIntent("STOP")).toBe("stop");
  });

  test("detects booking goal", () => {
    expect(classifyIntent("Booking more jobs")).toBe("goal_booking_jobs");
  });

  test("detects both", () => {
    expect(classifyIntent("Both")).toBe("goal_both");
  });

  test("detects vague yes", () => {
    expect(classifyIntent("sure")).toBe("vague_yes");
  });

  test("prioritizes subgoal matching in booking subgoal state", () => {
    expect(
      classifyIntent("Responding to new leads faster", "awaiting_booking_subgoal"),
    ).toBe("subgoal_responding_faster");
  });
});

describe("advanceConversation booking flow", () => {
  test("booking more jobs -> responding faster -> free-form answer -> booking link", () => {
    let context = createContext();

    ({ context } = advanceConversation(context, "Booking more jobs"));
    expect(context.state).toBe("awaiting_booking_subgoal");

    ({ context } = advanceConversation(context, "Responding to new leads faster"));
    expect(context.state).toBe("awaiting_booking_response_speed");

    const result = advanceConversation(context, "Usually within an hour");
    expect(result.context.state).toBe("completed");
    expect(result.reply).toContain("calendar.app.google/test");
  });

  test("booking more jobs -> follow up -> manually -> booking link", () => {
    let context = createContext();

    ({ context } = advanceConversation(context, "Booking more jobs"));
    ({ context } = advanceConversation(context, "Following up more consistently"));
    expect(context.state).toBe("awaiting_booking_followup_process");

    const result = advanceConversation(context, "Manually");
    expect(result.context.state).toBe("completed");
    expect(result.reply).toContain(
      "A consistent follow-up process could help you recover more value",
    );
    expect(result.reply).toContain("calendar.app.google/test");
  });

  test("booking more jobs -> answering calls -> free-form answer -> booking link", () => {
    let context = createContext();

    ({ context } = advanceConversation(context, "Booking more jobs"));
    ({ context } = advanceConversation(context, "answering more calls"));
    expect(context.state).toBe("awaiting_booking_calls_window");

    const result = advanceConversation(context, "After hours");
    expect(result.context.state).toBe("completed");
    expect(result.reply).toContain("calendar.app.google/test");
  });
});

describe("advanceConversation both flow", () => {
  test("both -> booking revenue -> responding faster -> booking link", () => {
    let context = createContext();

    ({ context } = advanceConversation(context, "Both"));
    expect(context.state).toBe("awaiting_both_priority");

    ({ context } = advanceConversation(context, "Booking more revenue"));
    expect(context.state).toBe("awaiting_both_revenue_subgoal");

    ({ context } = advanceConversation(context, "responding to new leads faster"));
    expect(context.state).toBe("awaiting_both_revenue_detail");

    const result = advanceConversation(context, "Same day");
    expect(result.context.state).toBe("completed");
    expect(result.reply).toContain("calendar.app.google/test");
  });

  test("both -> freeing time -> free-form answer -> booking link", () => {
    let context = createContext();

    ({ context } = advanceConversation(context, "Both"));
    ({ context } = advanceConversation(context, "Freeing up my team's time"));
    expect(context.state).toBe("awaiting_both_time_task");

    const result = advanceConversation(context, "Lead follow-up");
    expect(result.context.state).toBe("completed");
    expect(result.reply).toContain("calendar.app.google/test");
  });
});

describe("advanceConversation staff flow", () => {
  test("growing without staff -> free-form answers -> booking link", () => {
    let context = createContext();

    ({ context } = advanceConversation(context, "Growing without adding staff"));
    expect(context.state).toBe("awaiting_staff_pressure");

    ({ context } = advanceConversation(context, "Following up with leads"));
    expect(context.state).toBe("awaiting_staff_time_estimate");

    const result = advanceConversation(context, "About 10 hours");
    expect(result.context.state).toBe("completed");
    expect(result.reply).toContain("calendar.app.google/test");
  });
});

describe("advanceConversation not sure flow", () => {
  test("not sure -> free-form answer -> booking link", () => {
    let context = createContext();

    ({ context } = advanceConversation(context, "Not sure"));
    expect(context.state).toBe("awaiting_not_sure_frustration");

    const result = advanceConversation(context, "Team is stretched too thin");
    expect(result.context.state).toBe("completed");
    expect(result.reply).toContain("calendar.app.google/test");
  });
});

describe("advanceConversation free-form states ignore schedule hijack", () => {
  test("does not treat schedule keyword as booking shortcut during follow-up question", () => {
    const context = createContext({ state: "awaiting_booking_followup_process" });

    const result = advanceConversation(context, "We schedule callbacks manually");
    expect(result.context.state).toBe("completed");
    expect(result.reply).toContain("consistent follow-up process");
  });
});
