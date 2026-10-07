/**
 * Server-only Phase 2 owner QA execution boundary.
 * Never derived from query params, cookies, headers, or request bodies.
 */

const SERVER_BOUNDARY_ENV_KEYS = [
  "PHASE2_OWNER_QA_PREVIEW",
  "PHASE2_SAFE_PREVIEW",
  "PHASE2_OWNER_QA_REPORT_FAIL_ONCE",
  "PHASE2_SAFE_QA_HARNESS",
] as const;

export function isNetlifyDeployPreviewContext(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const context = env.CONTEXT ?? env.NETLIFY_CONTEXT ?? "";
  return context === "deploy-preview";
}

/** Hosted (Netlify) owner keyboard QA — requires explicit server env + deploy-preview context. */
export function isPhase2HostedOwnerQaPreviewBoundary(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.PHASE2_OWNER_QA_PREVIEW === "1" && isNetlifyDeployPreviewContext(env)
  );
}

/** @deprecated Use isPhase2HostedOwnerQaPreviewBoundary */
export function isPhase2VercelOwnerQaBoundary(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isPhase2HostedOwnerQaPreviewBoundary(env);
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
  if (isPhase2HostedOwnerQaPreviewBoundary(env)) return true;
  if (isPhase2LocalSafePreviewBoundary(env)) return true;
  return false;
}

export function isOwnerQaReportFailOnceEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.PHASE2_OWNER_QA_REPORT_FAIL_ONCE !== "1") return false;
  if (isPhase2LocalSafePreviewBoundary(env)) return true;
  if (isPhase2HostedOwnerQaPreviewBoundary(env)) return true;
  return false;
}

export function listServerBoundaryEnvKeyNames(): readonly string[] {
  return SERVER_BOUNDARY_ENV_KEYS;
}
