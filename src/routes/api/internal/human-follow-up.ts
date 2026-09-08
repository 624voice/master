import { createFileRoute } from "@tanstack/react-router";
import {
  resolveHumanFollowUp,
  type HumanFollowUpAction,
} from "~/server/speed2Lead/agent/humanFollowUpResolve";
import { normalizePhone } from "~/server/sms/phone";

function isAuthorized(request: Request, bodySecret?: string): boolean {
  const configured =
    process.env.SPEED2LEAD_INTERNAL_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.SPEED2LEAD_TEST_RESET_SECRET?.trim();
  if (!configured) {
    return process.env.NODE_ENV !== "production";
  }
  const header =
    request.headers.get("x-speed2lead-internal-secret")?.trim() ||
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  return header === configured || bodySecret === configured;
}

export async function handleHumanFollowUpRequest(args: {
  request: Request;
  phone?: string;
  action?: string;
  calendarEventId?: string;
  secret?: string;
}): Promise<Response> {
  if (!isAuthorized(args.request, args.secret)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const phone = args.phone?.trim();
  const action = args.action?.trim().toUpperCase() as HumanFollowUpAction;
  if (!phone || !["RESUME", "CLOSE", "BOOKED"].includes(action)) {
    return Response.json({ ok: false, error: "phone and action (RESUME|CLOSE|BOOKED) are required" }, { status: 400 });
  }

  const result = await resolveHumanFollowUp({
    phone: normalizePhone(phone),
    action,
    calendarEventId: args.calendarEventId,
  });
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error, refused: result.refused },
      { status: result.refused === "BOOKED" ? 409 : 400 },
    );
  }
  return Response.json({
    ok: true,
    action: result.action,
    stage: result.session.stage,
    bookingLinkFollowUpNextAt: result.session.bookingLinkFollowUpNextAt,
    bookingLinkFollowUpStage: result.session.bookingLinkFollowUpStage,
  });
}

export const Route = createFileRoute("/api/internal/human-follow-up")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        let phone = url.searchParams.get("phone") ?? undefined;
        let action = url.searchParams.get("action") ?? undefined;
        let calendarEventId = url.searchParams.get("calendarEventId") ?? undefined;
        let secret =
          url.searchParams.get("secret") ??
          request.headers.get("x-speed2lead-internal-secret") ??
          undefined;
        try {
          const json = (await request.json()) as {
            phone?: string;
            action?: string;
            calendarEventId?: string;
            secret?: string;
          };
          phone = json.phone ?? phone;
          action = json.action ?? action;
          calendarEventId = json.calendarEventId ?? calendarEventId;
          secret = secret ?? json.secret;
        } catch {
          // query/header only
        }
        return handleHumanFollowUpRequest({ request, phone, action, calendarEventId, secret });
      },
    },
  },
});
