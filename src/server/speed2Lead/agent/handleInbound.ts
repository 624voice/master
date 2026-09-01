/**
 * Webhook entrypoint for the rebuilt Speed2Lead agent (ROI + contact flows).
 *
 * Deterministic responsibilities live here: opt-out handling, deciding when
 * to fetch real slots, executing a confirmed booking, and persisting state.
 * Everything about what to SAY is delegated to the single LLM call in
 * `llmTurn.ts`, except contact decline/pricing/injection guards owned in code.
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
import { buildContactSchedulingTurnReply } from "~/server/speed2Lead/agent/contactFlow/schedulingReply";
import {
  flagSchedulingFailure,
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
  setOptedOut,
  type AgentSession,
} from "~/server/speed2Lead/agent/state";
import { runAgentTurn, type AgentTurnOutput, type TurnContext } from "~/server/speed2Lead/agent/llmTurn";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { cancelPendingNoResponseCampaign } from "~/server/speed2Lead/agent/noResponseCampaign";
import { cancelPendingPainPrompt } from "~/server/speed2Lead/agent/painPrompt";
import {
  resolveSlotsForAgentTurn,
  validateConfirmBooking,
  applyExplicitBookConfirmOutput,
  EXPLICIT_BOOK_CONFIRM_RE,
} from "~/server/speed2Lead/agent/slotPreferences";
import { resolveOfferedSlotSelectionCandidate } from "~/server/speed2Lead/agent/schedulingContext";
import { confirmBookSlot, offerSlots } from "~/server/speed2Lead/agent/scheduling";
import { buildProviderConflictCopy } from "~/server/speed2Lead/agent/scheduling/copy";
import {
  buildPainClarifyingReply,
  containsPainHint,
  isAmbiguousDiscoveryReply,
  isMeetingDecline,
  isMeetingDeclineStage,
  sessionAwaitingPainAnswer,
} from "~/server/speed2Lead/agent/turnGuards";
import { buildBookingConfirmationMessage } from "~/server/speed2Lead/bookingConfirmation";
import { sendSms } from "~/server/sms/twilio";
import { normalizePhone } from "~/server/sms/phone";

const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);

function isStopKeyword(body: string): boolean {
  return STOP_KEYWORDS.has(body.trim().toLowerCase());
}

async function cancelPendingScheduledOutreach(session: AgentSession): Promise<AgentSession> {
  let updated = await cancelPendingPainPrompt(session);
  updated = await cancelPendingNoResponseCampaign(updated);
  return updated;
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

  if (isStopKeyword(body)) {
    await setOptedOut(phone);
    const stopSession = await getAgentSession(phone);
    if (stopSession) {
      const updated = await cancelPendingScheduledOutreach(stopSession);
      await saveAgentSession(updated);
    }
    return; // Twilio/carrier sends the compliance confirmation; don't double-text.
  }

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
        await saveAgentSession(session);
        return;
      }

      if (isPromptInjectionAttempt(body)) {
        const reply = buildDemoInjectionRedirect();
        await sendAgentReplySms(phone, reply, messageSid);
        session = appendMessage(session, "assistant", reply);
        await saveAgentSession(session);
        return;
      }

      if (isOffTopicRedirect(body)) {
        const reply = buildDemoOffTopicRedirect();
        await sendAgentReplySms(phone, reply, messageSid);
        session = appendMessage(session, "assistant", reply);
        await saveAgentSession(session);
        return;
      }

      if (isPricingQuestion(body) && !session.pricingQuestionActive) {
        session.stageBeforePricing = session.stage;
        session.pricingQuestionActive = true;
        await sendAgentReplySms(phone, DEMO_PRICING_RESPONSE_COPY, messageSid);
        session = appendMessage(session, "assistant", DEMO_PRICING_RESPONSE_COPY);
        await saveAgentSession(session);
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
        await saveAgentSession(session);
        return;
      }

      if (isPromptInjectionAttempt(body)) {
        const reply = buildInjectionRedirect();
        await sendAgentReplySms(phone, reply, messageSid);
        session = appendMessage(session, "assistant", reply);
        await saveAgentSession(session);
        return;
      }

      if (isOffTopicRedirect(body)) {
        const reply = buildOffTopicRedirect();
        await sendAgentReplySms(phone, reply, messageSid);
        session = appendMessage(session, "assistant", reply);
        await saveAgentSession(session);
        return;
      }

      if (isPricingQuestion(body) && !session.pricingQuestionActive) {
        session.stageBeforePricing = session.stage;
        session.pricingQuestionActive = true;
        await sendAgentReplySms(phone, PRICING_RESPONSE_COPY, messageSid);
        session = appendMessage(session, "assistant", PRICING_RESPONSE_COPY);
        await saveAgentSession(session);
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
      await saveAgentSession(session);
      return;
    }

    if (!isDiscoveryFlow) {
      const declineAction = await resolveRoiDeclineAction(session, body);
      if (declineAction.type === "send" || declineAction.type === "terminal") {
        await sendAgentReplySms(phone, declineAction.reply, messageSid);
        session = { ...session, ...declineAction.sessionPatch };
        session = appendMessage(session, "assistant", declineAction.reply);
        await saveAgentSession(session);
        return;
      }
    }

    const declineThisTurn =
      !isDiscoveryFlow && isMeetingDecline(body) && isMeetingDeclineStage(session.stage);
    if (declineThisTurn) {
      session.meetingDeclineCount = (session.meetingDeclineCount ?? 0) + 1;
    }

    const slotResolution = await resolveSlotsForAgentTurn(session, body, profile);
    session = slotResolution.session;
    const offered = slotResolution.slots;
    const turnContext: TurnContext = { slotsUnavailable: slotResolution.fetchFailed };
    const activeOffered = offered.length > 0 ? offered : (session.offeredSlots ?? []);
    const selectedOfferedIso =
      activeOffered.length > 0
        ? resolveOfferedSlotSelectionCandidate(
            body,
            activeOffered.map((slot) => slot.startIso),
          )
        : null;

    let output: AgentTurnOutput;
    try {
      output = await runAgentTurn(profile, session, offered, turnContext);
    } catch (error) {
      console.error("Speed2Lead agent turn failed:", error);
      const fallback =
        "Sorry, hit a snag on my end — mind resending that? If it keeps happening, just let me know and I'll call you directly.";
      await sendAgentReplySms(phone, fallback, messageSid);
      session = appendMessage(session, "assistant", fallback);
      await saveAgentSession(session);
      return;
    }

    if (output.opt_out) {
      await setOptedOut(phone);
      session.stage = "declined";
      session = await cancelPendingNoResponseCampaign(session);
      await saveAgentSession(session);
      return;
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
        stage: capped.output.stage,
        ...(capped.capped ? { confirm_booking: false } : {}),
      };
    }

    const explicitBook = applyExplicitBookConfirmOutput(body, session, offered, {
      confirm_booking: output.confirm_booking,
      slot_choice_index: output.slot_choice_index,
    });
    output = { ...output, ...explicitBook };

    if (
      output.confirm_booking &&
      selectedOfferedIso &&
      !EXPLICIT_BOOK_CONFIRM_RE.test(body)
    ) {
      output = { ...output, confirm_booking: false };
    }

    const bookingValidation = validateConfirmBooking({
      body,
      session,
      offered,
      slotChoiceIndex: output.slot_choice_index,
      confirmBooking: output.confirm_booking,
    });

    if (output.confirm_booking && !bookingValidation.proceed) {
      console.warn("Speed2Lead agent rejected premature confirm_booking", {
        phoneSuffix: phone.slice(-4),
        reason: bookingValidation.logReason,
        inbound: body.slice(0, 80),
        slotChoiceIndex: output.slot_choice_index,
        offeredCount: offered.length,
      });
      output = { ...output, confirm_booking: false, slot_choice_index: null };
    }

    const chosenSlot = bookingValidation.proceed ? bookingValidation.slot : undefined;

    if (output.confirm_booking && chosenSlot) {
      const booked = await confirmBookSlot({
        slot: chosenSlot,
        phone,
        attendeeName: session.firstName ?? "there",
        attendeeEmail: session.email,
        businessName: session.businessName,
        source:
          session.flow === "contact"
            ? "contact"
            : session.flow === "demo"
              ? "demo"
              : "roi",
      });

      if (booked.ok) {
        session.stage = "booked";
        session.bookedStartIso = booked.startIso;
        session.bookedEventId = booked.eventId;
        session.offeredSlots = [];
        session.slotPool = [];
        session = await cancelPendingNoResponseCampaign(session);

        if (booked.confirmationSmsSent) {
          // Lifecycle sent the Meet-link confirmation and scheduled reminders.
          session = appendMessage(session, "assistant", `[booked ${booked.startIso}]`);
          await saveAgentSession(session);
          return;
        }

        // Idempotent replay (or other lifecycle skip): lifecycle already sent
        // confirmation on the first book — send the same details once from here.
        const confirmation = buildBookingConfirmationMessage(
          booked.startIso,
          session.firstName ?? "there",
          { meetingLink: booked.meetUrl },
        );
        await sendAgentReplySms(phone, confirmation, messageSid);
        session = appendMessage(session, "assistant", confirmation);
        await saveAgentSession(session);
        return;
      }

      // Booking failed — code-owned conflict language; never trust model success text.
      session = flagSchedulingFailure(session, booked.reason);
      const refreshed = await offerSlots(profile);
      session.offeredSlots = refreshed.ok ? refreshed.slots : [];
      session.slotPool = refreshed.ok ? refreshed.slots : [];
      session.stage = "offering_slots";
      const text = buildProviderConflictCopy(
        (refreshed.ok ? refreshed.slots : []).map((slot) => slot.startIso),
      );
      await sendAgentReplySms(phone, text, messageSid);
      session = appendMessage(session, "assistant", text);
      await saveAgentSession(session);
      return;
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
        output = { ...output, stage: "discovery", wants_meeting: false, confirm_booking: false };
      }

      if (!painQuantified && !session.discoveryClosed) {
        if (
          output.stage === "bridge" ||
          output.stage === "offering_slots" ||
          looksLikeBridgeQuestion(reply) ||
          (output.wants_meeting && !isDirectMeetingIntent(body))
        ) {
          if (isDemo) {
            reply = buildDemoDiscoveryFallback();
          } else if (isContact && !isConsequenceQuestion(reply)) {
            reply = buildConsequenceQuestionVariant(countConsequenceQuestionsAsked(session));
          }
          output = { ...output, stage: "discovery", wants_meeting: false, confirm_booking: false };
        }
      }

      if (isContact && isConsequenceQuestion(reply) && shouldProceedAfterRepeatedCostAsk(session, reply)) {
        reply = buildDiscoveryProceedFallback(session);
        session = closeDiscovery(session);
        output = { ...output, stage: "bridge", wants_meeting: false, confirm_booking: false };
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
        output = { ...output, stage: "discovery", wants_meeting: false, confirm_booking: false };
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

      const schedulingReply = buildContactSchedulingTurnReply({
        session,
        inboundBody: body,
        offered,
        fetchFailed: slotResolution.fetchFailed,
        profile,
        llmReply: reply,
      });
      if (schedulingReply) {
        reply = schedulingReply;
        if (session.stage === "bridge" && (offered.length > 0 || session.requestedDate)) {
          session.stage = "offering_slots";
        }
      }

      if (selectedOfferedIso && session.discoveryClosed) {
        session.stage = "confirming";
        output = { ...output, stage: "confirming", confirm_booking: false };
      } else if (
        isDirectMeetingIntent(body) &&
        session.discoveryClosed &&
        offered.length > 0
      ) {
        session.stage = "offering_slots";
      }

      if (!blockedDiscovery && !shouldPreserveTerminalStage(session)) {
        const inScheduling =
          session.stage === "offering_slots" || session.stage === "confirming";
        if (inScheduling && (output.stage === "bridge" || output.stage === "discovery")) {
          // Never regress out of active scheduling on a preference/slot turn.
        } else if (
          session.discoveryClosed &&
          (session.stage === "offering_slots" || session.stage === "confirming" || offered.length > 0) &&
          (output.stage === "discovery" || output.stage === "bridge")
        ) {
          // Discovery is closed — ignore model regressions back into discovery/bridge.
        } else if (!canLeaveDiscovery && (output.stage === "bridge" || output.stage === "offering_slots")) {
          session.stage = "discovery";
        } else {
          session.stage = output.stage;
        }
      }
      if (offered.length > 0) {
        session.offeredSlots = offered;
        if (
          !selectedOfferedIso &&
          canLeaveDiscovery &&
          painQuantified &&
          (isDirectMeetingIntent(body) ||
            isMeetingAgreeIntent(body) ||
            output.wants_meeting ||
            output.stage === "offering_slots")
        ) {
          session.stage = "offering_slots";
        }
      }
      if (slotResolution.pool.length > 0) {
        session.slotPool = slotResolution.pool;
      }

      if (selectedOfferedIso && session.discoveryClosed) {
        session.stage = "confirming";
      }

      const guarded = guardAgentReply({
        reply,
        session,
        fetchFailed: slotResolution.fetchFailed,
        modelStage: session.stage,
        bookingConfirmed: false,
      });
      reply = guarded.reply;
      session = guarded.session;
      if (!shouldPreserveTerminalStage(session)) {
        session.stage = guarded.stage;
      }
      if (
        slotResolution.fetchFailed &&
        (session.stage === "offering_slots" ||
          session.stage === "confirming" ||
          session.requestedDate) &&
        !guarded.flaggedFailure
      ) {
        session = flagSchedulingFailure(session, "calendar_fetch_failed");
      }

      await sendAgentReplySms(phone, reply, messageSid);
      session = appendMessage(session, "assistant", reply);
      await saveAgentSession(session);
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

    if (offered.length > 0) {
      session.offeredSlots = offered;
    }
    if (slotResolution.pool.length > 0) {
      session.slotPool = slotResolution.pool;
    }

    const guarded = guardAgentReply({
      reply: output.reply,
      session,
      fetchFailed: slotResolution.fetchFailed,
      modelStage: session.stage,
      bookingConfirmed: false,
    });
    if (guarded.flaggedFailure) {
      session = guarded.session;
    }
    if (!shouldPreserveTerminalStage(session)) {
      session.stage = guarded.stage;
    }
    if (
      slotResolution.fetchFailed &&
      (session.stage === "offering_slots" ||
        session.stage === "confirming" ||
        session.requestedDate) &&
      !guarded.flaggedFailure
    ) {
      session = flagSchedulingFailure(session, "calendar_fetch_failed");
    }

    await sendAgentReplySms(phone, guarded.reply, messageSid);
    session = appendMessage(session, "assistant", guarded.reply);
    await saveAgentSession(session);
  } finally {
    await releaseAgentInboundLock(phone, lockToken);
  }
}
