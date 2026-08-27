import {
  buildDeclineDiagnosisQuestion,
  buildSkepticismDeclineResponse,
  buildTimingDeclineExit,
} from "~/server/speed2Lead/agent/contactFlow/openers";
import { classifyDeclineReasonReply } from "~/server/speed2Lead/agent/contactFlow/intentDetect";
import { isMeetingDecline, isMeetingDeclineStage } from "~/server/speed2Lead/agent/turnGuards";
import type { AgentSession } from "~/server/speed2Lead/agent/state";

export type ContactDeclineAction =
  | { type: "none" }
  | { type: "send"; reply: string; sessionPatch: Partial<AgentSession> }
  | { type: "terminal"; reply: string; sessionPatch: Partial<AgentSession> };

export function resolveContactDeclineAction(
  session: AgentSession,
  body: string,
): ContactDeclineAction {
  if (session.flow !== "contact") {
    return { type: "none" };
  }

  if (session.declineAwaitingReason) {
    const reason = classifyDeclineReasonReply(body);
    if (reason === "timing") {
      return {
        type: "terminal",
        reply: buildTimingDeclineExit(),
        sessionPatch: {
          declineReason: "timing",
          declineAwaitingReason: false,
          stage: "declined",
        },
      };
    }
    if (reason === "skepticism") {
      return {
        type: "send",
        reply: buildSkepticismDeclineResponse(session.businessName),
        sessionPatch: {
          declineReason: "skepticism",
          declineAwaitingReason: false,
          meetingDeclineCount: 1,
        },
      };
    }
    return {
      type: "terminal",
      reply: buildTimingDeclineExit(),
      sessionPatch: {
        declineReason: "timing",
        declineAwaitingReason: false,
        stage: "declined",
      },
    };
  }

  const declineThisTurn = isMeetingDecline(body) && isMeetingDeclineStage(session.stage);
  if (!declineThisTurn) {
    return { type: "none" };
  }

  const nextCount = (session.meetingDeclineCount ?? 0) + 1;

  if (nextCount >= 2 || (session.declineReason === "skepticism" && nextCount >= 1)) {
    return {
      type: "terminal",
      reply: buildTimingDeclineExit(),
      sessionPatch: {
        meetingDeclineCount: nextCount,
        stage: "declined",
      },
    };
  }

  if (!session.declineDiagnosisSent) {
    return {
      type: "send",
      reply: buildDeclineDiagnosisQuestion(),
      sessionPatch: {
        meetingDeclineCount: nextCount,
        declineDiagnosisSent: true,
        declineAwaitingReason: true,
      },
    };
  }

  return {
    type: "terminal",
    reply: buildTimingDeclineExit(),
    sessionPatch: {
      meetingDeclineCount: nextCount,
      stage: "declined",
    },
  };
}
