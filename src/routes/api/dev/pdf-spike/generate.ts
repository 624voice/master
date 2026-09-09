import { createFileRoute } from "@tanstack/react-router";
import {
  closeSpikeBrowser,
  renderSpikePdf,
} from "~/server/report/spike/renderSpikePdf";

/**
 * Phase 0 spike — mirrors synchronous generateRoiPdf handler timing shape.
 * Dev/preview only. Does not touch production PDF path or lead/SMS workflow.
 */
export const Route = createFileRoute("/api/dev/pdf-spike/generate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (process.env.CONTEXT === "production") {
          return new Response("Not found", { status: 404 });
        }

        const url = new URL(request.url);
        const mode = url.searchParams.get("mode") === "cold" ? "cold" : "warm";
        const format = url.searchParams.get("format") ?? "pdf";

        const handlerStarted = performance.now();

        try {
          const { pdf, metrics } = await renderSpikePdf({ mode });
          const handlerMs = Math.round(performance.now() - handlerStarted);

          if (format === "json") {
            return Response.json({
              path: "generateRoiPdf-analog",
              mode,
              handlerMs,
              metrics,
            });
          }

          return new Response(pdf, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": 'inline; filename="624voice-pdf-spike-generate.pdf"',
              "Cache-Control": "no-store",
              "X-Spike-Path": "generate",
              "X-Spike-Mode": mode,
              "X-Spike-Handler-Ms": String(handlerMs),
              "X-Spike-Total-Ms": String(metrics.totalMs),
            },
          });
        } catch (error) {
          return Response.json(
            {
              path: "generateRoiPdf-analog",
              mode,
              error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          );
        } finally {
          if (mode === "cold") {
            await closeSpikeBrowser();
          }
        }
      },
    },
  },
});
