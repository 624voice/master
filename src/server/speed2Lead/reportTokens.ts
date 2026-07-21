import { randomBytes } from "node:crypto";
import { getSiteOrigin, REPORT_TOKEN_TTL_SECONDS } from "~/server/speed2Lead/config";
import type { ReportTokenData } from "~/server/speed2Lead/types";
import { getRedis } from "~/server/speed2Lead/redis";

function reportKey(token: string): string {
  return `speed2lead:report:${token}`;
}

export async function createReportToken(data: ReportTokenData): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const redis = getRedis();
  await redis.set(reportKey(token), data, { ex: REPORT_TOKEN_TTL_SECONDS });
  return token;
}

export function buildReportUrl(token: string): string {
  return `${getSiteOrigin()}/report/${token}`;
}

export async function getReportTokenData(
  token: string,
): Promise<ReportTokenData | null> {
  const redis = getRedis();
  return redis.get<ReportTokenData>(reportKey(token));
}
