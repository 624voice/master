import { createFileRoute } from "@tanstack/react-router";
import {
  closeSpikeBrowser,
  renderSpikePdf,
} from "~/server/report/spike/renderSpikePdf";

/**
 * Phase 0 spike — mirrors GET /report/$token synchronous regeneration path.
 * Dev/preview only. Skips Redis token lookup; measures render-only latency.
 */
export const Route = createFileRoute("/api/dev/pdf-spike/report")({
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
          // Analogous to token lookup + computeAllScenarios — negligible vs PDF render.
          const lookupMs = 1;

          const { pdf, metrics } = await renderSpikePdf({ mode });
          const handlerMs = Math.round(performance.now() - handlerStarted);

          if (format === "json") {
            return Response.json({
              path: "report-token-analog",
              mode,
              lookupMs,
              handlerMs,
              metrics,
            });
          }

          return new Response(pdf, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": 'inline; filename="624voice-pdf-spike-report.pdf"',
              "Cache-Control": "no-store",
              "X-Spike-Path": "report",
              "X-Spike-Mode": mode,
              "X-Spike-Handler-Ms": String(handlerMs),
              "X-Spike-Total-Ms": String(metrics.totalMs),
            },
          });
        } catch (error) {
          return Response.json(
            {
              path: "report-token-analog",
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
