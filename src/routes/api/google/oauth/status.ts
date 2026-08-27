import { createFileRoute } from "@tanstack/react-router";
import { handleGoogleOAuthStatusRequest } from "~/server/appointmentLifecycle/googleOAuthHandlers";

export const Route = createFileRoute("/api/google/oauth/status")({
  server: {
    handlers: {
      GET: async ({ request }) => handleGoogleOAuthStatusRequest(request),
    },
  },
});
