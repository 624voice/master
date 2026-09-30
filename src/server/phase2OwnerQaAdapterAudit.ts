/**
 * Non-secret adapter selection / outbound attempt counters for owner-QA smoke attestation.
 * Never logs secrets, tokens, or PII.
 */
import {
  phase2OwnerQaBlobGet,
  phase2OwnerQaBlobSet,
} from "~/server/phase2OwnerQaNetlifyBlobStore";
import { isPhase2HostedOwnerQaPreviewBoundary } from "~/server/phase2OwnerQaBoundary";

const BLOB_KEY = "owner-qa:adapter-audit:v1";

export type Phase2OwnerQaAdapterAuditSnapshot = {
  liveTwilioSmsAttempts: number;
  liveSendgridEmailAttempts: number;
  liveProductionUpstashAttempts: number;
  liveCrmWebhookAttempts: number;
  liveGoogleApiAttempts: number;
  liveExternalAnalyticsAttempts: number;
  liveOpenAiAgentAttempts: number;
  liveVapiAttempts: number;
  liveProductionDatabaseAttempts: number;
  liveProductionReportStorageAttempts: number;
  qaLeadAdapterUses: number;
  qaTokenReportStoreUses: number;
  qaReportFixtureUses: number;
};

const EMPTY: Phase2OwnerQaAdapterAuditSnapshot = {
  liveTwilioSmsAttempts: 0,
  liveSendgridEmailAttempts: 0,
  liveProductionUpstashAttempts: 0,
  liveCrmWebhookAttempts: 0,
  liveGoogleApiAttempts: 0,
  liveExternalAnalyticsAttempts: 0,
  liveOpenAiAgentAttempts: 0,
  liveVapiAttempts: 0,
  liveProductionDatabaseAttempts: 0,
  liveProductionReportStorageAttempts: 0,
  qaLeadAdapterUses: 0,
  qaTokenReportStoreUses: 0,
  qaReportFixtureUses: 0,
};

let localCounters: Phase2OwnerQaAdapterAuditSnapshot = { ...EMPTY };

function mergeCounters(
  a: Phase2OwnerQaAdapterAuditSnapshot,
  b: Phase2OwnerQaAdapterAuditSnapshot,
): Phase2OwnerQaAdapterAuditSnapshot {
  const keys = Object.keys(EMPTY) as (keyof Phase2OwnerQaAdapterAuditSnapshot)[];
  const out = { ...EMPTY };
  for (const key of keys) {
    out[key] = a[key] + b[key];
  }
  return out;
}

async function persistLocalToBlob(): Promise<void> {
  if (!isPhase2HostedOwnerQaPreviewBoundary()) return;
  await phase2OwnerQaBlobSet(BLOB_KEY, localCounters);
}

async function hydrateFromBlob(): Promise<void> {
  if (!isPhase2HostedOwnerQaPreviewBoundary()) return;
  const fromBlob = await phase2OwnerQaBlobGet<Phase2OwnerQaAdapterAuditSnapshot>(BLOB_KEY);
  if (fromBlob) {
    localCounters = mergeCounters(localCounters, fromBlob);
  }
}

export function resetPhase2OwnerQaAdapterAuditForTests(): void {
  localCounters = { ...EMPTY };
}

type LiveProvider =
  | "liveTwilioSmsAttempts"
  | "liveSendgridEmailAttempts"
  | "liveProductionUpstashAttempts"
  | "liveCrmWebhookAttempts"
  | "liveGoogleApiAttempts"
  | "liveExternalAnalyticsAttempts"
  | "liveOpenAiAgentAttempts"
  | "liveVapiAttempts"
  | "liveProductionDatabaseAttempts"
  | "liveProductionReportStorageAttempts";

type QaAdapter = "qaLeadAdapterUses" | "qaTokenReportStoreUses" | "qaReportFixtureUses";

export function recordLiveProviderAttempt(field: LiveProvider): void {
  localCounters[field] += 1;
  void persistLocalToBlob();
}

export function recordQaAdapterUse(field: QaAdapter): void {
  localCounters[field] += 1;
  void persistLocalToBlob();
}

export async function getPhase2OwnerQaAdapterAuditSnapshot(): Promise<Phase2OwnerQaAdapterAuditSnapshot> {
  await hydrateFromBlob();
  return { ...localCounters };
}
