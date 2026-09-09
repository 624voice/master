import { renderToStaticMarkup } from "react-dom/server";
import { RoiReport } from "~/components/report/RoiReport";
import type { ReportViewModel } from "~/lib/report/types";
import {
  buildReportPrintCssForPdf,
  loadReportLogoDataUri,
} from "~/server/report/reportStyles.server";

export function renderReportHtml(model: ReportViewModel): string {
  const css = buildReportPrintCssForPdf();
  const logoSrc = loadReportLogoDataUri();
  const body = renderToStaticMarkup(<RoiReport model={model} logoSrc={logoSrc} />);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
  <style>
    .report-icon { width: 22px; height: 22px; display: block; }
  </style>
</head>
<body>${body}</body>
</html>`;
}
