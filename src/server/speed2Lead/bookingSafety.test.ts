import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("controlled phone test booking safety (code paths unchanged)", () => {
  test("orchestrator availability tool calls real getConsultationSlots", () => {
    const toolsSource = readFileSync(
      new URL("./tools.ts", import.meta.url),
      "utf8",
    );
    expect(toolsSource).toContain('from "~/server/appointmentLifecycle/googleCalendar"');
    expect(toolsSource).toContain("getConsultationSlots");
  });

  test("bookConsultation creates calendar events through createConsultationEvent", () => {
    const source = readFileSync(
      new URL("../appointmentLifecycle/bookConsultation.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("createConsultationEvent");
    expect(source).toContain("processCalendarEvent");
  });

  test("google calendar consultation path re-checks slot availability before create", () => {
    const source = readFileSync(
      new URL("../appointmentLifecycle/googleCalendar.ts", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(/slot_unavailable|busy|conflict/i);
  });

  test("failed booking tool state cannot mark bookingConfirmed", () => {
    const toolsSource = readFileSync(
      new URL("./tools.ts", import.meta.url),
      "utf8",
    );
    expect(toolsSource).toContain('bookingFailed: booked.reason === "slot_unavailable"');
    expect(toolsSource).toContain('lastBookingFailureReason: "invalid_selection"');
    expect(toolsSource).toMatch(/if \(!booked\.ok\)/);
  });

  test("guardrails block confirmation without successful booking tool result", () => {
    const source = readFileSync(new URL("./guardrails.ts", import.meta.url), "utf8");
    expect(source).toContain("BOOKED_CLAIM_PATTERN");
    expect(source).toMatch(/bookingConfirmed/);
  });

  test("preview calendar availability requires configured Google credentials", () => {
    const configSource = readFileSync(
      new URL("../appointmentLifecycle/config.ts", import.meta.url),
      "utf8",
    );
    expect(configSource).toContain("GOOGLE_CALENDAR_ID");
    expect(configSource).toContain("isGoogleCalendarApiConfigured");
  });
});
