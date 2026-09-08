import { enterBooked } from "~/server/speed2Lead/agent/bookingLinkFollowUps";
import {
  enqueueBookingLinkFollowUp,
  getAgentSession,
  saveAgentSession,
  type AgentSession,
} from "~/server/speed2Lead/agent/state";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { nextValidBookingLinkFollowUp } from "~/server/speed2Lead/agent/bookingLinkFollowUps";
import { processCalendarEvent } from "~/server/appointmentLifecycle/processEvent";
import { getActiveLifecycleForPhone, getLifecycleRecord } from "~/server/appointmentLifecycle/store";
import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import type { NormalizedCalendarEvent } from "~/server/appointmentLifecycle/types";

export type HumanFollowUpAction = "RESUME" | "CLOSE" | "BOOKED";

export type HumanFollowUpResolveResult =
  | { ok: true; action: HumanFollowUpAction; session: AgentSession }
  | { ok: false; error: string; refused?: "BOOKED" };

function clearHumanFollowUpFields(session: AgentSession): AgentSession {
  const next = { ...session };
  delete next.humanFollowUpReason;
  delete next.humanFollowUpAt;
  return next;
}

export async function resolveHumanFollowUp(args: {
  phone: string;
  action: HumanFollowUpAction;
  calendarEventId?: string;
}): Promise<HumanFollowUpResolveResult> {
  const session = await getAgentSession(args.phone);
  if (!session || session.stage !== "handoff") {
    return { ok: false, error: "No human-follow-up session for this phone" };
  }

  if (args.action === "CLOSE") {
    const next = clearHumanFollowUpFields({ ...session, stage: "declined" });
    await saveAgentSession(next);
    logAppointmentEvent("human_follow_up_resolved", { phone: session.phone, action: "CLOSE" });
    return { ok: true, action: "CLOSE", session: next };
  }

  if (args.action === "RESUME") {
    const prior = session.humanFollowUpPriorStage ?? "discovery";
    let next: AgentSession = clearHumanFollowUpFields({ ...session, stage: prior });

    if (prior === "booking_link_pending" && session.bookingLinkSentAt) {
      const restored = nextValidBookingLinkFollowUp({
        bookingLinkSentAt: session.bookingLinkSentAt,
        startStage: session.humanFollowUpPriorFollowUpStage ?? 0,
        profile: getActiveProfile(),
      });
      if (restored) {
        next = {
          ...next,
          bookingLinkFollowUpStage: restored.stage,
          bookingLinkFollowUpNextAt: restored.nextAt,
          bookingLinkFollowUpResolved: false,
        };
        await enqueueBookingLinkFollowUp(next.phone);
        logAppointmentEvent("human_follow_up_campaign_restored", {
          phone: next.phone,
          stage: restored.stage,
        });
      } else {
        next = {
          ...next,
          bookingLinkFollowUpResolved: true,
          bookingLinkFollowUpNextAt: undefined,
        };
      }
    }

    await saveAgentSession(next);
    logAppointmentEvent("human_follow_up_resolved", { phone: session.phone, action: "RESUME" });
    return { ok: true, action: "RESUME", session: next };
  }

  let eventId = args.calendarEventId?.trim();
  if (eventId) {
    const existing = await getLifecycleRecord(eventId);
    if (!existing) {
      return {
        ok: false,
        error: "calendarEventId has no lifecycle record — create/identify the real meeting first",
        refused: "BOOKED",
      };
    }
    if (existing.lifecycleStatus === "unmatched_booking") {
      return {
        ok: false,
        error: "Supply a matched calendar event; unmatched bookings cannot mark the session booked",
        refused: "BOOKED",
      };
    }
  } else {
    const active = await getActiveLifecycleForPhone(session.phone);
    if (!active) {
      logAppointmentEvent("human_follow_up_booked_refused", { phone: session.phone });
      return {
        ok: false,
        error: "No active appointment lifecycle — create/identify the real meeting first",
        refused: "BOOKED",
      };
    }
    eventId = active.calendarEventId;
  }

  const lifecycle = await getLifecycleRecord(eventId);
  if (!lifecycle || lifecycle.lifecycleStatus === "unmatched_booking") {
    logAppointmentEvent("human_follow_up_booked_refused", { phone: session.phone });
    return {
      ok: false,
      error: "No real appointment lifecycle behind this booking",
      refused: "BOOKED",
    };
  }

  let next = clearHumanFollowUpFields(session);
  next = await enterBooked(next);
  if (lifecycle.calendarEventId) {
    next = { ...next, bookedEventId: lifecycle.calendarEventId, bookedStartIso: lifecycle.appointmentStart };
  }
  await saveAgentSession(next);
  logAppointmentEvent("human_follow_up_resolved", { phone: session.phone, action: "BOOKED" });
  return { ok: true, action: "BOOKED", session: next };
}

/** Used by BOOKED when the operator supplies a calendarEventId that still needs processing. */
export async function processOperatorCalendarEvent(event: NormalizedCalendarEvent) {
  return processCalendarEvent(event);
}
