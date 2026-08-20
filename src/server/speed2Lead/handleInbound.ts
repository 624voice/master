import { handleAppointmentLifecycleInbound } from "~/server/appointmentLifecycle/handleInbound";
import { isSpeed2LeadLlmEnabled } from "~/server/speed2Lead/config";
import { classifyGlobalIntent } from "~/server/speed2Lead/globalIntents";
import { orchestrateInboundTurn } from "~/server/speed2Lead/orchestrator";
import { isActiveV2Scheduling } from "~/server/speed2Lead/schedulingController";
import { genericRecoveryMessage } from "~/server/speed2Lead/guardrails";
import {
  logSpeed2LeadTestEvent,
  summarizeSchedulingState,
} from "~/server/speed2Lead/testObservability";
import {
  isSpeed2LeadTestPhoneAllowlistActive,
  shouldUseSpeed2LeadLlmForPhone,
} from "~/server/speed2Lead/testPhoneAllowlist";
import { advanceDemoConversation } from "~/server/demoSpeed2Lead/stateMachine";
import {
  declineMessage as demoDeclineMessage,
  unknownInboundMessage as demoUnknownInboundMessage,
} from "~/server/demoSpeed2Lead/messages";
import { removeDemoFollowUp } from "~/server/demoSpeed2Lead/processFollowUps";
import type { DemoConversationContext } from "~/server/demoSpeed2Lead/types";
import { advanceContactConversation } from "~/server/contactSpeed2Lead/stateMachine";
import {
  declineMessage as contactDeclineMessage,
} from "~/server/contactSpeed2Lead/messages";
import type { ContactConversationContext } from "~/server/contactSpeed2Lead/types";
import { advanceConversation } from "~/server/speed2Lead/stateMachine";
import {
  appendUserMessage,
  applyDisposition,
  clearSession,
  getSession,
  isOptedOut,
  saveSession,
  setOptedOut,
} from "~/server/speed2Lead/session";
import {
  declineMessage,
  optOutConfirmationMessage,
  softCloseAckMessage,
  unknownInboundMessage,
} from "~/server/speed2Lead/messages";
import {
  isGenericAcknowledgment,
  isSubstantiveReengagement,
  resolveDispositionAfterInbound,
} from "~/server/speed2Lead/conversationDisposition";
import {
  logInboundConversationSms,
  sendConversationSms,
} from "~/server/speed2Lead/conversationSms";
import type { AnyConversationContext } from "~/server/speed2Lead/types";
import { normalizePhone } from "~/server/sms/phone";

function isContactSession(
  session: AnyConversationContext | null,
): session is ContactConversationContext {
  return session?.flow === "contact";
}

function isDemoSession(
  session: AnyConversationContext | null,
): session is DemoConversationContext {
  return session?.flow === "demo";
}

