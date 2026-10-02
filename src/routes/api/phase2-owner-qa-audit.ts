import { createFileRoute } from "@tanstack/react-router";
import { isPhase2HostedOwnerQaPreviewBoundary } from "~/server/phase2OwnerQaBoundary";
import { getPhase2OwnerQaSavedLeads } from "~/server/phase2OwnerQaInMemoryStore";
import { buildDeployVersionInfo } from "~/server/deployVersion";

/** Non-secret smoke audit for protected owner-QA preview only. */
export const Route = createFileRoute("/api/phase2-owner-qa-audit")({
  server: {
    handlers: {
      GET: async () => {
        if (!isPhase2HostedOwnerQaPreviewBoundary()) {
          return new Response(JSON.stringify({ ok: false, reason: "boundary_inactive" }), {
            status: 404,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }
        const deploy = buildDeployVersionInfo();
        const leads = getPhase2OwnerQaSavedLeads();
        const { getPhase2OwnerQaAdapterAuditSnapshot } = await import(
          "~/server/phase2OwnerQaAdapterAudit"
        );
        const adapterCounters = await getPhase2OwnerQaAdapterAuditSnapshot();
        return new Response(
          JSON.stringify({
            ok: true,
            boundaryActive: true,
            deployContext: deploy.deployContext,
            phase2OwnerQaPreviewFlag: deploy.phase2OwnerQaPreviewFlag,
            inMemoryLeadCount: leads.length,
            inMemoryLeadSources: leads.map((l) => l.source),
            adapterCounters,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
