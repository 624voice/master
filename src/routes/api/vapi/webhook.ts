import { createFileRoute } from "@tanstack/react-router";
import { startDemoSpeed2Lead } from "~/server/demoSpeed2Lead/startConversation";
import { isSpeed2LeadEnabled } from "~/server/speed2Lead/config";
import { parseEndOfCallReport } from "~/server/vapi/parseEndOfCallReport";
import { markVoiceDemoUsed } from "~/server/vapi/demoUsage";
import { logVoiceTranscriptSafely } from "~/server/vapi/transcript";

function smsConsentEnabled(value: unknown): boolean {
  return value === true || String(value).toLowerCase() === "true";
}

function hasWebsiteFromMetadata(website: string | undefined): boolean {
  if (!website) return false;
  const normalized = website.trim().toLowerCase();
  return normalized !== "" && !normalized.includes("don't have a website");
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

          const isVoiceDemo = metadata.source === "voice_demo";

          if (
            isVoiceDemo &&
            smsConsentEnabled(metadata.smsConsent) &&
            isSpeed2LeadEnabled() &&
            metadata.phone &&
            metadata.firstName &&
            metadata.lastName &&
            metadata.email
          ) {
            try {
              await startDemoSpeed2Lead({
                phone: metadata.phone,
                firstName: metadata.firstName,
                lastName: metadata.lastName,
                email: metadata.email,
                hasWebsite: hasWebsiteFromMetadata(metadata.website),
                smsConsent: true,
                demoCompletedAt: new Date().toISOString(),
                durationSeconds,
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
