/**
 * Webhook entrypoint for the rebuilt Speed2Lead agent (ROI + contact + demo).
 *
 * Deterministic responsibilities live here: opt-out handling, booking-link
 * handoff, and persisting state. Meeting conversion is booking-link only —
 * the appointment lifecycle establishes BOOKED. Reply wording is delegated
 * to `llmTurn.ts`, except contact/demo decline/pricing/injection guards.
 */
import { resolveContactDeclineAction } from "~/server/speed2Lead/agent/contactFlow/declineHandling";
import { resolveDemoDeclineAction } from "~/server/speed2Lead/agent/demoFlow/declineHandling";
import {
  applyRoiDiscoveryCap,
  buildDiscoveryClosedFallback,
  closeDiscovery,
  discoveryPainQuantified,
  discoveryRequirementsMet,
  looksLikeBridgeQuestion,
  markDiscoveryQuestionAsked,
  replyContainsQuestion,
  shouldBlockDiscoveryReply,
  shouldCloseDiscoveryFromInbound,
  shouldCloseDiscoveryFromModel,
  isConsequenceQuestion,
} from "~/server/speed2Lead/agent/discoveryGuard";
import {
  isDirectMeetingIntent,
  isMeetingAgreeIntent,
  isOffTopicRedirect,
  isPricingQuestion,
  isPromptInjectionAttempt,
} from "~/server/speed2Lead/agent/contactFlow/intentDetect";
import {
  buildInjectionRedirect,
  buildOffTopicRedirect,
  PRICING_RESPONSE_COPY,
} from "~/server/speed2Lead/agent/contactFlow/openers";
import {
  avoidDuplicateAssistantReply,
  buildConsequenceQuestionVariant,
  buildDiscoveryProceedFallback,
  countConsequenceQuestionsAsked,
  shouldProceedAfterRepeatedCostAsk,
} from "~/server/speed2Lead/agent/contactFlow/discoveryReply";
import {
  guardAgentReply,
  shouldPreserveTerminalStage,
} from "~/server/speed2Lead/agent/scheduling/replyGuard";
import {
  buildDemoDiscoveryFallback,
  buildDemoInjectionRedirect,
  buildDemoOffTopicRedirect,
  DEMO_PRICING_RESPONSE_COPY,
} from "~/server/speed2Lead/agent/demoFlow/openers";
import { resolveRoiDeclineAction } from "~/server/speed2Lead/agent/roiDeclineHandling";
import {
  acquireAgentInboundLock,
  appendMessage,
  claimAgentOutboundForInbound,
  claimInboundMessageSid,
  getAgentSession,
  isOptedOut,
  releaseAgentInboundLock,
  saveAgentSession,
  type AgentSession,
} from "~/server/speed2Lead/agent/state";
import { runAgentTurn, type AgentTurnOutput } from "~/server/speed2Lead/agent/llmTurn";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { cancelPendingNoResponseCampaign } from "~/server/speed2Lead/agent/noResponseCampaign";
import { cancelPendingPainPrompt } from "~/server/speed2Lead/agent/painPrompt";
import {
  executeBookingLinkResend,
  executeBookingLinkTransition,
  isExplicitHumanRequest,
  isManualBookingRequest,
  markBridgeDelivered,
  maybeEscalateHumanFromPending,
  shouldResendBookingLink,
  shouldTransitionToBookingLink,
} from "~/server/speed2Lead/agent/bookingLinkHandoff";
import { handleAppointmentLifecycleInbound } from "~/server/appointmentLifecycle/handleInbound";
import { classifyLifecycleIntent, isAmbiguousCancellation } from "~/server/appointmentLifecycle/intents";
import { getActiveLifecycleForPhone } from "~/server/appointmentLifecycle/store";
import { persistHumanFollowUp } from "~/server/speed2Lead/agent/humanFollowUp";
import { sendHumanAlert } from "~/server/speed2Lead/agent/humanAlert";
import { processGlobalOptOut } from "~/server/sms/optOut";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import {
  buildPainClarifyingReply,
  containsPainHint,
  isAmbiguousDiscoveryReply,
  isMeetingDecline,
  isMeetingDeclineStage,
  sessionAwaitingPainAnswer,
} from "~/server/speed2Lead/agent/turnGuards";
import { sendSms } from "~/server/sms/twilio";
import { normalizePhone } from "~/server/sms/phone";

