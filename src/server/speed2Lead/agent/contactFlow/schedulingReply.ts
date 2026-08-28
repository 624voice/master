import type { AgentProfile } from "~/server/speed2Lead/agent/profile";
import type { AgentSession, OfferedSlot } from "~/server/speed2Lead/agent/state";
import { buildDiscoverySchedulingTurnReply } from "~/server/speed2Lead/agent/scheduling/replyGuard";

/** @deprecated Use buildDiscoverySchedulingTurnReply from scheduling/replyGuard — kept for imports. */
export function buildContactSchedulingTurnReply(args: {
  session: AgentSession;
  inboundBody: string;
  offered: OfferedSlot[];
  fetchFailed: boolean;
  profile: AgentProfile;
  now?: Date;
  llmReply?: string;
}): string | null {
  return buildDiscoverySchedulingTurnReply({
    ...args,
    llmReply: args.llmReply ?? "",
  });
}
