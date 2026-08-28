import { resetSpeed2LeadTestPhone } from "~/server/speed2Lead/resetTestPhone";
import { isSpeed2LeadTestPhone } from "~/server/speed2Lead/testPhoneAllowlist";
import { normalizePhone } from "~/server/sms/phone";

export type ResetTestPhoneHandlerResult =
  | { ok: true; status: 200; body: Awaited<ReturnType<typeof resetSpeed2LeadTestPhone>> & { ok: true } }
  | { ok: false; status: 401 | 400 | 500; error: string };

export function resolveResetTestPhoneSecret(
  querySecret: string | null | undefined,
  headerSecret: string | null | undefined,
): string | undefined {
  return querySecret?.trim() || headerSecret?.trim() || undefined;
}

export async function handleResetTestPhoneRequest(args: {
  phone?: string | null;
  secret?: string | null;
}): Promise<ResetTestPhoneHandlerResult> {
  const configuredSecret = process.env.SPEED2LEAD_TEST_RESET_SECRET?.trim();
  const providedSecret = args.secret?.trim();

  if (!configuredSecret) {
    return { ok: false, status: 500, error: "SPEED2LEAD_TEST_RESET_SECRET is not configured" };
  }

  if (!providedSecret || providedSecret !== configuredSecret) {
    return { ok: false, status: 401, error: "Invalid or missing reset secret" };
  }

  const rawPhone = args.phone?.trim();
  if (!rawPhone) {
    return { ok: false, status: 400, error: "Missing phone parameter" };
  }

  const phone = normalizePhone(rawPhone);
  if (!isSpeed2LeadTestPhone(phone)) {
    return {
      ok: false,
      status: 400,
      error: "Phone is not on the SPEED2LEAD_TEST_PHONES allowlist",
    };
  }

  const cleared = await resetSpeed2LeadTestPhone(phone);
  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      ...cleared,
    },
  };
}

export function resetTestPhoneHandlerToResponse(result: ResetTestPhoneHandlerResult): Response {
  if (result.ok) {
    return Response.json(result.body, { status: result.status });
  }
  return Response.json({ ok: false, error: result.error }, { status: result.status });
}
