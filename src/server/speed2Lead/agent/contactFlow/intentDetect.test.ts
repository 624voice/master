import { describe, expect, test } from "bun:test";
import { isOffTopicRedirect } from "~/server/speed2Lead/agent/contactFlow/intentDetect";

describe("isOffTopicRedirect", () => {
  test("does not misfire on legitimate discovery answers mentioning calling customers back", () => {
    expect(
      isOffTopicRedirect(
        "Not sure, we miss a few calls a week and when we call them back they've moved on",
      ),
    ).toBe(false);
    expect(isOffTopicRedirect("We usually call them back the next day")).toBe(false);
  });

  test("still redirects truly off-topic or third-party contact requests", () => {
    expect(isOffTopicRedirect("What's the weather today?")).toBe(true);
    expect(isOffTopicRedirect("Can you call him for me?")).toBe(true);
    expect(isOffTopicRedirect("Please text my wife about this")).toBe(true);
  });
});
