import { createFileRoute } from "@tanstack/react-router";
import { handleGoogleOAuthStartRequest } from "~/server/appointmentLifecycle/googleOAuthHandlers";

export const Route = createFileRoute("/api/google/oauth/start")({
  server: {
    handlers: {
      GET: async ({ request }) => handleGoogleOAuthStartRequest(request),
    },
  },
});
