import { useState } from "react";
import { BOOK_MEETING_PATH } from "~/config/features";
import { Button } from "~/components/ui/Button";
import type { RunAssessmentResult } from "~/lib/assessment/runAssessment";
import { formatCurrency } from "~/lib/roi/formatCurrency";
import { selectModerateScenarioValue } from "~/lib/assessment/selectModerateScenario";

const DISCLAIMER =
  "This Assessment is directional and based on the information you provided. It is a starting point, not a full operational diagnosis. A paid AI Revenue and Operations Diagnostic is used only when a deeper review is warranted.";

const REPORT_UNAVAILABLE_MESSAGE =
  "Report temporarily unavailable. Please try again in a moment.";

type AssessmentResultsProps = {
  results: RunAssessmentResult;
  reportUrl?: string;
  onReportDownload?: () => void;
};

function bandBadgeClass(band: string | undefined): string {
  switch (band) {
    case "High":
      return "bg-red-50 text-red-700";
    case "Moderate":
      return "bg-amber-50 text-amber-800";
    default:
      return "bg-emerald-50 text-emerald-700";
  }
}

export function AssessmentResults({
  results,
  reportUrl,
  onReportDownload,
}: AssessmentResultsProps) {
  const moderateValue =
    results.dollarEstimate &&
    selectModerateScenarioValue(results.dollarEstimate);

  const [reportError, setReportError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleReportDownload() {
    if (!reportUrl || isDownloading) return;
    onReportDownload?.();
    setIsDownloading(true);
    setReportError(null);
    try {
      const response = await fetch(reportUrl);
      if (!response.ok) {
        const body = (await response.text()).trim();
        setReportError(body || REPORT_UNAVAILABLE_MESSAGE);
        return;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("pdf")) {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        return;
      }
      window.open(reportUrl, "_blank", "noopener,noreferrer");
    } catch {
      setReportError(REPORT_UNAVAILABLE_MESSAGE);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="space-y-8">
      {moderateValue != null && (
        <div className="rounded-xl border border-brand-primary/30 bg-emerald-50/60 p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent">
            Estimated annual opportunity
          </p>
          <p className="mt-3 text-4xl font-extrabold tracking-tight text-brand-secondary sm:text-5xl">
            Up to{" "}
            <span className="text-brand-primary">
              {formatCurrency(moderateValue)}
            </span>
          </p>
          <p className="mt-2 text-sm text-gray-600">{results.combinedLabel}</p>
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-brand-secondary">
          Your priority areas
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Ranked by severity, confidence, and readiness to improve.
        </p>

        <ol className="mt-6 space-y-4">
          {results.priorityGroups.map((group, groupIndex) => (
            <li
              key={group.map((d) => d.key).join("-")}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-brand-accent">
                  Priority {groupIndex + 1}
                </span>
                {group.length > 1 && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    Tied
                  </span>
                )}
              </div>
              <ul className="mt-3 space-y-3">
                {group.map((dimension) => (
                  <li
                    key={dimension.key}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="font-semibold text-brand-secondary">
                      {dimension.label}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {dimension.band && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${bandBadgeClass(dimension.band)}`}
                        >
                          {dimension.band}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {dimension.confidence} confidence
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>

      {results.clarifyGroup.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
          <h3 className="text-lg font-semibold text-brand-secondary">
            Worth Clarifying
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            These areas need a bit more detail before we can score them
            confidently.
          </p>
          <ul className="mt-4 space-y-2">
            {results.clarifyGroup.map((dimension) => (
              <li
                key={dimension.key}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium text-brand-secondary">
                  {dimension.label}
                </span>
                <span className="text-xs text-amber-800">Needs clarification</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs leading-relaxed text-gray-500">{DISCLAIMER}</p>

      {reportError && (
        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p>{reportError}</p>
          {reportUrl && (
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              aria-label="Try downloading assessment report again"
              disabled={isDownloading}
              onClick={() => void handleReportDownload()}
            >
              Try downloading report again
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <a href={BOOK_MEETING_PATH}>
          <Button type="button">Book a Meeting</Button>
        </a>
        {reportUrl && (
          <Button
            type="button"
            variant="secondary"
            data-testid="assessment-report-download"
            data-report-url={reportUrl}
            disabled={isDownloading}
            aria-busy={isDownloading}
            onClick={() => void handleReportDownload()}
          >
            {isDownloading ? "Preparing report…" : "Download Assessment Report"}
          </Button>
        )}
      </div>
    </div>
  );
}
