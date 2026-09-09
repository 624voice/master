import { computeAllScenarios } from "~/lib/roi/computeRoi";
import { tradeToSlug } from "~/lib/roi/roiModel";
import { buildReportViewModel } from "~/lib/report/buildReportViewModel";
import {
  formatReportDate,
  formatReportId,
} from "~/lib/report/formatReportMeta";
import { getReportTokenData } from "~/server/speed2Lead/reportTokens";
import { renderReportPdf } from "~/server/report/renderReportPdf.server";

export async function serveReportTokenPdf(token: string): Promise<Response> {
  const data = await getReportTokenData(token);

  if (!data) {
    return new Response("This report link has expired or is invalid.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const scenarios = computeAllScenarios(data.trade, data.monthlyCalls);
  const reportGeneratedAt = new Date();
  const viewModel = buildReportViewModel({
    trade: data.trade,
    truckCount: data.truckCount,
    monthlyCalls: data.monthlyCalls,
    lead: data.lead,
    scenarios,
    reportId: formatReportId(data.trade, data.monthlyCalls, reportGeneratedAt),
    reportDate: formatReportDate(reportGeneratedAt),
  });
  const { pdf: pdfBytes } = await renderReportPdf(viewModel);

  const filename = `624-voice-missing-revenue-${tradeToSlug(data.trade)}.pdf`;

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
