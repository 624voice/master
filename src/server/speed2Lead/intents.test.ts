import { describe, expect, test } from "bun:test";
import { classifyIntent } from "./intents";

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
});
