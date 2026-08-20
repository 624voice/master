import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const handleInboundSource = readFileSync(
  new URL("./handleInbound.ts", import.meta.url),
  "utf8",
);

describe("handleInbound deterministic routing order", () => {
  test("STOP is handled before the LLM orchestrator branch", () => {
    const stopIndex = handleInboundSource.indexOf('intent === "stop"');
    const llmIndex = handleInboundSource.indexOf("shouldUseSpeed2LeadLlmForPhone(phone)");
    expect(stopIndex).toBeGreaterThan(-1);
    expect(llmIndex).toBeGreaterThan(stopIndex);
  });

  test("appointment lifecycle intercept runs before the LLM orchestrator branch", () => {
    const lifecycleIndex = handleInboundSource.indexOf("handleAppointmentLifecycleInbound");
    const llmIndex = handleInboundSource.indexOf("shouldUseSpeed2LeadLlmForPhone(phone)");
    expect(lifecycleIndex).toBeGreaterThan(-1);
    expect(llmIndex).toBeGreaterThan(lifecycleIndex);
  });
});