export async function handleInboundSms(from: string, body: string): Promise<void> {
  const phone = normalizePhone(from);
  let session = await getSession(phone);
  const intent = classifyGlobalIntent(body);

  logInboundConversationSms(phone, body, session);

  logSpeed2LeadTestEvent(phone, "inbound_received", {
    flow: session?.flow ?? "none",
    messageLength: body.length,
    hasSession: Boolean(session),
    ...summarizeSchedulingState(session),
  });

  if (intent === "stop") {
    await setOptedOut(phone);
    await clearSession(phone);
    await removeDemoFollowUp(phone);
    await sendConversationSms(phone, optOutConfirmationMessage());
    return;
  }

  if (await isOptedOut(phone)) {
    return;
  }

  if (session) {
    session = appendUserMessage(session, body);
    const disposition = resolveDispositionAfterInbound(session, body);
    session = applyDisposition(session, disposition);
  }

  const lifecycle = await handleAppointmentLifecycleInbound(phone, body, session);
  if (lifecycle.handled) {
    if (session && !lifecycle.sessionPersisted) {
      await saveSession(session);
    }
    return;
  }

  if (!session) {
    await sendConversationSms(phone, unknownInboundMessage());
    return;
  }

  if (intent === "decline") {
    const completed = {
      ...session,
      state: "completed" as const,
      updatedAt: new Date().toISOString(),
    };
    const updated = await sendConversationSms(
      phone,
      isDemoSession(session)
        ? demoDeclineMessage()
        : isContactSession(session)
          ? contactDeclineMessage()
          : declineMessage(),
      completed,
    );
    await saveSession(updated ?? completed);
    if (isDemoSession(session)) {
      await removeDemoFollowUp(phone);
    }
    return;
  }

  if (isDemoSession(session)) {
    await removeDemoFollowUp(phone);
  }

  if (
    session.disposition === "soft_closed" &&
    isGenericAcknowledgment(body) &&
    !isSubstantiveReengagement(body)
  ) {
    const ack = softCloseAckMessage();
    const updated = await sendConversationSms(phone, ack, session);
    await saveSession(updated ?? session);
    logSpeed2LeadTestEvent(phone, "outbound_sent", {
      flow: session.flow ?? "roi",
      replyLength: ack.length,
      handledBy: "soft_close_ack",
      disposition: "soft_closed",
    });
    return;
  }

  const useLlmOrchestrator = shouldUseSpeed2LeadLlmForPhone(phone);
  if (
    isSpeed2LeadLlmEnabled() &&
    isSpeed2LeadTestPhoneAllowlistActive() &&
    !useLlmOrchestrator
  ) {
    logSpeed2LeadTestEvent(phone, "rules_fallback", {
      reason: "not_on_test_allowlist",
      flow: session.flow ?? "roi",
    });
  }

  if (useLlmOrchestrator) {
    const turnStartedAt = Date.now();
    logSpeed2LeadTestEvent(phone, "llm_turn_start", {
      flow: session.flow ?? "roi",
      ...summarizeSchedulingState(session),
    });

    const orchestrated = await orchestrateInboundTurn(session, body);
    if (orchestrated.handled) {
      const updated = await sendConversationSms(
        phone,
        orchestrated.reply,
        orchestrated.context,
      );
      await saveSession(updated ?? orchestrated.context);
      logSpeed2LeadTestEvent(phone, "outbound_sent", {
        flow: orchestrated.context.flow ?? "roi",
        replyLength: orchestrated.reply.length,
        handledBy: "llm",
        durationMs: Date.now() - turnStartedAt,
        ...summarizeSchedulingState(updated ?? orchestrated.context),
      });
      if (isDemoSession(orchestrated.context) && orchestrated.context.meetingBooked) {
        await removeDemoFollowUp(phone);
      }
      return;
    }

    if (isActiveV2Scheduling(orchestrated.context)) {
      const recoveryReply =
        orchestrated.recoveryReply ?? genericRecoveryMessage(orchestrated.context);
      logSpeed2LeadTestEvent(phone, "rules_fallback", {
        reason: orchestrated.reason,
        v2Recovery: true,
        forcedReplyUsed: Boolean(orchestrated.recoveryReply),
      });
      const updated = await sendConversationSms(
        phone,
        recoveryReply,
        orchestrated.context,
      );
      await saveSession(updated ?? orchestrated.context);
      logSpeed2LeadTestEvent(phone, "outbound_sent", {
        flow: orchestrated.context.flow ?? "roi",
        replyLength: recoveryReply.length,
        handledBy: "v2_recovery",
        durationMs: Date.now() - turnStartedAt,
        ...summarizeSchedulingState(updated ?? orchestrated.context),
      });
      return;
    }

    logSpeed2LeadTestEvent(phone, "rules_fallback", {
      reason: orchestrated.reason,
      flow: session.flow ?? "roi",
    });
  }

  const result = isDemoSession(session)
    ? advanceDemoConversation(session, body)
    : isContactSession(session)
      ? advanceContactConversation(session, body)
      : advanceConversation(session, body);

  const updated = await sendConversationSms(phone, result.reply, result.context);
  await saveSession(updated ?? result.context);
  logSpeed2LeadTestEvent(phone, "outbound_sent", {
    flow: result.context.flow ?? "roi",
    replyLength: result.reply.length,
    handledBy: useLlmOrchestrator ? "rules_after_llm_fallback" : "rules",
    ...summarizeSchedulingState(updated ?? result.context),
  });

  if (isDemoSession(result.context) && result.context.meetingBooked) {
    await removeDemoFollowUp(phone);
  }
}

export { demoUnknownInboundMessage };
