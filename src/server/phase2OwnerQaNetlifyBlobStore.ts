import { getStore } from "@netlify/blobs";
import { isPhase2HostedOwnerQaPreviewBoundary } from "~/server/phase2OwnerQaBoundary";

const STORE_NAME = "phase2-owner-qa-kv";

/** Cross-instance KV for hosted Netlify owner-QA preview only (never production boundary). */
export function isPhase2OwnerQaBlobPersistenceEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isPhase2HostedOwnerQaPreviewBoundary(env) && env.NETLIFY === "true";
}

function blobStore() {
  return getStore(STORE_NAME);
}

export async function phase2OwnerQaBlobGet<T>(
  key: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<T | null> {
  if (!isPhase2OwnerQaBlobPersistenceEnabled(env)) return null;
  try {
    const value = await blobStore().get(key, { type: "json" });
    return (value as T | null) ?? null;
  } catch {
    return null;
  }
}

export async function phase2OwnerQaBlobSet(
  key: string,
  value: unknown,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (!isPhase2OwnerQaBlobPersistenceEnabled(env)) return;
  try {
    await blobStore().setJSON(key, value);
  } catch {
    /* best-effort; in-memory copy may still serve warm instance */
  }
}

const REPORT_DL_PREFIX = "owner-qa:report-dl:";

export async function incrementOwnerQaReportDownloadAttempt(
  token: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const key = `${REPORT_DL_PREFIX}${token}`;
  const prior = (await phase2OwnerQaBlobGet<number>(key, env)) ?? 0;
  const attempt = prior + 1;
  await phase2OwnerQaBlobSet(key, attempt, env);
  return attempt;
}