async function cancelPendingScheduledOutreach(session: AgentSession): Promise<AgentSession> {
  let updated = await cancelPendingPainPrompt(session);
  updated = await cancelPendingNoResponseCampaign(updated);
  return updated;
}

async function persistSessionAfterTurn(session: AgentSession): Promise<void> {
  let next = session;
  // Read-compat: persisted pre-Phase-B scheduling stages cannot be written
  // back. New sessions never enter them; inbound continues via booking-link.
  if (
    next.stage !== "booking_link_pending" &&
    next.stage !== "booked" &&
    next.stage !== "handoff" &&
    next.stage !== "declined" &&
    (next.stage === "offering_slots" || next.stage === "confirming")
  ) {
    next = { ...next, stage: "bridge" };
  }
  if (next.stage === "bridge") {
    next = markBridgeDelivered(next);
  }
  await saveAgentSession(next);
}

async function sendAgentReplySms(
  phone: string,
  body: string,
  messageSid: string | undefined,
): Promise<boolean> {
  if (!(await claimAgentOutboundForInbound(messageSid))) {
    console.warn("handleAgentInboundSms skipped duplicate outbound", {
      phoneSuffix: phone.slice(-4),
      messageSid,
    });
    return false;
  }
  await sendSms(phone, body);
  return true;
}

