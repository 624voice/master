#!/usr/bin/env bun
/**
 * Operator resolution for HUMAN_FOLLOW_UP sessions.
 * Usage:
 *   bun run scripts/s2l-human-follow-up.ts --phone +1555... --action RESUME|CLOSE|BOOKED [--event evt-id]
 */
import { resolveHumanFollowUp, type HumanFollowUpAction } from "~/server/speed2Lead/agent/humanFollowUpResolve";
import { normalizePhone } from "~/server/sms/phone";

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const phone = flag("--phone");
const action = flag("--action")?.toUpperCase() as HumanFollowUpAction | undefined;
const calendarEventId = flag("--event");

if (!phone || !action || !["RESUME", "CLOSE", "BOOKED"].includes(action)) {
  console.error("Usage: bun run scripts/s2l-human-follow-up.ts --phone +1... --action RESUME|CLOSE|BOOKED [--event calendarEventId]");
  process.exit(1);
}

const result = await resolveHumanFollowUp({
  phone: normalizePhone(phone),
  action,
  calendarEventId,
});
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
