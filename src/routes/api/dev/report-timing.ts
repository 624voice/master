import { createFileRoute } from "@tanstack/react-router";

function isTimingEnabled(): boolean {
  return process.env.ROI_REPORT_PREVIEW_ENABLED === "true";
}

export const Route = createFileRoute("/api/dev/report-timing")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isTimingEnabled()) {
          return new Response("Not found", { status: 404 });
        }

        const url = new URL(request.url);
        const modeParam = url.searchParams.get("mode");
        const action = url.searchParams.get("action") ?? "render";
        const mode = modeParam === "cold" ? "cold" : "warm";

        if (action === "prepare-chromium") {
          const { prepareChromiumOnly } = await import(
            "~/server/report/renderReportPdf.server"
          );
          const started = performance.now();
          const result = await prepareChromiumOnly();
          return Response.json({
            action: "prepare-chromium",
            mode,
            chromiumPrepMs: result.chromiumPrepMs,
            handlerTotalMs: Math.round(performance.now() - started),
          });
        }

        const { buildNorthstarReportViewModel } = await import(
          "~/lib/report/__fixtures__/northstar"
        );
        const { renderReportPdf } = await import(
          "~/server/report/renderReportPdf.server"
        );

        const model = buildNorthstarReportViewModel();
        const { pdf, timing } = await renderReportPdf(model, {
          mode,
          collectTiming: true,
        });

        return Response.json({
          action: "render",
          mode,
          timing,
          pdfBytes: pdf.byteLength,
        });
      },
    },
  },
});
