/**
 * Owner-QA report fail-once fixture guard (shared with production server module).
 */
export {
  isOwnerQaReportFailOnceEnabled,
} from "../../src/server/phase2OwnerQaBoundary.ts";

import { isOwnerQaReportFailOnceEnabled } from "../../src/server/phase2OwnerQaBoundary.ts";

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

export const REPORT_FAIL_ONCE_GUARD_SOURCE = `isOwnerQaReportFailOnceEnabled() — PHASE2_OWNER_QA_REPORT_FAIL_ONCE plus local safe preview or Vercel owner QA boundary`;
