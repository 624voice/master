import { createFileRoute } from "@tanstack/react-router";
import {
  handleResetTestPhoneRequest,
  resetTestPhoneHandlerToResponse,
  resolveResetTestPhoneSecret,
} from "~/server/speed2Lead/resetTestPhoneHandler";

async function handleReset(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const phone = url.searchParams.get("phone");
  const secret = resolveResetTestPhoneSecret(
    url.searchParams.get("secret"),
    request.headers.get("x-speed2lead-reset-secret"),
  );
  const result = await handleResetTestPhoneRequest({ phone, secret });
  return resetTestPhoneHandlerToResponse(result);
}

export const Route = createFileRoute("/api/internal/reset-test-phone")({
  server: {
    handlers: {
      GET: async ({ request }) => handleReset(request),
      POST: async ({ request }) => {
        const url = new URL(request.url);
        let phone = url.searchParams.get("phone");
        let secret = resolveResetTestPhoneSecret(
          url.searchParams.get("secret"),
          request.headers.get("x-speed2lead-reset-secret"),
        );

        if (!phone) {
          try {
            const json = (await request.json()) as { phone?: string; secret?: string };
            phone = json.phone ?? phone;
            secret = secret ?? json.secret?.trim();
          } catch {
            // Query params only is fine.
          }
        }

        const result = await handleResetTestPhoneRequest({ phone, secret });
        return resetTestPhoneHandlerToResponse(result);
      },
    },
  },
});
