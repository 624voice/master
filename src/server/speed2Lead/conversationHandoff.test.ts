import { describe, expect, test } from "bun:test";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { centralDateAt } from "~/server/appointmentLifecycle/consultationSlots";
import { initialMessage } from "~/server/speed2Lead/messages";
import {
  countProspectNameMentions,
  detectExplicitSchedulingRequest,
  detectMeetingBridgeAgreement,
  shouldRequireMeetingBridge,
} from "~/server/speed2Lead/conversationHandoff";
import {
  buildSchedulingPreferenceAsk,
  planSchedulingGate,
} from "~/server/speed2Lead/schedulingController";
import {
  buildAvailabilityInputFromSchedulingState,
  hasKnownSchedulingPartOfDay,
} from "~/server/speed2Lead/schedulingContext";
import {
  detectSemanticDaypartSelection,
  isConfiguredBusinessDay,
  nextOpenBusinessDayAfter,
  nextWeekdayCentral,
  tomorrowCentralDate,
  weekdayLabelFromCentralDate,
} from "~/server/speed2Lead/schedulingRange";
import type { ConversationContext } from "~/server/speed2Lead/types";

const now = centralDateAt(2026, 8, 21, 10, 0, CONSULTATION_TIMEZONE);

function roiSession(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    flow: "roi",
    phone: "+15551234567",
    firstName: "Alex",
    businessName: "Test Plumbing",
    annualOpportunity: "$120,000",
    primaryOpportunity: "Missed calls",
    reportUrl: "https://624voice.com/report/test",
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_problem",
    messages: [],
    knownFacts: {
      firstName: "Alex",
      phone: "+15551234567",
      flow: "roi",
      businessName: "Test Plumbing",
      customerGoal: "Missed calls",
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    orchestratorManagedQuestions: true,
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe("conversation handoff helpers", () => {
  test("report-based opening is low-pressure and single-question", () => {
    const opening = initialMessage(roiSession());
    expect(opening).toMatch(/which part stood out most/i);
    expect(opening).not.toMatch(/what usually happens first/i);
    expect((opening.match(/\?/g) ?? []).length).toBe(1);
  });

  test("requires meeting bridge after pain + follow-up", () => {
    const session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        primaryPain: "missed calls",
        questionsAsked: 1,
      },
    });
    expect(shouldRequireMeetingBridge(session, "They go to voicemail when we're busy")).toBe(true);
  });

  test("explicit meeting request skips bridge requirement", () => {
    const session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        primaryPain: "missed calls",
        questionsAsked: 1,
      },
    });
    expect(detectExplicitSchedulingRequest("How does next Friday look")).toBe(true);
    expect(shouldRequireMeetingBridge(session, "How does next Friday look")).toBe(false);
  });

  test("bridge agreement is detected without exact phrasing", () => {
    expect(detectMeetingBridgeAgreement("Yeah that makes sense")).toBe(true);
    expect(detectMeetingBridgeAgreement("Sure worth a look")).toBe(true);
  });

  test("uncertainty phrases are not treated as bridge agreement", () => {
    expect(detectMeetingBridgeAgreement("Not sure")).toBe(false);
    expect(detectMeetingBridgeAgreement("more than they should but not sure for sure")).toBe(false);
    expect(detectMeetingBridgeAgreement("Probably not sure honestly")).toBe(false);
  });

  test("semantic afternoon selection is understood", () => {
    expect(detectSemanticDaypartSelection("Let's do afternoon please")).toBe("afternoon");
    expect(detectSemanticDaypartSelection("Afternoon would be best")).toBe("afternoon");
    expect(detectSemanticDaypartSelection("How about morning")).toBe("morning");
    expect(detectSemanticDaypartSelection("Later in the day")).toBe("afternoon");
  });

  test("date known + afternoon message resolves part of day for availability", () => {
    const friday = nextWeekdayCentral("friday", now);
    const input = buildAvailabilityInputFromSchedulingState(
      { status: "idle", centralDate: friday },
      "Let's do afternoon please",
      now,
    );
    expect(input?.partOfDay).toBe("afternoon");
    expect(hasKnownSchedulingPartOfDay({ status: "idle", partOfDay: input?.partOfDay })).toBe(true);
  });

  test("planSchedulingGate fetches availability when daypart is clear", () => {
    const friday = nextWeekdayCentral("friday", now);
    const session = roiSession({
      knownFacts: {
        ...roiSession().knownFacts!,
        primaryPain: "missed calls",
        questionsAsked: 1,
        meetingBridgeComplete: true,
      },
      scheduling: { status: "idle", centralDate: friday },
    });
    const plan = planSchedulingGate({
      inboundMessage: "Let's do afternoon please",
      context: session,
      now,
    });
    expect(plan.action.type).toBe("get_availability");
    if (plan.action.type === "get_availability") {
      expect(plan.action.input.partOfDay).toBe("afternoon");
    }
  });

  test("scheduling preference copy omits prospect name", () => {
    const ask = buildSchedulingPreferenceAsk("Alex", { status: "idle" });
    expect(countProspectNameMentions(ask, "Alex")).toBe(0);
    expect(ask).not.toMatch(/happy to (?:set up|find)/i);
  });

  test("closed day is distinguished from open weekdays", () => {
    const saturday = tomorrowCentralDate(centralDateAt(2026, 8, 21, 10, 0, CONSULTATION_TIMEZONE));
    expect(isConfiguredBusinessDay(saturday)).toBe(false);
    const monday = nextOpenBusinessDayAfter(saturday);
    expect(isConfiguredBusinessDay(monday)).toBe(true);
    expect(weekdayLabelFromCentralDate(saturday)).toBe("Saturday");
  });

  test("weekday full availability uses availability-full copy path", () => {
    const ask = buildSchedulingPreferenceAsk("Alex", {
      status: "idle",
      centralDate: nextWeekdayCentral("tuesday", now),
      partOfDay: "afternoon",
    });
    expect(ask.toLowerCase()).not.toMatch(/weekday/);
    expect(ask.toLowerCase()).not.toMatch(/saturday/);
  });
});
