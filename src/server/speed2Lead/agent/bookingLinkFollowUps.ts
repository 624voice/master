/**
 * Booking-link follow-up campaign. Offsets are absolute from bookingLinkSentAt,
 * never sequential deltas. Same Redis-SET pattern as noResponseCampaign.ts.
 */
import { getActiveProfile, type AgentProfile } from "~/server/speed2Lead/agent/profile";
import {
  appendMessage,
  dequeueBookingLinkFollowUp,
  enqueueBookingLinkFollowUp,
  getAgentSession,
  isOptedOut,
  listPendingBookingLinkFollowUpPhones,
  saveAgentSession,
  type AgentSession,
} from "~/server/speed2Lead/agent/state";
import { cancelPendingNoResponseCampaign } from "~/server/speed2Lead/agent/noResponseCampaign";
import { cancelPendingPainPrompt } from "~/server/speed2Lead/agent/painPrompt";
import { bookingLinkFollowUpCopy, bookingLinkUrl } from "~/server/speed2Lead/agent/bookingLinkCopy";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import {
  outboundWasAccepted,
  releaseCronOverlapLock,
  sendSmsWithState,
  sendStateKeys,
  tryAcquireCronOverlapLock,
} from "~/server/sms/sendState";

export const BOOKING_LINK_FOLLOWUP_STAGE_COUNT = 3;

export function computeFollowUpTimes(
  bookingLinkSentAt: string,
  offsetsMinutes: [number, number, number],
): [string, string, string] {
  const anchor = new Date(bookingLinkSentAt).getTime();
  return offsetsMinutes.map((mins) => new Date(anchor + mins * 60 * 1000).toISOString()) as [
    string,
    string,
    string,
  ];
}

export function bookingLinkFollowUpDueAt(
  bookingLinkSentAt: string,
  profile: AgentProfile,
  stageIndex: number,
): string {
  const offset = profile.bookingFollowUpOffsetsMinutes[stageIndex];
  if (offset == null) {
    throw new Error(`Invalid booking-link follow-up stage index: ${stageIndex}`);
  }
  return new Date(new Date(bookingLinkSentAt).getTime() + offset * 60 * 1000).toISOString();
}

export async function scheduleBookingLinkFollowUps(
  session: AgentSession,
  profile: AgentProfile = getActiveProfile(),
): Promise<AgentSession> {
  if (!session.bookingLinkSentAt) {
    return session;
  }
  await enqueueBookingLinkFollowUp(session.phone);
  return {
    ...session,
    bookingLinkFollowUpStage: 0,
    bookingLinkFollowUpNextAt: bookingLinkFollowUpDueAt(session.bookingLinkSentAt, profile, 0),
    bookingLinkFollowUpResolved: false,
  };
}

export async function cancelBookingLinkFollowUps(session: AgentSession): Promise<AgentSession> {
  if (session.bookingLinkFollowUpResolved) {
    return session;
  }
  await dequeueBookingLinkFollowUp(session.phone);
  logAppointmentEvent("booking_link_campaign_cancelled", { phone: session.phone });
  return {
    ...session,
    bookingLinkFollowUpNextAt: undefined,
    bookingLinkFollowUpResolved: true,
  };
}

export async function enterBookingLinkPending(session: AgentSession): Promise<AgentSession> {
  let updated = await cancelPendingNoResponseCampaign(session);
  updated = await cancelPendingPainPrompt(updated);
  return scheduleBookingLinkFollowUps(updated);
}

export async function enterBooked(session: AgentSession): Promise<AgentSession> {
  let updated = await cancelBookingLinkFollowUps(session);
  updated = await cancelPendingNoResponseCampaign(updated);
  return { ...updated, stage: "booked" };
}

export function nextValidBookingLinkFollowUp(args: {
  bookingLinkSentAt: string;
  startStage: number;
  profile: AgentProfile;
  now?: Date;
}): { stage: number; nextAt: string } | null {
  const nowMs = (args.now ?? new Date()).getTime();
  const start = Math.max(0, args.startStage);
  for (let stage = start; stage < BOOKING_LINK_FOLLOWUP_STAGE_COUNT; stage += 1) {
    const nextAt = bookingLinkFollowUpDueAt(args.bookingLinkSentAt, args.profile, stage);
    if (new Date(nextAt).getTime() > nowMs) {
      return { stage, nextAt };
    }
  }
  return null;
}

export async function processPendingBookingLinkFollowUps(now = new Date()): Promise<number> {
  // Defense-in-depth / operational-efficiency only — not the correctness
  // boundary. The per-touch send-state record (session.createdAt + stageIndex)
  // prevents duplicate customer-visible follow-up SMS if this 5-minute worker overlaps.
  const overlap = await tryAcquireCronOverlapLock("booking-link-followups");
  if (!overlap) {
    return 0;
  }

  try {
  const profile = getActiveProfile();
  const phones = await listPendingBookingLinkFollowUpPhones();
  let sent = 0;

  for (const phone of phones) {
    const session = await getAgentSession(phone);
    if (!session || session.bookingLinkFollowUpResolved || session.stage !== "booking_link_pending") {
      await dequeueBookingLinkFollowUp(phone);
      continue;
    }
    if (await isOptedOut(phone)) {
      await dequeueBookingLinkFollowUp(phone);
      continue;
    }
    if (!session.bookingLinkSentAt) {
      await dequeueBookingLinkFollowUp(phone);
      continue;
    }

    const stageIndex = session.bookingLinkFollowUpStage ?? 0;
    if (stageIndex >= BOOKING_LINK_FOLLOWUP_STAGE_COUNT) {
      await dequeueBookingLinkFollowUp(phone);
      continue;
    }
    if (!session.bookingLinkFollowUpNextAt || new Date(session.bookingLinkFollowUpNextAt).getTime() > now.getTime()) {
      continue;
    }

    const link = bookingLinkUrl();
    const message = bookingLinkFollowUpCopy(session.flow, stageIndex, session.firstName, link);
    const sendResult = await sendSmsWithState({
      key: sendStateKeys.bookingLinkFollowUp(phone, session.createdAt, stageIndex),
      to: phone,
      body: message,
    });
    if (!outboundWasAccepted(sendResult)) {
      continue;
    }
    let updated = sendResult.outcome === "sent" ? appendMessage(session, "assistant", message) : session;
    updated = {
      ...updated,
      bookingLinkLastSentAt: stageIndex < 2 ? new Date().toISOString() : updated.bookingLinkLastSentAt,
    };

    const nextStage = stageIndex + 1;
    if (nextStage >= BOOKING_LINK_FOLLOWUP_STAGE_COUNT) {
      updated = {
        ...updated,
        bookingLinkFollowUpStage: nextStage,
        bookingLinkFollowUpNextAt: undefined,
        bookingLinkFollowUpResolved: true,
      };
      await saveAgentSession(updated);
      await dequeueBookingLinkFollowUp(phone);
    } else {
      updated = {
        ...updated,
        bookingLinkFollowUpStage: nextStage,
        bookingLinkFollowUpNextAt: bookingLinkFollowUpDueAt(session.bookingLinkSentAt, profile, nextStage),
        bookingLinkFollowUpResolved: false,
      };
      await saveAgentSession(updated);
    }

    if (sendResult.outcome === "sent") {
      logAppointmentEvent("booking_link_followup_sent", {
        phone,
        stage: stageIndex,
      });
    }
    sent += 1;
  }

  return sent;
  } finally {
    await releaseCronOverlapLock("booking-link-followups", overlap);
  }
}
