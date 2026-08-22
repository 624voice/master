import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import type { ResponseOutputItem } from "openai/resources/responses/responses";
import { centralDateAt, parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import type { ModelRunner, ModelRunnerInput } from "~/server/speed2Lead/orchestrator";
import type { ConversationContext } from "~/server/speed2Lead/types";
import type { ContactConversationContext } from "~/server/contactSpeed2Lead/types";
import type { DemoConversationContext } from "~/server/demoSpeed2Lead/types";

const TZ = CONSULTATION_TIMEZONE;
let consultationSlots: string[] = [];
let availabilityMode: "ok" | "unconfigured" = "ok";
let bookingResult: {
  ok: boolean;
  eventId?: string;
  selectedStart?: string;
  reason?: string;
  replayed?: boolean;
} = { ok: true, eventId: "evt-1", selectedStart: "", replayed: false };

mock.module("~/server/appointmentLifecycle/googleCalendar", () => ({
  getConsultationSlots: async (input: { rangeStart: string | Date; rangeEnd: string | Date }) => {
    if (availabilityMode === "unconfigured") {
      return { ok: false, reason: "not_configured" };
    }
    const startMs = new Date(input.rangeStart).getTime();
    return {
      ok: true,
      slots: consultationSlots.filter((slot) => {
        const ms = new Date(slot).getTime();
        return ms >= startMs && ms <= new Date(input.rangeEnd).getTime();
      }),
    };
  },
  fetchCalendarEventsUpdatedSince: async () => [],
  cancelCalendarEvent: async () => false,
  resetGoogleTokenCacheForTests: () => {},
  calendarAttendeeInviteEnabled: (email?: string) => Boolean(email),
}));

mock.module("~/server/appointmentLifecycle/bookConsultation", () => ({
  bookConsultation: async (input: { start: string }) => {
    if (!bookingResult.ok) {
      return { ok: false, reason: bookingResult.reason ?? "slot_unavailable" };
    }
    return {
      ok: true,
      eventId: bookingResult.eventId ?? "evt-1",
      selectedStart: bookingResult.selectedStart ?? input.start,
      replayed: bookingResult.replayed ?? false,
      lifecycle: { action: "created", smsSent: true },
    };
  },
}));

const { orchestrateInboundTurn } = await import("~/server/speed2Lead/orchestrator");
const { validateOutboundSms } = await import("~/server/speed2Lead/guardrails");
const { resolveAvailabilityRange, nextWeekdayCentral } = await import("~/server/speed2Lead/schedulingRange");
const { createInitialToolState } = await import("~/server/speed2Lead/tools");

function futureTuesdayAfternoon(now: Date): { date: string; slots: string[] } {
  const date = nextWeekdayCentral("tuesday", now);
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid Tuesday date: ${date}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return {
    date,
    slots: [
      centralDateAt(year, month, day, 13, 30, TZ).toISOString(),
      centralDateAt(year, month, day, 14, 30, TZ).toISOString(),
      centralDateAt(year, month, day, 16, 0, TZ).toISOString(),
    ],
  };
}

function assistantMessage(text: string) {
  return { role: "assistant" as const, content: text, at: new Date().toISOString() };
}

function userMessage(text: string) {
  return { role: "user" as const, content: text, at: new Date().toISOString() };
}

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
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function contactSession(overrides: Partial<ContactConversationContext> = {}): ContactConversationContext {
  return {
    flow: "contact",
    phone: "+15551234567",
    firstName: "Sam",
    businessName: "Sam HVAC",
    shortNeedSummary: "We miss calls after hours and need help responding faster",
    relevantSolution: "AI lead response",
    relevantLink: "https://624voice.com",
    relevantExample: "Example",
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_prompt",
    messages: [],
    knownFacts: {
      firstName: "Sam",
      phone: "+15551234567",
      flow: "contact",
      businessName: "Sam HVAC",
      customerGoal: "We miss calls after hours and need help responding faster",
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function demoSession(overrides: Partial<DemoConversationContext> = {}): DemoConversationContext {
  return {
    flow: "demo",
    phone: "+15551234567",
    firstName: "Jamie",
    lastName: "Lee",
    email: "jamie@example.com",
    businessName: "Lee Plumbing",
    hasWebsite: true,
    smsConsent: true,
    demoCompleted: true,
    demoCompletedAt: new Date().toISOString(),
    bookingUrl: "https://calendar.app.google/test",
    state: "awaiting_fit",
    messages: [],
    knownFacts: {
      firstName: "Jamie",
      phone: "+15551234567",
      email: "jamie@example.com",
      flow: "demo",
      businessName: "Lee Plumbing",
      questionsAsked: 0,
    },
    scheduling: { status: "idle" },
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function textOutput(text: string): ResponseOutputItem[] {
  return [
    {
      type: "message",
      id: "msg-1",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text, annotations: [] }],
    },
  ];
}

function toolCall(name: string, args: Record<string, unknown>, callId = "call-1"): ResponseOutputItem[] {
  return [
    {
      type: "function_call",
      call_id: callId,
      name,
      arguments: JSON.stringify(args),
    },
  ];
}

function createScriptedModel(
  steps: Array<(input: ModelRunnerInput) => { output: ResponseOutputItem[]; outputText: string }>,
): ModelRunner {
  let index = 0;
  return async (input) => {
    const step = steps[index];
    index += 1;
    if (!step) {
      return { output: textOutput("Got it."), outputText: "Got it." };
    }
    return step(input);
  };
}

describe("speed2Lead orchestrator behavioral tests", () => {
  const now = centralDateAt(2026, 8, 19, 10, 0, TZ);

  beforeEach(() => {
    consultationSlots = [];
    availabilityMode = "ok";
    bookingResult = {
      ok: true,
      eventId: "evt-1",
      selectedStart: "",
      replayed: false,
    };
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  test("ROI customer states missed calls without re-asking pain", async () => {
    const runModel = createScriptedModel([
      () => ({
        output: toolCall("update_known_facts", {
          primaryPain: "missed calls",
          customerGoal: "missed calls after hours",
        }),
        outputText: "",
      }),
      () => ({
        output: textOutput(
          "Missed calls after hours can quietly cost you jobs. Is fixing that a priority right now?",
        ),
        outputText:
          "Missed calls after hours can quietly cost you jobs. Is fixing that a priority right now?",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      roiSession({
        messages: [userMessage("We miss a lot of calls after hours")],
        lastCustomerMessage: "We miss a lot of calls after hours",
      }),
      "We miss a lot of calls after hours",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.knownFacts.primaryPain).toBe("missed calls");
    expect(result.reply.toLowerCase()).not.toContain("which pain");
    expect(result.reply.toLowerCase()).not.toContain("biggest leak");
  });

  test("Contact form already explains need so agent does not re-ask prompt", async () => {
    const runModel = createScriptedModel([
      () => ({
        output: textOutput(
          "That after-hours gap is exactly the kind of thing we help home service teams tighten up. Want to walk through what that could look like for Sam HVAC?",
        ),
        outputText:
          "That after-hours gap is exactly the kind of thing we help home service teams tighten up. Want to walk through what that could look like for Sam HVAC?",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      contactSession({
        messages: [userMessage("Yes, after hours is the main issue")],
      }),
      "Yes, after hours is the main issue",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply.toLowerCase()).not.toContain("what prompted you");
    expect(result.reply.toLowerCase()).not.toContain("why did you reach out");
  });

  test("Demo customer ready to talk moves toward scheduling", async () => {
    const tuesday = futureTuesdayAfternoon(now);
    consultationSlots = tuesday.slots;

    const runModel = createScriptedModel([
      () => ({
        output: toolCall("get_availability", {
          centralDate: tuesday.date,
          partOfDay: "afternoon",
          maxSlots: 3,
        }),
        outputText: "",
      }),
      () => ({
        output: textOutput("Great — I can do 1:30, 2:30, or 4:00 Tuesday CT. Which works best?"),
        outputText: "Great — I can do 1:30, 2:30, or 4:00 Tuesday CT. Which works best?",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      demoSession({ messages: [userMessage("Can we talk Tuesday afternoon?")] }),
      "Can we talk Tuesday afternoon?",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.scheduling.status).toBe("slots_offered");
    expect(result.context.scheduling.offeredSlots?.length).toBeGreaterThan(0);
  });

  test("Customer answers several discovery points in one message can skip extra stages", async () => {
    const runModel = createScriptedModel([
      () => ({
        output: toolCall("update_known_facts", {
          primaryPain: "missed calls",
          urgency: "high",
          fit: "yes",
        }),
        outputText: "",
      }),
      () => ({
        output: toolCall("get_availability", {
          centralDate: "2026-08-26",
          partOfDay: "full_day",
          maxSlots: 3,
        }),
        outputText: "",
      }),
      () => ({
        output: textOutput("Sounds like a priority. I have a few openings Thursday — want me to send options?"),
        outputText: "Sounds like a priority. I have a few openings Thursday — want me to send options?",
      }),
    ]);

    consultationSlots = [
      centralDateAt(2026, 8, 26, 10, 0, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 11, 0, TZ).toISOString(),
    ];

    const result = await orchestrateInboundTurn(
      roiSession({
        messages: [
          userMessage(
            "We miss calls after hours, it's costing us jobs, and I'd like to talk soon",
          ),
        ],
      }),
      "We miss calls after hours, it's costing us jobs, and I'd like to talk soon",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.knownFacts.urgency).toBe("high");
    expect(result.context.knownFacts.questionsAsked).toBe(0);
  });

  test("Discovery question counter increments only when requested", async () => {
    const runModel = createScriptedModel([
      () => ({
        output: toolCall("update_known_facts", { discoveryQuestionAsked: true }),
        outputText: "",
      }),
      () => ({
        output: textOutput("What happens today when a lead comes in after hours?"),
        outputText: "What happens today when a lead comes in after hours?",
      }),
    ]);

    const result = await orchestrateInboundTurn(roiSession(), "interested", { runModel, now });
    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.knownFacts.questionsAsked).toBe(1);
  });

  test("Direct customer question gets answered", async () => {
    const runModel = createScriptedModel([
      () => ({
        output: textOutput(
          "Jessica is a fictional plumbing demo — your production agent would be customized to your business. Want to talk through what that could look like?",
        ),
        outputText:
          "Jessica is a fictional plumbing demo — your production agent would be customized to your business. Want to talk through what that could look like?",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      demoSession({ messages: [userMessage("Is Jessica what I would get?")] }),
      "Is Jessica what I would get?",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply.toLowerCase()).toContain("custom");
  });

  test("Price question does not produce exact pricing", async () => {
    const runModel = createScriptedModel([
      () => ({
        output: textOutput(
          "Pricing depends on what you want handled — happy to walk through scope on a quick consultation if useful.",
        ),
        outputText:
          "Pricing depends on what you want handled — happy to walk through scope on a quick consultation if useful.",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      roiSession({ messages: [userMessage("How much does it cost?")] }),
      "How much does it cost?",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply).not.toMatch(/\$\d/);
  });

  test("Guardrail blocks invented ROI dollar figure", () => {
    const validation = validateOutboundSms(
      "You could add $500,000 this year easy.",
      {
        session: roiSession(),
        toolState: createInitialToolState(),
      },
    );
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.reason).toContain("pricing");
  });

  test("Tuesday afternoon availability tool uses normalized range", async () => {
    const tuesday = futureTuesdayAfternoon(now);
    consultationSlots = tuesday.slots;
    const toolCalls: string[] = [];

    const runModel = createScriptedModel([
      (input) => {
        toolCalls.push(JSON.stringify(input.input));
        return {
          output: toolCall("get_availability", {
            centralDate: tuesday.date,
            partOfDay: "afternoon",
            maxSlots: 3,
          }),
          outputText: "",
        };
      },
      () => ({
        output: textOutput("I can do 1:30, 2:30, or 4:00 Tuesday. Which works best?"),
        outputText: "I can do 1:30, 2:30, or 4:00 Tuesday. Which works best?",
      }),
    ]);

    const resolved = resolveAvailabilityRange(
      { centralDate: tuesday.date, partOfDay: "afternoon" },
      now,
    );
    expect("error" in resolved).toBe(false);

    const result = await orchestrateInboundTurn(
      roiSession({ messages: [userMessage("Tuesday afternoon works best")] }),
      "Tuesday afternoon works best",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.scheduling.offeredSlots?.length).toBeGreaterThan(0);
    expect(result.context.scheduling.partOfDay).toBe("afternoon");
  });

  test("Only returned calendar slots can be offered", () => {
    const offered = [
      centralDateAt(2026, 8, 26, 13, 30, TZ).toISOString(),
      centralDateAt(2026, 8, 26, 14, 30, TZ).toISOString(),
    ];
    const validation = validateOutboundSms("I can do 1:30, 2:30, or 5:15 Tuesday.", {
      session: roiSession(),
      toolState: { ...createInitialToolState(), offeredSlots: offered },
    });
    expect(validation.ok).toBe(false);
  });

  test("Customer selecting offered slot triggers booking tool", async () => {
    const slot = centralDateAt(2026, 8, 26, 13, 30, TZ).toISOString();
    consultationSlots = [slot];
    bookingResult = { ok: true, eventId: "evt-book-1", selectedStart: slot, replayed: false };
    const tools: string[] = [];

    const runModel = createScriptedModel([
      () => ({
        output: toolCall("book_appointment", { start: slot }),
        outputText: "",
      }),
      () => ({
        output: textOutput("Perfect — you're booked for 1:30 PM CT."),
        outputText: "Perfect — you're booked for 1:30 PM CT.",
      }),
    ]);

    const scripted = createScriptedModel([
      (input) => {
        if (input.tools.length > 0 && input.input.some((item) => "name" in item && item.name)) {
          // noop
        }
        return {
          output: toolCall("book_appointment", { start: slot }, "book-1"),
          outputText: "",
        };
      },
      () => ({
        output: textOutput("Perfect — you're booked for 1:30 PM CT."),
        outputText: "Perfect — you're booked for 1:30 PM CT.",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      roiSession({
        scheduling: { status: "slots_offered", offeredSlots: [slot] },
        messages: [assistantMessage("I can do 1:30 Tuesday."), userMessage("1:30 works")],
      }),
      "1:30 works",
      {
        runModel: async (input) => {
          const response = await scripted(input);
          for (const item of response.output) {
            if (item.type === "function_call") tools.push(item.name);
          }
          return response;
        },
        now,
      },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.scheduling.status).toBe("confirmed");
  });

  test("Successful booking can be confirmed to customer", async () => {
    const slot = centralDateAt(2026, 8, 26, 14, 30, TZ).toISOString();
    bookingResult = { ok: true, eventId: "evt-2", selectedStart: slot, replayed: false };

    const runModel = createScriptedModel([
      () => ({ output: toolCall("book_appointment", { start: slot }), outputText: "" }),
      () => ({
        output: textOutput("You're all set for 2:30 PM CT."),
        outputText: "You're all set for 2:30 PM CT.",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      roiSession({ scheduling: { status: "slots_offered", offeredSlots: [slot] } }),
      "2:30 works",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply.trim()).toBe("");
    expect(result.context.scheduling.calendarEventId).toBe("evt-2");
  });

  test("Failed booking cannot be described as successful", async () => {
    const slot = centralDateAt(2026, 8, 26, 14, 30, TZ).toISOString();
    bookingResult = { ok: false, reason: "slot_unavailable" };

    const runModel = createScriptedModel([
      () => ({ output: toolCall("book_appointment", { start: slot }), outputText: "" }),
      () => ({
        output: textOutput("You're booked for 2:30 PM CT."),
        outputText: "You're booked for 2:30 PM CT.",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      roiSession({ scheduling: { status: "slots_offered", offeredSlots: [slot] } }),
      "2:30 works",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply.toLowerCase()).not.toMatch(/\b(booked|you're all set|confirmed)\b/);
  });

  test("Slot conflict returns alternatives instead of false confirmation", async () => {
    const slot = centralDateAt(2026, 8, 26, 14, 30, TZ).toISOString();
    const alt = centralDateAt(2026, 8, 26, 15, 0, TZ).toISOString();
    bookingResult = { ok: false, reason: "slot_unavailable" };
    consultationSlots = [alt];

    const runModel = createScriptedModel([
      () => ({ output: toolCall("book_appointment", { start: slot }), outputText: "" }),
      () => ({
        output: toolCall("get_availability", {
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
          maxSlots: 3,
        }),
        outputText: "",
      }),
      () => ({
        output: textOutput("That one just got taken — I can do 3:00 PM CT instead if that works."),
        outputText: "That one just got taken — I can do 3:00 PM CT instead if that works.",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      roiSession({ scheduling: { status: "slots_offered", offeredSlots: [slot] } }),
      "2:30 works",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply.toLowerCase()).toContain("taken");
  });

  test("Calendar failure asks conversationally on first attempt", async () => {
    availabilityMode = "unconfigured";

    const runModel = createScriptedModel([
      () => ({
        output: toolCall("get_availability", {
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
        }),
        outputText: "",
      }),
      () => ({
        output: textOutput("Here is my calendar link for you."),
        outputText: "Here is my calendar link for you.",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      roiSession(),
      "Tuesday afternoon works",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply).not.toContain("calendar.app.google/test");
    expect(result.reply.toLowerCase()).toMatch(
      /what day|morning or afternoon|try another time|hit a snag|mind sending/,
    );
  });

  test("Repeated calendar failure can produce authorized calendar-link fallback", async () => {
    availabilityMode = "unconfigured";

    const runModel = createScriptedModel([
      () => ({
        output: toolCall("get_availability", {
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
        }),
        outputText: "",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      roiSession({
        scheduling: {
          status: "idle",
          centralDate: "2026-08-26",
          partOfDay: "afternoon",
          availabilityAttempts: 1,
          calendarUnavailable: true,
        },
      }),
      "Tuesday afternoon works",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply).toContain("calendar.app.google/test");
  });

  test("Known name and business are not requested again in prompt context", async () => {
    const runModel = createScriptedModel([
      (input) => {
        expect(input.instructions).toContain("Alex");
        expect(input.instructions).toContain("Test Plumbing");
        expect(input.instructions).not.toContain("ask for business name");
        return {
          output: textOutput("Got it — happy to help with missed calls for Test Plumbing."),
          outputText: "Got it — happy to help with missed calls for Test Plumbing.",
        };
      },
    ]);

    const result = await orchestrateInboundTurn(roiSession(), "interested", { runModel, now });
    expect(result.handled).toBe(true);
  });

  test("LLM failure returns safe handled recovery instead of dead turn", async () => {
    const runModel: ModelRunner = async () => {
      throw new Error("OpenAI unavailable");
    };

    const result = await orchestrateInboundTurn(roiSession(), "interested", { runModel, now });
    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply.trim().length).toBeGreaterThan(0);
    expect(result.context.scheduling).toBeDefined();
  });

  test("Unknown off-topic reply still returns handled response", async () => {
    const runModel = createScriptedModel([
      () => ({
        output: textOutput("Ha — fair enough. Want to keep going on the missed-call side?"),
        outputText: "Ha — fair enough. Want to keep going on the missed-call side?",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      roiSession({ messages: [userMessage("Who won the game last night?")] }),
      "Who won the game last night?",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
  });

  test("Yeah let's talk cannot end with generic scheduling prose", async () => {
    const runModel = createScriptedModel([
      () => ({
        output: textOutput("Great, let's find a time that works for you soon."),
        outputText: "Great, let's find a time that works for you soon.",
      }),
    ]);

    const result = await orchestrateInboundTurn(roiSession(), "Yeah let's talk", { runModel, now });
    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply.toLowerCase()).toMatch(/what day|morning|afternoon/);
  });

  test("Calendar link is not sent when the model skips availability tools", async () => {
    const runModel = createScriptedModel([
      () => ({
        output: textOutput(
          "Easiest may be my calendar link: https://calendar.app.google/test",
        ),
        outputText:
          "Easiest may be my calendar link: https://calendar.app.google/test",
      }),
    ]);

    const result = await orchestrateInboundTurn(roiSession(), "Yeah let's talk", { runModel, now });
    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply).not.toContain("calendar.app.google");
  });

  test("Scheduling gate forces availability when the model only discusses times", async () => {
    const tuesday = futureTuesdayAfternoon(now);
    consultationSlots = tuesday.slots;

    const runModel = createScriptedModel([
      () => ({
        output: textOutput("Tuesday afternoon should work — I'll look for a time."),
        outputText: "Tuesday afternoon should work — I'll look for a time.",
      }),
    ]);

    const result = await orchestrateInboundTurn(roiSession(), "Tuesday afternoon", { runModel, now });
    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.scheduling.status).toBe("slots_offered");
  });

  test("Gate forces booking when customer selects an offered slot without model tool call", async () => {
    const slot = centralDateAt(2026, 8, 26, 13, 30, TZ).toISOString();
    bookingResult = { ok: true, eventId: "evt-gate", selectedStart: slot, replayed: false };

    const runModel = createScriptedModel([
      () => ({
        output: textOutput("Perfect, I'll get that booked for you."),
        outputText: "Perfect, I'll get that booked for you.",
      }),
    ]);

    const result = await orchestrateInboundTurn(
      roiSession({ scheduling: { status: "slots_offered", offeredSlots: [slot] } }),
      "1:30 works",
      { runModel, now },
    );

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.context.scheduling.status).toBe("confirmed");
  });
});

describe("schedulingRange", () => {
  test("resolves Tuesday afternoon into Central business range", () => {
    const now = centralDateAt(2026, 8, 19, 10, 0, TZ);
    const resolved = resolveAvailabilityRange(
      { centralDate: "2026-08-25", partOfDay: "afternoon" },
      now,
    );
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.rangeStart.getTime()).toBeLessThan(resolved.rangeEnd.getTime());
  });
});
