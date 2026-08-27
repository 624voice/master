#!/usr/bin/env bun
import {
  getCronLastRun,
  SPEED2LEAD_FOLLOWUP_CRON_ROUTES,
} from "~/server/speed2Lead/cronHeartbeat";

const runs: Record<string, string | null> = {};
for (const route of SPEED2LEAD_FOLLOWUP_CRON_ROUTES) {
  runs[route] = await getCronLastRun(route);
}

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), runs }, null, 2));
