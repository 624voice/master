import { randomBytes } from "node:crypto";
import { getRedis } from "~/server/speed2Lead/redis";
import { isRedisConfigured } from "~/server/speed2Lead/config";
import { getSiteOrigin } from "~/server/speed2Lead/config";
import type { AssessmentReportTokenData } from "~/server/assessment/types";

export const ASSESSMENT_REPORT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

const ASSESSMENT_REPORT_KEY_PREFIX = "assessment:report:";

function assessmentReportKey(token: string): string {
  return `${ASSESSMENT_REPORT_KEY_PREFIX}${token}`;
}

export async function createAssessmentReportToken(
  data: AssessmentReportTokenData,
): Promise<string> {
  if (!isRedisConfigured()) {
    throw new Error("Redis is not configured for assessment report tokens");
  }

  const token = randomBytes(24).toString("hex");
  const redis = getRedis();
  await redis.set(assessmentReportKey(token), data, {
    ex: ASSESSMENT_REPORT_TOKEN_TTL_SECONDS,
  });
  return token;
}

export function buildAssessmentReportUrl(token: string): string {
  return `${getSiteOrigin()}/assessment-report/${token}`;
}

export async function getAssessmentReportTokenData(
  token: string,
): Promise<AssessmentReportTokenData | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  const redis = getRedis();
  return redis.get<AssessmentReportTokenData>(assessmentReportKey(token));
}
