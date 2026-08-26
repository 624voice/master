import { describe, expect, test } from "bun:test";
import { DEFAULT_624VOICE_PROFILE } from "~/server/speed2Lead/agent/profile";
import { createAgentSession, appendMessage } from "~/server/speed2Lead/agent/state";
import {
  buildPainClarifyingReply,
  containsPainHint,
  isAmbiguousDiscoveryReply,
  isMeetingDecline,
  sessionAwaitingPainAnswer,
} from "~/server/speed2Lead/agent/turnGuards";
import { buildPainPromptMessage } from "~/server/speed2Lead/agent/painPrompt";

describe("turnGuards", () => {
  test("detects ambiguous pain replies", () => {
    expect(isAmbiguousDiscoveryReply("not sure")).toBe(true);
    expect(isAmbiguousDiscoveryReply("Maybe")).toBe(true);
    expect(isAmbiguousDiscoveryReply("missed calls mostly")).toBe(false);
  });

  test("pain hint overrides ambiguity", () => {
    expect(containsPainHint("not sure, mostly missed calls", DEFAULT_624VOICE_PROFILE)).toBe(true);
    expect(isAmbiguousDiscoveryReply("not sure") && !containsPainHint("not sure", DEFAULT_624VOICE_PROFILE)).toBe(
      true,
    );
  });

  test("sessionAwaitingPainAnswer when pain prompt sent and no pain yet", () => {
    let session = createAgentSession({ tenantId: "624voice", phone: "+12149722278" });
    session = appendMessage(session, "assistant", buildPainPromptMessage(DEFAULT_624VOICE_PROFILE));
    expect(sessionAwaitingPainAnswer(session)).toBe(true);
    session = { ...session, primaryPain: "missed_calls" };
    expect(sessionAwaitingPainAnswer(session)).toBe(false);
  });

  test("buildPainClarifyingReply references report pains", () => {
    const reply = buildPainClarifyingReply(DEFAULT_624VOICE_PROFILE);
    expect(reply.toLowerCase()).toContain("missed calls");
    expect(reply.includes("?")).toBe(true);
  });

  test("isMeetingDecline catches polite meeting no", () => {
    expect(isMeetingDecline("probably not worth a meeting")).toBe(true);
    expect(isMeetingDecline("STOP")).toBe(false);
    expect(isMeetingDecline("not sure")).toBe(false);
  });
});
