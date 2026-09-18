/**
 * Owner-QA report fail-once fixture guard.
 * Requires BOTH safe-preview boundary AND explicit fail-once flag.
 * Never activated by visitor-controlled inputs.
 */
export function isOwnerQaReportFailOnceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PHASE2_SAFE_PREVIEW === "1" && env.PHASE2_OWNER_QA_REPORT_FAIL_ONCE === "1";
}

export function shouldFailReportDownload(
  pathname: string,
  token: string,
  attempt: number,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isOwnerQaReportFailOnceEnabled(env)) return false;
  if (!pathname.startsWith("/assessment-report/")) return false;
  return attempt === 1;
}

export const REPORT_FAIL_ONCE_GUARD_SOURCE = `IS_SAFE_PREVIEW && PHASE2_OWNER_QA_REPORT_FAIL_ONCE === "1"`;
