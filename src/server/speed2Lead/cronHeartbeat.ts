import { getRedis } from "~/server/speed2Lead/redis";

const CRON_LAST_RUN_PREFIX = "speed2lead:cron:last-run:";

/** Record a successful authorized cron invocation for production schedule verification. */
export async function recordCronRun(routeId: string, now = new Date()): Promise<void> {
  await getRedis().set(`${CRON_LAST_RUN_PREFIX}${routeId}`, now.toISOString(), {
    ex: 60 * 60 * 24 * 7,
  });
}

export async function getCronLastRun(routeId: string): Promise<string | null> {
  return getRedis().get<string>(`${CRON_LAST_RUN_PREFIX}${routeId}`);
}

export const SPEED2LEAD_FOLLOWUP_CRON_ROUTES = [
  "demo-followups",
  "nurture-followups",
  "agent-pain-prompts",
  "agent-no-response-followups",
] as const;
