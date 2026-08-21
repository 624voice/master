import OpenAI from "openai";
import type {
  FunctionTool,
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputItem,
} from "openai/resources/responses/responses";
import {
  getSpeed2LeadLlmMaxToolIterations,
  getSpeed2LeadLlmModel,
  isOpenAiConfigured,
} from "~/server/speed2Lead/config";
import {
  buildOrchestratorInstructions,
  buildRepairInstructions,
} from "~/server/speed2Lead/prompts";
import {
  buildBookingConfirmationMessage,
  buildSlotOfferMessage,
  calendarLinkFallbackMessage,
  genericRecoveryMessage,
  validateOutboundSms,
  type GuardrailContext,
} from "~/server/speed2Lead/guardrails";
import { normalizeSessionMemory } from "~/server/speed2Lead/memory";
import {
  buildDeterministicRecoveryReply,
  enforceSchedulingGate,
  hydrateToolStateFromContext,
  isActiveV2Scheduling,
  persistSchedulingToolState,
  planSchedulingGate,
  resolveAuthoritativeSchedulingReply,
  selectOutboundSchedulingReply,
  stripUnauthorizedCalendarLink,
} from "~/server/speed2Lead/schedulingController";
import {
  logSpeed2LeadTestEvent,
  summarizeGateAction,
  summarizeSchedulingState,
} from "~/server/speed2Lead/testObservability";
import {
  createInitialToolState,
  executeOrchestratorTool,
  ORCHESTRATOR_TOOLS,
  shouldSuggestCalendarLink,
  type ToolExecutionState,
} from "~/server/speed2Lead/tools";
import type { AnyConversationContext } from "~/server/speed2Lead/types";

export type OrchestratorTurnResult =
  | {
      handled: true;
      reply: string;
      context: AnyConversationContext;
    }
  | {
      handled: false;
      fallbackToRules: true;
      reason: string;
      context: AnyConversationContext;
      recoveryReply?: string;
    };

export type ModelRunnerInput = {
  instructions: string;
  input: ResponseInputItem[];
  tools: FunctionTool[];
  model: string;
  repairInstructions?: string;
};

export type ModelRunnerResult = {
  output: ResponseOutputItem[];
  outputText: string;
};

export type ModelRunner = (input: ModelRunnerInput) => Promise<ModelRunnerResult>;

export type OrchestratorDeps = {
  now?: Date;
  runModel?: ModelRunner;
};

type OrchestratorLogEvent =
  | "turn_start"
  | "tool_call"
  | "tool_result"
  | "guardrail_failed"
  | "repair_attempt"
  | "openai_error"
  | "fallback_rules"
  | "turn_complete";

function logOrchestratorEvent(
  event: OrchestratorLogEvent,
  details: Record<string, string | number | boolean | undefined>,
): void {
  console.log(
    JSON.stringify({
      component: "speed2LeadOrchestrator",
      event,
      at: new Date().toISOString(),
      ...details,
    }),
  );
}

function extractOutputText(output: ResponseOutputItem[]): string {
  const chunks: string[] = [];
  for (const item of output) {
    if (item.type === "message" && "content" in item) {
      for (const part of item.content ?? []) {
        if (part.type === "output_text" && part.text) {
          chunks.push(part.text);
        }
      }
    }
  }
  return chunks.join("\n").trim();
}

function isFunctionCall(item: ResponseOutputItem): item is ResponseFunctionToolCall {
  return item.type === "function_call";
}

