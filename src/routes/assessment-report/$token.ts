import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/assessment-report/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { serveAssessmentTokenPdf } = await import(
          "~/server/report/serveAssessmentTokenPdf.server"
        );
        return serveAssessmentTokenPdf(params.token);
      },
    },
  },
});
