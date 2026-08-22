import { describe, expect, test } from "bun:test";
import {
  getSpeed2LeadLlmModel,
  isSpeed2LeadLlmEnabled,
} from "~/server/speed2Lead/config";

describe("speed2Lead LLM config", () => {
  test("LLM orchestrator is disabled by default", () => {
    delete process.env.SPEED2LEAD_LLM_ENABLED;
    expect(isSpeed2LeadLlmEnabled()).toBe(false);
  });

  test("LLM orchestrator requires explicit enable flag", () => {
    process.env.SPEED2LEAD_LLM_ENABLED = "true";
    expect(isSpeed2LeadLlmEnabled()).toBe(true);
    delete process.env.SPEED2LEAD_LLM_ENABLED;
  });

  test("model is configurable via environment", () => {
    process.env.SPEED2LEAD_LLM_MODEL = "gpt-test-model";
    expect(getSpeed2LeadLlmModel()).toBe("gpt-test-model");
    delete process.env.SPEED2LEAD_LLM_MODEL;
  });
});
