import { getAssessmentReportTokenData } from "~/server/assessment/reportTokens";
import { generateAssessmentPdfBytes } from "~/server/report/generateAssessmentPdfBytes.server";

export async function serveAssessmentTokenPdf(token: string): Promise<Response> {
  const data = await getAssessmentReportTokenData(token);

  if (!data) {
    return new Response("This assessment report link has expired or is invalid.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const pdfBytes = await generateAssessmentPdfBytes({ snapshot: data.snapshot });
  const filename = "624-voice-assessment-report.pdf";

  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
