import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/report/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { serveReportTokenPdf } = await import(
          "~/server/report/serveReportTokenPdf.server"
        );
        return serveReportTokenPdf(params.token);
      },
    },
  },
});
