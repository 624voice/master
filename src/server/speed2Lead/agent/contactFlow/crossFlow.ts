import { getAgentSession } from "~/server/speed2Lead/agent/state";
import type { AgentFlow } from "~/server/speed2Lead/agent/state";
import { getSession } from "~/server/speed2Lead/session";
import type { AnyConversationContext } from "~/server/speed2Lead/types";
import { normalizePhone } from "~/server/sms/phone";

function isTerminalLegacySession(context: AnyConversationContext): boolean {
  if ("state" in context && context.state === "completed") return true;
  if (context.disposition === "declined" || context.disposition === "booked") return true;
  if (context.scheduling?.status === "confirmed") return true;
  return false;
}

/** True when an active conversation already exists on this phone (any flow). */
export async function shouldSkipAgentOpener(
  phone: string,
  _startingFlow: AgentFlow,
): Promise<{ skip: boolean; reason?: string }> {
  const normalized = normalizePhone(phone);
  const agent = await getAgentSession(normalized);
  if (agent) {
    return { skip: true, reason: `agent_session:${agent.flow}` };
  }

  const legacy = await getSession(normalized);
  if (legacy && !isTerminalLegacySession(legacy)) {
    return { skip: true, reason: `legacy_session:${legacy.flow ?? "roi"}` };
  }

  return { skip: false };
}