export async function handleAgentInboundSms(
  fromPhoneRaw: string,
  body: string,
  messageSid?: string,
): Promise<void> {
  const phone = normalizePhone(fromPhoneRaw);

  if (await isOptedOut(phone)) {
    return;
  }

  let session = await getAgentSession(phone);
  if (!session) {
    // No active ROI-report session for this number — nothing to do. (The
    // contact/demo flows are untouched and continue to run separately.)
    return;
  }

  // A Twilio webhook retry (or genuine duplicate delivery) of a message we
  // already processed must be a no-op — otherwise it double-sends a reply
  // and can double-book. Twilio always includes a MessageSid; compare it to
  // the last one we actually acted on for this phone.
  if (messageSid && session.lastInboundMessageSid === messageSid) {
    return;
  }

  const lockToken = await acquireAgentInboundLock(phone);
  if (!lockToken) {
    return;
  }

  try {
    session = await getAgentSession(phone);
    if (!session) {
      return;
    }
    if (messageSid && session.lastInboundMessageSid === messageSid) {
      return;
    }
    if (messageSid && !(await claimInboundMessageSid(messageSid, phone))) {
      return;
    }

    session = appendMessage(session, "user", body);
    session.lastInboundMessageSid = messageSid;
    // The prospect engaged before the scheduled second opener message went
    // out — cancel it rather than asking a question they've already answered.
    session = await cancelPendingScheduledOutreach(session);

    if (session.stage === "handoff") {
      logAppointmentEvent("handoff_inbound_logged", {
        phone,
        inbound: body.slice(0, 160),
      });
      await persistSessionAfterTurn(session);
      return;
    }

    const activeLifecycle = await getActiveLifecycleForPhone(phone);
    const lifecycleIntent = classifyLifecycleIntent(body);
    if (activeLifecycle && lifecycleIntent !== "none") {
      if (lifecycleIntent === "cancel" && isAmbiguousCancellation(body)) {
        const escalated = await persistHumanFollowUp(session, "ambiguous_reschedule");
        await sendHumanAlert({
          reason: "ambiguous_reschedule",
          subjectId: phone,
          body: `S2L ambiguous reschedule/cancel from ${phone}: ${body.slice(0, 160)}`,
        });
        return;
      }
      const lifecycle = await handleAppointmentLifecycleInbound(phone, body, null);
      if (lifecycle.handled) {
        if (lifecycle.reply) {
          session = appendMessage(session, "assistant", lifecycle.reply);
        }
        await persistSessionAfterTurn(session);
        return;
      }
    }

    const escalated = await maybeEscalateHumanFromPending(session, body);
    if (escalated) {
      return;
    }
    if (isExplicitHumanRequest(body) && session.stage !== "booking_link_pending") {
      await persistHumanFollowUp(session, "explicit_human_request");
      await sendHumanAlert({
        reason: "explicit_human_request",
        subjectId: phone,
        body: `S2L explicit human request from ${phone} (${session.flow}).`,
      });
      return;
    }

    if (shouldTransitionToBookingLink(session, body)) {
      await executeBookingLinkTransition(session, messageSid);
      return;
    }

    if (shouldResendBookingLink(session, body) || (session.stage === "booking_link_pending" && isManualBookingRequest(body))) {
      await executeBookingLinkResend(session);
      return;
    }

    const profile = getActiveProfile();
    const isContact = session.flow === "contact";
    const isDemo = session.flow === "demo";
    const isDiscoveryFlow = isContact || isDemo;

    if (isDemo) {
      const declineAction = await resolveDemoDeclineAction(session, body);
      if (declineAction.type === "send" || declineAction.type === "terminal") {
        await sendAgentReplySms(phone, declineAction.reply, messageSid);
        session = { ...session, ...declineAction.sessionPatch };
        session = appendMessage(session, "assistant", declineAction.reply);
        await persistSessionAfterTurn(session);
        return;
      }

      if (isPromptInjectionAttempt(body)) {
        const reply = buildDemoInjectionRedirect();
        await sendAgentReplySms(phone, reply, messageSid);
        session = appendMessage(session, "assistant", reply);
        await persistSessionAfterTurn(session);
        return;
      }

      if (isOffTopicRedirect(body)) {
        const reply = buildDemoOffTopicRedirect();
        await sendAgentReplySms(phone, reply, messageSid);
        session = appendMessage(session, "assistant", reply);
        await persistSessionAfterTurn(session);
        return;
      }

      if (isPricingQuestion(body) && !session.pricingQuestionActive) {
        session.stageBeforePricing = session.stage;
        session.pricingQuestionActive = true;
        await sendAgentReplySms(phone, DEMO_PRICING_RESPONSE_COPY, messageSid);
        session = appendMessage(session, "assistant", DEMO_PRICING_RESPONSE_COPY);
        await persistSessionAfterTurn(session);
        return;
      }

      if (session.pricingQuestionActive) {
        session.pricingQuestionActive = false;
        if (session.stageBeforePricing) {
          session.stage = session.stageBeforePricing;
        }
        if (isMeetingAgreeIntent(body) || isDirectMeetingIntent(body)) {
          session = closeDiscovery(session);
          session.stage = "bridge";
        }
      }

      if (shouldCloseDiscoveryFromInbound(body, session)) {
        session = closeDiscovery(session);
        if (isDirectMeetingIntent(body)) {
          session.stage = "bridge";
        }
      } else if (
        isMeetingAgreeIntent(body) &&
        session.stage === "discovery" &&
        discoveryRequirementsMet(session, body)
      ) {
        session = closeDiscovery(session);
        session.stage = "bridge";
      }
    }

    if (isContact) {
      const declineAction = resolveContactDeclineAction(session, body);
      if (declineAction.type === "send" || declineAction.type === "terminal") {
        await sendAgentReplySms(phone, declineAction.reply, messageSid);
        session = { ...session, ...declineAction.sessionPatch };
        session = appendMessage(session, "assistant", declineAction.reply);
        await persistSessionAfterTurn(session);
        return;
      }

      if (isPromptInjectionAttempt(body)) {
        const reply = buildInjectionRedirect();
        await sendAgentReplySms(phone, reply, messageSid);
        session = appendMessage(session, "assistant", reply);
        await persistSessionAfterTurn(session);
        return;
      }

      if (isOffTopicRedirect(body)) {
        const reply = buildOffTopicRedirect();
        await sendAgentReplySms(phone, reply, messageSid);
        session = appendMessage(session, "assistant", reply);
        await persistSessionAfterTurn(session);
        return;
      }

      if (isPricingQuestion(body) && !session.pricingQuestionActive) {
        session.stageBeforePricing = session.stage;
        session.pricingQuestionActive = true;
        await sendAgentReplySms(phone, PRICING_RESPONSE_COPY, messageSid);
        session = appendMessage(session, "assistant", PRICING_RESPONSE_COPY);
        await persistSessionAfterTurn(session);
        return;
      }

      if (session.pricingQuestionActive) {
        session.pricingQuestionActive = false;
        if (session.stageBeforePricing) {
          session.stage = session.stageBeforePricing;
        }
        if (isMeetingAgreeIntent(body) || isDirectMeetingIntent(body)) {
          session = closeDiscovery(session);
          session.stage = "bridge";
        }
      }

      if (shouldCloseDiscoveryFromInbound(body, session)) {
        session = closeDiscovery(session);
        if (isDirectMeetingIntent(body)) {
          session.stage = "bridge";
        }
      } else if (
        isMeetingAgreeIntent(body) &&
        session.stage === "discovery" &&
        discoveryRequirementsMet(session, body)
      ) {
        session = closeDiscovery(session);
        session.stage = "bridge";
      }
    }

    const ambiguousPainReply =
      !isDiscoveryFlow &&
      sessionAwaitingPainAnswer(session) &&
      isAmbiguousDiscoveryReply(body) &&
      !containsPainHint(body, profile);

    if (ambiguousPainReply) {
      const reply = buildPainClarifyingReply(profile);
      await sendAgentReplySms(phone, reply, messageSid);
      session = appendMessage(session, "assistant", reply);
      await persistSessionAfterTurn(session);
      return;
    }

    if (!isDiscoveryFlow) {
      const declineAction = await resolveRoiDeclineAction(session, body);
      if (declineAction.type === "send" || declineAction.type === "terminal") {
        await sendAgentReplySms(phone, declineAction.reply, messageSid);
        session = { ...session, ...declineAction.sessionPatch };
        session = appendMessage(session, "assistant", declineAction.reply);
        await persistSessionAfterTurn(session);
        return;
      }
    }

    const declineThisTurn =
      !isDiscoveryFlow && isMeetingDecline(body) && isMeetingDeclineStage(session.stage);
    if (declineThisTurn) {
      session.meetingDeclineCount = (session.meetingDeclineCount ?? 0) + 1;
    }

    let output: AgentTurnOutput;
    try {
      output = await runAgentTurn(profile, session);
    } catch (error) {
      console.error("Speed2Lead agent turn failed:", error);
      const fallback =
        "Sorry, hit a snag on my end — mind resending that? If it keeps happening, just let me know and I'll call you directly.";
      await sendAgentReplySms(phone, fallback, messageSid);
      session = appendMessage(session, "assistant", fallback);
      await persistSessionAfterTurn(session);
      return;
    }

    if (output.opt_out) {
      await processGlobalOptOut(phone);
      session.stage = "declined";
      session = await cancelPendingNoResponseCampaign(session);
      await persistSessionAfterTurn(session);
      return;
    }

    if (output.stage === "handoff") {
      output = { ...output, stage: session.stage === "booking_link_pending" ? "booking_link_pending" : session.stage };
    }
    if (session.stage === "booking_link_pending") {
      output = {
        ...output,
        stage: "booking_link_pending",
        wants_meeting: false,
      };
    }

    if (!isDiscoveryFlow) {
      const capped = applyRoiDiscoveryCap(session, {
        reply: output.reply,
        stage: output.stage,
      });
      session = capped.session;
      output = {
        ...output,
        reply: capped.output.reply,
        stage:
          capped.output.stage === "offering_slots" || capped.output.stage === "confirming"
            ? "bridge"
            : capped.output.stage,
      };
    }

    // Normal turn: trust the model's stage/pain tracking, but never let it
    // regress out of a real completed booking or an explicit decline.
    // A "booked" stage without bookedEventId is a fake claim — do not protect it.
    if (!isDiscoveryFlow && !shouldPreserveTerminalStage(session)) {
      session.stage = output.stage;
    }
    if (output.primary_pain && !ambiguousPainReply) {
      session.primaryPain = output.primary_pain;
    }

    if (isDiscoveryFlow) {
      let reply = output.reply;
      const canLeaveDiscovery = discoveryRequirementsMet(session, body);
      const painQuantified = discoveryPainQuantified(session, body);

      if (isContact && output.discovery_answer_sufficient && !session.discoveryClosed) {
        if (painQuantified) {
          session = closeDiscovery(session);
          if (output.stage === "discovery") {
            output = { ...output, stage: "bridge" };
          }
        } else {
          output = {
            ...output,
            stage: "discovery",
            wants_meeting: false,
            discovery_answer_sufficient: false,
          };
          reply = buildConsequenceQuestionVariant(countConsequenceQuestionsAsked(session));
        }
      }

      if (
        isDemo &&
        !canLeaveDiscovery &&
        (output.stage === "bridge" || output.wants_meeting || looksLikeBridgeQuestion(reply))
      ) {
        reply = buildDemoDiscoveryFallback();
        output = { ...output, stage: "discovery", wants_meeting: false };
      }

      if (!painQuantified && !session.discoveryClosed) {
        if (
          output.stage === "bridge" ||
          looksLikeBridgeQuestion(reply) ||
          (output.wants_meeting && !isDirectMeetingIntent(body))
        ) {
          if (isDemo) {
            reply = buildDemoDiscoveryFallback();
          } else if (isContact && !isConsequenceQuestion(reply)) {
            reply = buildConsequenceQuestionVariant(countConsequenceQuestionsAsked(session));
          }
          output = { ...output, stage: "discovery", wants_meeting: false };
        }
      }

      if (isContact && isConsequenceQuestion(reply) && shouldProceedAfterRepeatedCostAsk(session, reply)) {
        reply = buildDiscoveryProceedFallback(session);
        session = closeDiscovery(session);
        output = { ...output, stage: "bridge", wants_meeting: false };
      } else if (
        isContact &&
        session.stage === "discovery" &&
        !session.discoveryClosed &&
        (session.discoveryQuestionCount ?? 0) >= 1 &&
        !isConsequenceQuestion(reply) &&
        !looksLikeBridgeQuestion(reply)
      ) {
        reply = buildConsequenceQuestionVariant(countConsequenceQuestionsAsked(session));
        session = markDiscoveryQuestionAsked(session);
        output = { ...output, stage: "discovery", wants_meeting: false };
      } else if (isContact) {
        reply = avoidDuplicateAssistantReply(session, reply);
      }

      const askedDiscoveryQuestion =
        replyContainsQuestion(reply) &&
        output.stage === "discovery" &&
        !output.wants_meeting &&
        !looksLikeBridgeQuestion(reply) &&
        !session.discoveryClosed;

      const blockedDiscovery = shouldBlockDiscoveryReply(session, reply, body);
      if (blockedDiscovery) {
        reply = buildDiscoveryClosedFallback(session);
        session = closeDiscovery(session);
        if (session.stage !== "offering_slots" && session.stage !== "confirming") {
          session.stage = "bridge";
        }
      } else if (askedDiscoveryQuestion) {
        session = markDiscoveryQuestionAsked(session);
      }

      if (shouldCloseDiscoveryFromModel(output) && canLeaveDiscovery && painQuantified) {
        session = closeDiscovery(session);
      }
      if (output.wants_meeting && canLeaveDiscovery && painQuantified) {
        session = closeDiscovery(session);
        session.meetingDeclineCount = 0;
      } else if (output.wants_meeting && (!canLeaveDiscovery || !painQuantified)) {
        output = { ...output, wants_meeting: false, stage: "discovery" };
      }

      if (!blockedDiscovery && !shouldPreserveTerminalStage(session)) {
        if (!canLeaveDiscovery && output.stage === "bridge") {
          session.stage = "discovery";
        } else {
          session.stage = output.stage;
        }
      }

      const guarded = guardAgentReply({
        reply,
        session,
        fetchFailed: false,
        modelStage: session.stage,
        bookingConfirmed: false,
      });
      reply = guarded.reply;
      session = guarded.session;
      if (!shouldPreserveTerminalStage(session)) {
        session.stage = guarded.stage;
      }

      await sendAgentReplySms(phone, reply, messageSid);
      session = appendMessage(session, "assistant", reply);
      await persistSessionAfterTurn(session);
      return;
    }

    if (output.wants_meeting && !declineThisTurn) {
      session.meetingDeclineCount = 0;
    }

    const declineCount = session.meetingDeclineCount ?? 0;
    if (declineCount >= 2) {
      session.stage = "declined";
    } else if (declineCount === 1) {
      session.stage =
        session.stage === "offering_slots" || session.stage === "confirming"
          ? session.stage
          : "bridge";
    }

    const guarded = guardAgentReply({
      reply: output.reply,
      session,
      fetchFailed: false,
      modelStage: session.stage,
      bookingConfirmed: false,
    });
    if (guarded.flaggedFailure) {
      session = guarded.session;
    }
    if (!shouldPreserveTerminalStage(session)) {
      session.stage = guarded.stage;
    }

    await sendAgentReplySms(phone, guarded.reply, messageSid);
    session = appendMessage(session, "assistant", guarded.reply);
    await persistSessionAfterTurn(session);
  } finally {
    await releaseAgentInboundLock(phone, lockToken);
  }
}