function buildConversationInput(context: AnyConversationContext): ResponseInputItem[] {
  const messages = context.messages ?? [];
  return messages.slice(-12).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function createDefaultModelRunner(client: OpenAI): ModelRunner {
  return async (input) => {
    const response = await client.responses.create({
      model: input.model,
      instructions: input.repairInstructions
        ? `${input.instructions}\n\n${input.repairInstructions}`
        : input.instructions,
      input: input.input,
      tools: input.tools,
    });

    return {
      output: response.output,
      outputText: response.output_text?.trim() || extractOutputText(response.output),
    };
  };
}

function resolveFinalReply(
  draft: string,
  context: AnyConversationContext,
  toolState: ToolExecutionState,
  calendarLinkAllowed = false,
): string {
  const sanitized = stripUnauthorizedCalendarLink(draft, calendarLinkAllowed);
  if (calendarLinkAllowed && shouldSuggestCalendarLink(toolState)) {
    return calendarLinkFallbackMessage(context);
  }

  if (toolState.bookingConfirmed && toolState.bookingStart) {
    return sanitized.trim() || `Perfect — you're booked. I'll send the details shortly.`;
  }

  if (toolState.bookingFailed) {
    return sanitized.trim() || genericRecoveryMessage(context);
  }

  if (sanitized.trim()) {
    return sanitized.trim();
  }

  return genericRecoveryMessage(context);
}

async function validateOrRepair(
  draft: string,
  context: AnyConversationContext,
  toolState: ToolExecutionState,
  conversationInput: ResponseInputItem[],
  deps: OrchestratorDeps,
  model: string,
  runModel: ModelRunner,
  calendarLinkAllowed = false,
): Promise<string | null> {
  const guardrailContext: GuardrailContext = { session: context, toolState };
  const firstPass = validateOutboundSms(draft, guardrailContext);
  if (firstPass.ok) {
    return firstPass.text;
  }

  logOrchestratorEvent("guardrail_failed", {
    flow: context.flow ?? "roi",
    reason: firstPass.reason,
  });
  logSpeed2LeadTestEvent(context.phone, "guardrail_result", {
    ok: false,
    reason: firstPass.reason,
  });

  if (toolState.bookingConfirmed && toolState.bookingStart) {
    const confirmation = buildBookingConfirmationMessage(
      toolState.bookingStart,
      context.firstName,
    );
    const confirmedPass = validateOutboundSms(confirmation, guardrailContext);
    if (confirmedPass.ok) {
      return confirmedPass.text;
    }
  }

  if (
    firstPass.reason.includes("calendar time") &&
    toolState.offeredSlots.length > 0
  ) {
    const offer = buildSlotOfferMessage(toolState.offeredSlots);
    const retry = `That exact time isn't open — ${offer.charAt(0).toLowerCase()}${offer.slice(1)}`;
    const retryPass = validateOutboundSms(retry, guardrailContext);
    if (retryPass.ok) {
      return retryPass.text;
    }
    const offerPass = validateOutboundSms(offer, guardrailContext);
    if (offerPass.ok) {
      return offerPass.text;
    }
  }

  if (calendarLinkAllowed && shouldSuggestCalendarLink(toolState)) {
    return calendarLinkFallbackMessage(context);
  }

  if (toolState.bookingFailed) {
    if (toolState.offeredSlots.length > 0) {
      const retryOffer = buildSlotOfferMessage(toolState.offeredSlots);
      const prefixed = `That time just got taken — ${retryOffer.charAt(0).toLowerCase()}${retryOffer.slice(1)}`;
      const retryPass = validateOutboundSms(prefixed, guardrailContext);
      if (retryPass.ok) {
        return retryPass.text;
      }
    }
    return null;
  }

  if (!deps.runModel) {
    return null;
  }

  logOrchestratorEvent("repair_attempt", {
    flow: context.flow ?? "roi",
    reason: firstPass.reason,
  });

  try {
    const repaired = await runModel({
      instructions: buildOrchestratorInstructions(context, deps.now),
      input: conversationInput,
      tools: [],
      model,
      repairInstructions: buildRepairInstructions(firstPass.reason),
    });

    const repairedDraft = resolveFinalReply(
      repaired.outputText,
      context,
      toolState,
      calendarLinkAllowed,
    );
    const secondPass = validateOutboundSms(repairedDraft, guardrailContext);
    if (secondPass.ok) {
      return secondPass.text;
    }
  } catch (error) {
    logOrchestratorEvent("openai_error", {
      flow: context.flow ?? "roi",
      stage: "repair",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (calendarLinkAllowed && shouldSuggestCalendarLink(toolState)) {
    return calendarLinkFallbackMessage(context);
  }

  return null;
}

function logTestTurnComplete(
  phone: string,
  flow: string,
  startedAt: number,
  workingContext: AnyConversationContext,
  extras: Record<string, string | number | boolean | undefined> = {},
): void {
  logSpeed2LeadTestEvent(phone, "scheduling_state_after", {
    flow,
    ...summarizeSchedulingState(workingContext),
  });
  logSpeed2LeadTestEvent(phone, "turn_complete", {
    flow,
    durationMs: Date.now() - startedAt,
    ...summarizeSchedulingState(workingContext),
    ...extras,
  });
}

export async function orchestrateInboundTurn(
  session: AnyConversationContext,
  inboundMessage: string,
  deps: OrchestratorDeps = {},
): Promise<OrchestratorTurnResult> {
  const now = deps.now ?? new Date();
  const turnStartedAt = Date.now();
  const context = normalizeSessionMemory(session);
  const model = getSpeed2LeadLlmModel();
  const maxIterations = getSpeed2LeadLlmMaxToolIterations();

  logSpeed2LeadTestEvent(context.phone, "scheduling_state_before", {
    flow: context.flow ?? "roi",
    ...summarizeSchedulingState(context),
  });

  logOrchestratorEvent("turn_start", {
    flow: context.flow ?? "roi",
    phoneSuffix: context.phone.slice(-4),
    messageLength: inboundMessage.length,
  });

  if (!deps.runModel && !isOpenAiConfigured()) {
    logOrchestratorEvent("fallback_rules", {
      flow: context.flow ?? "roi",
      reason: "openai_not_configured",
    });
    return { handled: false, fallbackToRules: true, reason: "openai_not_configured", context };
  }

  const client = deps.runModel ? null : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const runModel = deps.runModel ?? createDefaultModelRunner(client!);

  let workingContext = context;
  const gatePlan = planSchedulingGate({ inboundMessage, context: workingContext, now });
  logSpeed2LeadTestEvent(context.phone, "scheduling_gate_action", {
    flow: context.flow ?? "roi",
    gateAction: summarizeGateAction(gatePlan),
    schedulingIntent: gatePlan.schedulingIntent,
  });
  let toolState = hydrateToolStateFromContext(workingContext, createInitialToolState());
  let llmCalledGetAvailability = false;
  let llmCalledBookAppointment = false;
  const instructions = buildOrchestratorInstructions(workingContext, now);
  const conversationInput: ResponseInputItem[] = buildConversationInput(workingContext);
  let latestDraft = "";

  try {
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const modelResult = await runModel({
        instructions,
        input: conversationInput,
        tools: ORCHESTRATOR_TOOLS,
        model,
      });

      latestDraft = modelResult.outputText;
      const toolCalls = modelResult.output.filter(isFunctionCall);

      if (toolCalls.length === 0) {
        break;
      }

      for (const item of modelResult.output) {
        conversationInput.push(item as ResponseInputItem);
      }

      for (const call of toolCalls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(call.arguments) as Record<string, unknown>;
        } catch {
          parsedArgs = {};
        }

        logOrchestratorEvent("tool_call", {
          flow: workingContext.flow ?? "roi",
          tool: call.name,
          iteration,
        });
        logSpeed2LeadTestEvent(workingContext.phone, "tool_call", {
          tool: call.name,
          iteration,
        });

        if (call.name === "get_availability") {
          llmCalledGetAvailability = true;
        }
        if (call.name === "book_appointment") {
          llmCalledBookAppointment = true;
          logSpeed2LeadTestEvent(workingContext.phone, "booking_attempt", {
            source: "llm_tool_loop",
          });
        }

        const executed = await executeOrchestratorTool(
          call.name,
          parsedArgs,
          workingContext,
          toolState,
          now,
        );
        workingContext = executed.context;
        toolState = executed.state;

        logOrchestratorEvent("tool_result", {
          flow: workingContext.flow ?? "roi",
          tool: call.name,
          ok: Boolean((executed.result as { ok?: boolean }).ok),
        });
        if (call.name === "get_availability") {
          logSpeed2LeadTestEvent(workingContext.phone, "availability_result", {
            slotCount: toolState.offeredSlots.length,
            ok: Boolean((executed.result as { ok?: boolean }).ok),
          });
        }
        if (call.name === "book_appointment") {
          logSpeed2LeadTestEvent(workingContext.phone, "booking_result", {
            ok: Boolean((executed.result as { ok?: boolean }).ok),
            bookingConfirmed: toolState.bookingConfirmed,
          });
        }

        conversationInput.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(executed.result),
        });
      }
    }
  } catch (error) {
    logOrchestratorEvent("openai_error", {
      flow: context.flow ?? "roi",
      stage: "tool_loop",
      error: error instanceof Error ? error.message : String(error),
    });

    const gateResult = await enforceSchedulingGate({
      plan: gatePlan,
      inboundMessage,
      context: workingContext,
      toolState,
      llmReply: latestDraft,
      llmCalledGetAvailability,
      llmCalledBookAppointment,
      now,
    });
    workingContext = gateResult.context;
    toolState = gateResult.toolState;

    const recovery = resolveAuthoritativeSchedulingReply({
      gateResult,
      llmReply: latestDraft,
      firstName: workingContext.firstName,
      context: workingContext,
      toolState,
      calendarLinkAllowed: gateResult.calendarLinkAllowed,
    });
    if (recovery !== null) {
      workingContext = persistSchedulingToolState(
        workingContext,
        toolState,
        gateResult.activeRequestKey,
      );
      logTestTurnComplete(context.phone, workingContext.flow ?? "roi", turnStartedAt, workingContext, {
        handled: true,
        authoritativeScheduling: true,
        openAiErrorRecovery: true,
      });
      return { handled: true, reply: recovery, context: workingContext };
    }

    logTestTurnComplete(context.phone, workingContext.flow ?? "roi", turnStartedAt, workingContext, {
      handled: false,
      reason: "openai_error",
    });
    return {
      handled: false,
      fallbackToRules: true,
      reason: "openai_error",
      context: workingContext,
      recoveryReply: buildDeterministicRecoveryReply({ context: workingContext, toolState, gateResult })
        ?? undefined,
    };
  }

  const gateResult = await enforceSchedulingGate({
    plan: gatePlan,
    inboundMessage,
    context: workingContext,
    toolState,
    llmReply: latestDraft,
    llmCalledGetAvailability,
    llmCalledBookAppointment,
    now,
  });
  workingContext = gateResult.context;
  toolState = gateResult.toolState;
  if (gatePlan.action.type === "book_appointment" || gateResult.bookingAttempted) {
    logSpeed2LeadTestEvent(context.phone, "booking_attempt", {
      source: "scheduling_gate",
      gateApplied: gateResult.gateApplied,
    });
    logSpeed2LeadTestEvent(context.phone, "booking_result", {
      bookingConfirmed: toolState.bookingConfirmed,
      bookingFailed: toolState.bookingFailed,
    });
  }
  if (gateResult.availabilityFetched) {
    logSpeed2LeadTestEvent(context.phone, "availability_result", {
      slotCount: toolState.offeredSlots.length,
      source: "scheduling_gate",
    });
  }
  if (gateResult.forcedReply) {
    logSpeed2LeadTestEvent(context.phone, "forced_reply", {
      gateApplied: gateResult.gateApplied,
      replyLength: gateResult.forcedReply.length,
    });
  }
  workingContext = persistSchedulingToolState(
    workingContext,
    toolState,
    gateResult.activeRequestKey,
  );

  const authoritativeReply = resolveAuthoritativeSchedulingReply({
    gateResult,
    llmReply: latestDraft,
    firstName: workingContext.firstName,
    context: workingContext,
    toolState,
    calendarLinkAllowed: gateResult.calendarLinkAllowed,
  });

  if (authoritativeReply !== null) {
    logOrchestratorEvent("turn_complete", {
      flow: workingContext.flow ?? "roi",
      bookingConfirmed: toolState.bookingConfirmed,
      offeredSlots: toolState.offeredSlots.length,
      authoritativeScheduling: true,
    });
    logSpeed2LeadTestEvent(context.phone, "forced_reply", {
      used: true,
      authoritative: true,
    });
    logSpeed2LeadTestEvent(context.phone, "guardrail_result", {
      ok: true,
      path: "authoritative_scheduling",
    });
    logTestTurnComplete(context.phone, workingContext.flow ?? "roi", turnStartedAt, workingContext, {
      handled: true,
      authoritativeScheduling: true,
    });
    return {
      handled: true,
      reply: authoritativeReply,
      context: workingContext,
    };
  }

  const composedDraft = selectOutboundSchedulingReply({
    llmReply: latestDraft,
    gateResult,
    firstName: workingContext.firstName,
  });
  const draft = resolveFinalReply(
    composedDraft,
    workingContext,
    toolState,
    gateResult.calendarLinkAllowed,
  );

  let validated: string | null = null;
  if (!gateResult.gateApplied) {
    validated = await validateOrRepair(
      draft,
      workingContext,
      toolState,
      buildConversationInput(workingContext),
      deps,
      model,
      runModel,
      gateResult.calendarLinkAllowed,
    );
  }

  if (!validated) {
    validated = buildDeterministicRecoveryReply({
      context: workingContext,
      toolState,
      gateResult,
    });
  }

  if (!validated) {
    const recoveryCandidate =
      gateResult.forcedReply ??
      (toolState.offeredSlots.length > 0
        ? buildSlotOfferMessage(toolState.offeredSlots)
        : null);

    if (isActiveV2Scheduling(workingContext) && recoveryCandidate) {
      const recoveryPass = validateOutboundSms(recoveryCandidate, {
        session: workingContext,
        toolState,
      });
      if (recoveryPass.ok) {
        logOrchestratorEvent("turn_complete", {
          flow: workingContext.flow ?? "roi",
          bookingConfirmed: toolState.bookingConfirmed,
          offeredSlots: toolState.offeredSlots.length,
          v2SchedulingRecovery: true,
        });
        logTestTurnComplete(context.phone, workingContext.flow ?? "roi", turnStartedAt, workingContext, {
          handled: true,
          v2SchedulingRecovery: true,
        });
        return {
          handled: true,
          reply: recoveryPass.text,
          context: workingContext,
        };
      }
    }

    if (isActiveV2Scheduling(workingContext)) {
      logOrchestratorEvent("fallback_rules", {
        flow: context.flow ?? "roi",
        reason: "v2_scheduling_recovery",
      });
      logSpeed2LeadTestEvent(context.phone, "rules_fallback", {
        reason: "guardrail_or_empty_reply",
        v2Scheduling: true,
      });
      logTestTurnComplete(context.phone, workingContext.flow ?? "roi", turnStartedAt, workingContext, {
        handled: false,
      });
      return {
        handled: false,
        fallbackToRules: true,
        reason: "guardrail_or_empty_reply",
        context: workingContext,
        recoveryReply:
          recoveryCandidate ?? genericRecoveryMessage(workingContext),
      };
    }

    logOrchestratorEvent("fallback_rules", {
      flow: context.flow ?? "roi",
      reason: "guardrail_or_empty_reply",
    });
    logSpeed2LeadTestEvent(context.phone, "rules_fallback", {
      reason: "guardrail_or_empty_reply",
    });
    logTestTurnComplete(context.phone, workingContext.flow ?? "roi", turnStartedAt, workingContext, {
      handled: false,
    });
    return {
      handled: false,
      fallbackToRules: true,
      reason: "guardrail_or_empty_reply",
      context: workingContext,
    };
  }

  logOrchestratorEvent("turn_complete", {
    flow: workingContext.flow ?? "roi",
    bookingConfirmed: toolState.bookingConfirmed,
    offeredSlots: toolState.offeredSlots.length,
  });
  logSpeed2LeadTestEvent(context.phone, "guardrail_result", {
    ok: true,
    path: "validated_or_repaired",
  });
  logTestTurnComplete(context.phone, workingContext.flow ?? "roi", turnStartedAt, workingContext, {
    handled: true,
  });

  return {
    handled: true,
    reply: validated,
    context: workingContext,
  };
}
