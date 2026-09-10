import type { LeadInfo } from "~/lib/lead/validateLead";
import type { RoiResult } from "~/lib/roi/computeRoi";
import type { TradeKey } from "~/lib/roi/roiModel";
import { buildReportViewModel } from "~/lib/report/buildReportViewModel";
import {
  formatReportDate,
  formatReportId,
} from "~/lib/report/formatReportMeta";
import { renderReportPdf } from "~/server/report/renderReportPdf.server";

export async function generateReportPdfBytes(input: {
  trade: TradeKey;
  truckCount: number;
  monthlyCalls: number;
  lead: LeadInfo;
  scenarios: RoiResult[];
  reportGeneratedAt?: Date;
}): Promise<Uint8Array> {
  const reportGeneratedAt = input.reportGeneratedAt ?? new Date();
  const viewModel = buildReportViewModel({
    trade: input.trade,
    truckCount: input.truckCount,
    monthlyCalls: input.monthlyCalls,
    lead: input.lead,
    scenarios: input.scenarios,
    reportId: formatReportId(
      input.trade,
      input.monthlyCalls,
      reportGeneratedAt,
    ),
    reportDate: formatReportDate(reportGeneratedAt),
  });
  const { pdf } = await renderReportPdf(viewModel);
  return pdf;
}
