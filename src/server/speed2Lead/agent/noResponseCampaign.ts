/**
 * No-response follow-up campaign for the rebuilt Speed2Lead agent.
 *
 * After message 1, if the prospect never replies, a five-stage drip runs on
 * calendar-time delays from session.createdAt. Cancelled on any inbound reply,
 * booking, opt-out/STOP, or once the final stage sends — same Redis SET +
 * cron pattern as painPrompt.ts.
 */
import { getActiveProfile, type AgentProfile } from "~/server/speed2Lead/agent/profile";
import {
  appendMessage,
  dequeueNoResponseCampaign,
  enqueueNoResponseCampaign,
  getAgentSession,
  isOptedOut,
  listPendingNoResponsePhones,
  saveAgentSession,
  type AgentSession,
} from "~/server/speed2Lead/agent/state";
import { sendSms } from "~/server/sms/twilio";

export const NO_RESPONSE_STAGE_COUNT = 5;

function hiDashPrefix(firstName?: string): string {
  return firstName ? `Hi ${firstName} — ` : "";
}

function hiDotPrefix(firstName?: string): string {
  return firstName ? `Hi ${firstName}. ` : "";
}

export function noResponseDueAt(
  session: AgentSession,
  profile: AgentProfile,
  stageIndex: number,
): string {
  const delayMinutes = profile.noResponseDelaysMinutes[stageIndex];
  if (delayMinutes == null) {
    throw new Error(`Invalid no-response stage index: ${stageIndex}`);
  }
  return new Date(new Date(session.createdAt).getTime() + delayMinutes * 60 * 1000).toISOString();
}

export function buildNoResponseMessage1(_profile: AgentProfile, session: AgentSession): string {
  return (
    `${hiDashPrefix(session.firstName)}just making sure you saw the ROI report. ` +
    "Anything in there stand out around missed calls, slow follow-up, or lost jobs?"
  );
}

export function buildNoResponseMessage2(_profile: AgentProfile, session: AgentSession): string {
  return (
    `${hiDotPrefix(session.firstName)}Quick thought — even if your team is doing a solid job, ` +
    "it usually only takes a few missed or slow responses each month for the lost revenue to add up. " +
    "Did the report feel pretty accurate for your business?"
  );
}

export function buildNoResponseMessage3(_profile: AgentProfile, _session: AgentSession): string {
  return (
    "Quick question — if you could fix one thing first, would it be missed calls, " +
    "faster lead response, or taking follow-up work off your team?"
  );
}

export function buildNoResponseMessage4(profile: AgentProfile, _session: AgentSession): string {
  return (
    "No pressure if this isn't a priority right now. If I could show you a way to capture " +
    "more of those opportunities without adding more work or headcount, would it be worth " +
    `${profile.meetingLengthMinutes} minutes to take a look?`
  );
}

export function buildNoResponseMessage5(_profile: AgentProfile, _session: AgentSession): string {
  return (
    "I'll close the loop for now so I don't keep chasing you. If missed calls or follow-up " +
    "starts costing you more jobs than you'd like, just text me here and we can pick it back up."
  );
}

const MESSAGE_BUILDERS = [
  buildNoResponseMessage1,
  buildNoResponseMessage2,
  buildNoResponseMessage3,
  buildNoResponseMessage4,
  buildNoResponseMessage5,
] as const;

export function buildNoResponseMessage(
  profile: AgentProfile,
  session: AgentSession,
  stageIndex: number,
): string {
  const builder = MESSAGE_BUILDERS[stageIndex];
  if (!builder) {
    throw new Error(`Invalid no-response stage index: ${stageIndex}`);
  }
  return builder(profile, session);
}

/** Called once alongside schedulePainPrompt when a conversation starts. */
export async function scheduleNoResponseCampaign(
  session: AgentSession,
  profile: AgentProfile = getActiveProfile(),
): Promise<AgentSession> {
  await enqueueNoResponseCampaign(session.phone);
  return {
    ...session,
    noResponseStage: 0,
    noResponseNextAt: noResponseDueAt(session, profile, 0),
    noResponseResolved: false,
  };
}

/** Cancel remaining stages on any inbound reply, booking, or opt-out. */
export async function cancelPendingNoResponseCampaign(
  session: AgentSession,
): Promise<AgentSession> {
  if (session.noResponseResolved) {
    return session;
  }
  await dequeueNoResponseCampaign(session.phone);
  return {
    ...session,
    noResponseNextAt: undefined,
    noResponseResolved: true,
  };
}

function shouldSkipNoResponse(session: AgentSession): boolean {
  return session.stage === "booked" || session.stage === "declined";
}

/** Cron entrypoint: send the next due stage for each pending phone. */
export async function processPendingNoResponseCampaign(now = new Date()): Promise<number> {
  const profile = getActiveProfile();
  const phones = await listPendingNoResponsePhones();
  let sent = 0;

  for (const phone of phones) {
    const session = await getAgentSession(phone);
    if (!session || session.noResponseResolved) {
      await dequeueNoResponseCampaign(phone);
      continue;
    }
    if (await isOptedOut(phone) || shouldSkipNoResponse(session)) {
      await dequeueNoResponseCampaign(phone);
      continue;
    }

    const stageIndex = session.noResponseStage ?? 0;
    if (stageIndex >= NO_RESPONSE_STAGE_COUNT) {
      await dequeueNoResponseCampaign(phone);
      continue;
    }

    if (!session.noResponseNextAt || new Date(session.noResponseNextAt).getTime() > now.getTime()) {
      continue;
    }

    const message = buildNoResponseMessage(profile, session, stageIndex);
    await sendSms(phone, message);
    let updated = appendMessage(session, "assistant", message);

    const nextStage = stageIndex + 1;
    if (nextStage >= NO_RESPONSE_STAGE_COUNT) {
      updated = {
        ...updated,
        noResponseStage: nextStage,
        noResponseNextAt: undefined,
        noResponseResolved: true,
      };
      await saveAgentSession(updated);
      await dequeueNoResponseCampaign(phone);
    } else {
      updated = {
        ...updated,
        noResponseStage: nextStage,
        noResponseNextAt: noResponseDueAt(session, profile, nextStage),
        noResponseResolved: false,
      };
      await saveAgentSession(updated);
    }

    sent += 1;
  }

  return sent;
}
