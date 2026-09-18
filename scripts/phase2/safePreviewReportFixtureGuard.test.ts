/**
 * Proves owner-QA report fail-once fixture requires safe-preview boundary.
 */
import { describe, expect, test } from "bun:test";
import {
  isOwnerQaReportFailOnceEnabled,
  shouldFailReportDownload,
  REPORT_FAIL_ONCE_GUARD_SOURCE,
} from "./safePreviewReportFixture";

describe("report fail-once fixture production guard", () => {
  test("X-SAFE-PREVIEW-38: fail-once flag alone without PHASE2_SAFE_PREVIEW does not activate fixture", () => {
    expect(
      isOwnerQaReportFailOnceEnabled({
        PHASE2_OWNER_QA_REPORT_FAIL_ONCE: "1",
        PHASE2_SAFE_PREVIEW: undefined,
      }),
    ).toBe(false);
    expect(
      shouldFailReportDownload("/assessment-report/token", "token", 1, {
        PHASE2_OWNER_QA_REPORT_FAIL_ONCE: "1",
      }),
    ).toBe(false);
  });

  test("X-SAFE-PREVIEW-39: visitor-controlled inputs are not read by fixture guard", () => {
    const env = {
      PHASE2_SAFE_PREVIEW: "1",
      PHASE2_OWNER_QA_REPORT_FAIL_ONCE: "0",
      QUERY_PHASE2_OWNER_QA_REPORT_FAIL_ONCE: "1",
      COOKIE_PHASE2_OWNER_QA_REPORT_FAIL_ONCE: "1",
    };
    expect(isOwnerQaReportFailOnceEnabled(env)).toBe(false);
    expect(
      shouldFailReportDownload(
        "/assessment-report/token?phase2_owner_qa_report_fail_once=1&failOnce=1",
        "token",
        1,
        env,
      ),
    ).toBe(false);
  });

  test("X-SAFE-PREVIEW-40: both safe-preview and fail-once flags activate first-request 503 only", () => {
    const env = {
      PHASE2_SAFE_PREVIEW: "1",
      PHASE2_OWNER_QA_REPORT_FAIL_ONCE: "1",
    };
    expect(isOwnerQaReportFailOnceEnabled(env)).toBe(true);
    expect(shouldFailReportDownload("/assessment-report/probe", "probe", 1, env)).toBe(true);
    expect(shouldFailReportDownload("/assessment-report/probe", "probe", 2, env)).toBe(false);
    expect(REPORT_FAIL_ONCE_GUARD_SOURCE).toContain("IS_SAFE_PREVIEW");
    expect(REPORT_FAIL_ONCE_GUARD_SOURCE).toContain("PHASE2_OWNER_QA_REPORT_FAIL_ONCE");
  });
});
