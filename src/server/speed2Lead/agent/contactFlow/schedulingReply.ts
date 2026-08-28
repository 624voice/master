import type { AgentProfile } from "~/server/speed2Lead/agent/profile";
import type { AgentSession, OfferedSlot } from "~/server/speed2Lead/agent/state";
import {
  buildNeedDateCopy,
  buildNoAvailabilityCopy,
  buildSlotOfferCopy,
} from "~/server/speed2Lead/agent/scheduling/copy";
import type { OfferPresentationType } from "~/server/speed2Lead/agent/scheduling/types";
import { isSchedulingPreferenceOnly } from "~/server/speed2Lead/agent/slotPreferences";

function presentationForTurn(session: AgentSession, offeredCount: number): OfferPresentationType {
  if (offeredCount === 0) return "first_offer";
  const hadPriorOffer = (session.offeredSlots?.length ?? 0) > 0;
  return hadPriorOffer ? "changed_offer" : "first_offer";
}

/** Code-owned SMS when contact-flow scheduling prefs should drive the reply. */
export function buildContactSchedulingTurnReply(args: {
  session: AgentSession;
  inboundBody: string;
  offered: OfferedSlot[];
  fetchFailed: boolean;
  profile: AgentProfile;
  now?: Date;
}): string | null {
  const now = args.now ?? new Date();
  const inScheduling =
    args.session.stage === "offering_slots" ||
    args.session.stage === "confirming" ||
    (args.session.discoveryClosed &&
      (args.session.stage === "bridge" || args.session.stage === "offering_slots"));

  if (!inScheduling) return null;

  const prefOnly = isSchedulingPreferenceOnly(args.inboundBody, args.session, now);
  if (!prefOnly) {
    return null;
  }

  if (args.fetchFailed) {
    return "I'm having trouble pulling my calendar up right now — I still have your timing noted.";
  }

  if (args.offered.length > 0) {
    const isos = args.offered.map((slot) => slot.startIso);
    return buildSlotOfferCopy(isos, presentationForTurn(args.session, isos.length));
  }

  if (args.session.requestedDate) {
    return buildNoAvailabilityCopy(true);
  }

  return buildNeedDateCopy();
}
