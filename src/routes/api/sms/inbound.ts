import { createFileRoute } from "@tanstack/react-router";
import { maybeCancelAbandonedDemoRecoveryOnInbound } from "~/server/speed2Lead/agent/demoFlow/abandonedRecovery";
import { handleInboundSms } from "~/server/speed2Lead/handleInbound";
import { handleAgentInboundSms } from "~/server/speed2Lead/agent/handleInbound";
import { getAgentSession } from "~/server/speed2Lead/agent/state";
import { isValidTwilioWebhook } from "~/server/sms/twilio";
import { normalizePhone } from "~/server/sms/phone";

export const Route = createFileRoute("/api/sms/inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const formData = await request.formData();
        const params: Record<string, string> = {};

        for (const [key, value] of formData.entries()) {
          if (typeof value === "string") {
            params[key] = value;
          }
        }

        const signature = request.headers.get("X-Twilio-Signature");

        if (!isValidTwilioWebhook(request, signature, params)) {
          console.error("Twilio webhook signature validation failed", {
            requestUrl: new URL(request.url).toString(),
            configuredUrl: process.env.TWILIO_WEBHOOK_URL,
          });
          return new Response("Invalid Twilio signature", { status: 403 });
        }

        const from = params.From;
        const body = params.Body ?? "";

        if (from) {
          try {
            await maybeCancelAbandonedDemoRecoveryOnInbound(normalizePhone(from));

            // A rebuilt-engine session exists only for phones started via
            // the new startAgentConversation() path — route those there and
            // leave every other flow (old ROI engine, contact, demo) on the
            // existing handler untouched.
            const agentSession = await getAgentSession(normalizePhone(from));
            if (agentSession) {
              await handleAgentInboundSms(from, body, params.MessageSid);
            } else {
              await handleInboundSms(from, body);
            }
          } catch (error) {
            console.error("Speed2Lead inbound SMS handler failed:", error);
          }
        }

        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
