import { Redis } from "@upstash/redis";
import { isPhase2OwnerQaExecutionActive } from "~/server/phase2OwnerQaBoundary";
import { getPhase2OwnerQaInMemoryRedis } from "~/server/phase2OwnerQaInMemoryStore";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (isPhase2OwnerQaExecutionActive()) {
    void import("~/server/phase2OwnerQaAdapterAudit").then(({ recordQaAdapterUse }) => {
      recordQaAdapterUse("qaTokenReportStoreUses");
    });
    return getPhase2OwnerQaInMemoryRedis() as unknown as Redis;
  }
  void import("~/server/phase2OwnerQaAdapterAudit").then(({ recordLiveProviderAttempt }) => {
    recordLiveProviderAttempt("liveProductionUpstashAttempts");
  });
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error("Upstash Redis is not configured");
    }

    redis = new Redis({ url, token });
  }

  return redis;
}
