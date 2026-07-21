import { createFileRoute } from "@tanstack/react-router";
import { handleInboundSms } from "~/server/speed2Lead/handleInbound";
import { isValidTwilioWebhook } from "~/server/sms/twilio";

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
            await handleInboundSms(from, body);
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
