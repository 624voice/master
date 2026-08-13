import { describe, expect, test } from "bun:test";
import { classifyGlobalIntent } from "./globalIntents";

describe("classifyGlobalIntent", () => {
  test("detects stop", () => {
    expect(classifyGlobalIntent("STOP")).toBe("stop");
  });

  test("detects schedule ready", () => {
    expect(classifyGlobalIntent("Can we talk?")).toBe("schedule_ready");
  });

  test("detects price", () => {
    expect(classifyGlobalIntent("How much does it cost?")).toBe("price");
  });
});
