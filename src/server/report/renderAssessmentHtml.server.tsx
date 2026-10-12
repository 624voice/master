import { renderToStaticMarkup } from "react-dom/server";
import { AssessmentReport } from "~/components/report/AssessmentReport";
import type { AssessmentReportViewModel } from "~/lib/assessment/buildAssessmentReportViewModel";
import {
  buildReportPrintCssForPdf,
  loadReportLogoDataUri,
} from "~/server/report/reportStyles.server";

const ASSESSMENT_PRINT_CSS = `
.assessment-report-root .report-page--assessment {
  padding-bottom: 0.42in;
}

.assessment-intro {
  text-align: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.assessment-section-title {
  margin: 0 0 8px;
  font-size: 11pt;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.assessment-respond-section {
  padding: 14px 16px;
  margin-bottom: 14px;
  background: var(--report-surface-green);
  border-color: var(--report-green-tint-border);
}

.assessment-respond-head {
  margin-bottom: 10px;
}

.assessment-combined-label {
  margin: 0;
  font-size: 8.25pt;
  color: var(--report-body);
}

.assessment-respond-hero {
  margin-bottom: 12px;
}

.assessment-respond-hero-label {
  font-size: 8.25pt;
  color: var(--report-body);
  margin-bottom: 4px;
}

.assessment-respond-hero-value {
  font-size: 22pt;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--report-green-dark);
}

.assessment-respond-unavailable {
  margin: 0 0 12px;
  font-size: 9pt;
  color: var(--report-body);
}

.assessment-respond-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.assessment-respond-cell {
  border: 1px solid var(--report-border);
  border-radius: 8px;
  background: var(--report-white);
  padding: 8px 10px;
}

.assessment-respond-value {
  font-size: 12pt;
  font-weight: 700;
}

.assessment-respond-label {
  font-size: 7.75pt;
  color: var(--report-muted);
  margin-top: 2px;
}

.assessment-respond-source {
  font-size: 7.25pt;
  color: var(--report-muted);
  margin-top: 4px;
  text-transform: capitalize;
}

.assessment-dimensions-section {
  margin-bottom: 14px;
}

.assessment-dimension-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.assessment-dimension-card {
  padding: 10px 12px;
}

.assessment-dimension-label {
  font-size: 9pt;
  font-weight: 700;
  margin-bottom: 4px;
}

.assessment-dimension-band {
  font-size: 14pt;
  font-weight: 800;
  color: var(--report-green-dark);
}

.assessment-dimension-clarify {
  font-size: 9pt;
  font-weight: 600;
  color: var(--report-body);
}

.assessment-dimension-confidence {
  margin-top: 4px;
  font-size: 7.5pt;
  color: var(--report-muted);
  text-transform: capitalize;
}

.assessment-priority-section {
  margin-bottom: 12px;
}

.assessment-priority-groups {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.assessment-priority-group {
  padding: 10px 12px;
}

.assessment-priority-group--clarify {
  grid-column: 1 / -1;
  background: var(--report-surface);
}

.assessment-priority-rank {
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--report-muted);
  margin-bottom: 6px;
}

.assessment-priority-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.assessment-priority-list li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
  border-top: 1px solid var(--report-border);
  font-size: 8.25pt;
}

.assessment-priority-list li:first-child {
  border-top: 0;
  padding-top: 0;
}

.assessment-priority-name {
  font-weight: 600;
}

.assessment-priority-detail {
  color: var(--report-body);
  text-align: right;
}

.assessment-disclaimer {
  margin: 0;
  font-size: 7.5pt;
  color: var(--report-muted);
  line-height: 1.5;
}
`;

export function renderAssessmentHtml(model: AssessmentReportViewModel): string {
  const css = buildReportPrintCssForPdf();
  const logoSrc = loadReportLogoDataUri();
  const body = renderToStaticMarkup(
    <AssessmentReport model={model} logoSrc={logoSrc} />,
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
  <style>${ASSESSMENT_PRINT_CSS}</style>
</head>
<body>${body}</body>
</html>`;
}
