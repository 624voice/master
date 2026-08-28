import { describe, expect, test } from "bun:test";
import {
  avoidDuplicateAssistantReply,
  buildConsequenceQuestionVariant,
  countConsequenceQuestionsAsked,
  shouldProceedAfterRepeatedCostAsk,
} from "~/server/speed2Lead/agent/contactFlow/discoveryReply";
import { createAgentSession, appendMessage } from "~/server/speed2Lead/agent/state";

describe("discoveryReply", () => {
  test("varies duplicate consequence questions", () => {
    let session = createAgentSession({
      tenantId: "624voice",
      phone: "+12149722278",
      flow: "contact",
    });
    const first = buildConsequenceQuestionVariant(0);
    session = appendMessage(session, "assistant", first);
    const second = avoidDuplicateAssistantReply(session, first);
    expect(second).not.toBe(first);
  });

  test("caps consequence re-ask after one already sent", () => {
    let session = createAgentSession({
      tenantId: "624voice",
      phone: "+12149722278",
      flow: "contact",
    });
    session = appendMessage(session, "assistant", buildConsequenceQuestionVariant(0));
    expect(countConsequenceQuestionsAsked(session)).toBe(1);
    expect(
      shouldProceedAfterRepeatedCostAsk(session, buildConsequenceQuestionVariant(0)),
    ).toBe(true);
  });
});
