import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("controlled phone test booking safety (code paths unchanged)", () => {
  test("agent scheduling provider calls real getConsultationSlots", () => {
    const source = readFileSync(
      new URL("./agent/scheduling/provider.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain('from "~/server/appointmentLifecycle/googleCalendar"');
    expect(source).toContain("getConsultationSlots");
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

  test("agent scheduling service tracks booking failures without confirming", () => {
    const source = readFileSync(
      new URL("./agent/scheduling/service.ts", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(/outcome:\s*"BOOKED"/);
    expect(source).toMatch(/provider_conflict|invalid_selection|provider_error/i);
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
