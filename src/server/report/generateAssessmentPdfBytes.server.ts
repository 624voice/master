import { buildAssessmentReportViewModel } from "~/lib/assessment/buildAssessmentReportViewModel";
import type { AssessmentReportSnapshot } from "~/server/assessment/types";
import { renderAssessmentPdf } from "~/server/report/renderAssessmentPdf.server";

export async function generateAssessmentPdfBytes(input: {
  snapshot: AssessmentReportSnapshot;
}): Promise<Uint8Array> {
  const generatedAt = new Date(input.snapshot.reportGeneratedAt);
  const viewModel = buildAssessmentReportViewModel(input.snapshot, generatedAt);
  const { pdf } = await renderAssessmentPdf(viewModel);
  return pdf;
}
