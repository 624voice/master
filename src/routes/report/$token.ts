import { createFileRoute } from "@tanstack/react-router";
import { fillRoiPdfTemplate } from "~/lib/roi/fillRoiPdfTemplate";
import { computeAllScenarios } from "~/lib/roi/computeRoi";
import { tradeToSlug } from "~/lib/roi/roiModel";
import { getReportTokenData } from "~/server/speed2Lead/reportTokens";

export const Route = createFileRoute("/report/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const data = await getReportTokenData(params.token);

        if (!data) {
          return new Response("This report link has expired or is invalid.", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }

        const scenarios = computeAllScenarios(data.trade, data.monthlyCalls);
        const pdfBytes = await fillRoiPdfTemplate({
          trade: data.trade,
          truckCount: data.truckCount,
          monthlyCalls: data.monthlyCalls,
          lead: data.lead,
          scenarios,
        });

        const filename = `624-voice-missing-revenue-${tradeToSlug(data.trade)}.pdf`;

        return new Response(pdfBytes, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${filename}"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
