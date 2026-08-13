import { describe, expect, test } from "bun:test";
import {
  classifyLifecycleIntent,
  isAmbiguousCancellation,
} from "~/server/appointmentLifecycle/intents";

describe("lifecycle intents", () => {
  test("reschedule phrases", () => {
    expect(classifyLifecycleIntent("need to reschedule")).toBe("reschedule");
    expect(classifyLifecycleIntent("can we move it?")).toBe("reschedule");
    expect(classifyLifecycleIntent("can't make that time")).toBe("reschedule");
  });

  test("cancel phrases", () => {
    expect(classifyLifecycleIntent("cancel my meeting")).toBe("cancel");
    expect(classifyLifecycleIntent("please cancel")).toBe("cancel");
    expect(classifyLifecycleIntent("cancel")).toBe("cancel");
  });

  test("ambiguous cancellation is flagged", () => {
    expect(isAmbiguousCancellation("can't make it")).toBe(true);
    expect(isAmbiguousCancellation("cancel my meeting")).toBe(false);
  });

  test("STOP is not a lifecycle cancel", () => {
    expect(classifyLifecycleIntent("STOP")).toBe("none");
  });
});
