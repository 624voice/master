import { createFileRoute } from "@tanstack/react-router";
import { handleInboundSms } from "~/server/speed2Lead/handleInbound";
import { validateTwilioRequest } from "~/server/sms/twilio";

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
        const webhookUrl =
          process.env.TWILIO_WEBHOOK_URL ?? new URL(request.url).toString();

        if (
          process.env.NODE_ENV === "production" &&
          !validateTwilioRequest(signature, webhookUrl, params)
        ) {
          return new Response("Invalid Twilio signature", { status: 403 });
        }

        const from = params.From;
        const body = params.Body ?? "";

        if (from) {
          await handleInboundSms(from, body);
        }

        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
