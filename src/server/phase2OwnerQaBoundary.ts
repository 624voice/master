/**
 * Server-only Phase 2 owner QA execution boundary.
 * Never derived from query params, cookies, headers, or request bodies.
 */

const SERVER_BOUNDARY_ENV_KEYS = [
  "PHASE2_VERCEL_OWNER_QA",
  "PHASE2_SAFE_PREVIEW",
  "PHASE2_OWNER_QA_REPORT_FAIL_ONCE",
  "PHASE2_SAFE_QA_HARNESS",
] as const;

export function isVercelPreviewEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.VERCEL_ENV === "preview";
}

/** Vercel Preview owner keyboard QA — requires explicit server env + preview deployment. */
export function isPhase2VercelOwnerQaBoundary(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.PHASE2_VERCEL_OWNER_QA === "1" && isVercelPreviewEnvironment(env);
}

/** Local Docker / loopback safe preview (unchanged boundary). */
export function isPhase2LocalSafePreviewBoundary(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.PHASE2_SAFE_PREVIEW === "1";
}

/** Active when approved in-memory adapters and preview-only behavior may run. */
export function isPhase2OwnerQaExecutionActive(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.VERCEL_ENV === "production") return false;
  if (isPhase2VercelOwnerQaBoundary(env)) return true;
  if (isPhase2LocalSafePreviewBoundary(env)) return true;
  return false;
}

export function isOwnerQaReportFailOnceEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.PHASE2_OWNER_QA_REPORT_FAIL_ONCE !== "1") return false;
  if (isPhase2LocalSafePreviewBoundary(env)) return true;
  if (isPhase2VercelOwnerQaBoundary(env)) return true;
  return false;
}

export function listServerBoundaryEnvKeyNames(): readonly string[] {
  return SERVER_BOUNDARY_ENV_KEYS;
}
