import { createFileRoute } from "@tanstack/react-router";
import { RoiReport } from "~/components/report/RoiReport";
import reportPrintCss from "~/styles/report-print.css?url";

function isPreviewEnabled(): boolean {
  return process.env.ROI_REPORT_PREVIEW_ENABLED === "true";
}

export const Route = createFileRoute("/dev/report-preview")({
  component: ReportPreviewPage,
  head: () => ({
    links: [{ rel: "stylesheet", href: reportPrintCss }],
  }),
  loader: async () => {
    if (!isPreviewEnabled()) {
      throw new Response("Not found", { status: 404 });
    }
    const { buildNorthstarReportViewModel } = await import(
      "~/lib/report/__fixtures__/northstar"
    );
    return { model: buildNorthstarReportViewModel() };
  },
});

function ReportPreviewPage() {
  const { model } = Route.useLoaderData();
  return (
    <main style={{ background: "#f1f5f9", padding: 24 }}>
      <RoiReport model={model} />
    </main>
  );
}
