import { createFileRoute } from "@tanstack/react-router";
import { startContactSpeed2Lead } from "~/server/contactSpeed2Lead/startConversation";
import { isSpeed2LeadEnabled } from "~/server/speed2Lead/config";
import { parseEndOfCallReport } from "~/server/vapi/parseEndOfCallReport";
import { markVoiceDemoUsed } from "~/server/vapi/demoUsage";
import { logVoiceTranscriptSafely } from "~/server/vapi/transcript";

function smsConsentEnabled(value: unknown): boolean {
  return value === true || String(value).toLowerCase() === "true";
}

export const Route = createFileRoute("/api/vapi/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const report = parseEndOfCallReport(body);
        if (report) {
          const { metadata, transcript, recordingUrl, durationSeconds, endedReason } =
            report;

          if (metadata.email && metadata.phone) {
            await markVoiceDemoUsed(metadata.email, metadata.phone);
          }

          logVoiceTranscriptSafely({
            firstName: metadata.firstName,
            lastName: metadata.lastName,
            businessName: metadata.businessName,
            email: metadata.email,
            phone: metadata.phone,
            website: metadata.website,
            durationSeconds,
            endedReason,
            transcript,
            recordingUrl,
          });

          if (
            smsConsentEnabled(metadata.smsConsent) &&
            isSpeed2LeadEnabled() &&
            metadata.phone &&
            metadata.firstName &&
            metadata.businessName &&
            (durationSeconds ?? 0) > 0
          ) {
            try {
              await startContactSpeed2Lead({
                phone: metadata.phone,
                firstName: metadata.firstName,
                businessName: metadata.businessName,
                message: "Voice demo follow-up",
              });
            } catch (error) {
              console.error("Post-demo Speed2Lead SMS failed:", error);
            }
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
