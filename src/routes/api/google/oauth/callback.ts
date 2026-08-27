import { createFileRoute } from "@tanstack/react-router";
import { handleGoogleOAuthCallbackRequest } from "~/server/appointmentLifecycle/googleOAuthHandlers";

export const Route = createFileRoute("/api/google/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => handleGoogleOAuthCallbackRequest(request),
    },
  },
});
