import { normalizePhone } from "~/server/sms/phone";
import { isSpeed2LeadLlmEnabled } from "~/server/speed2Lead/config";

let cachedTestPhones: string[] | null = null;

export function parseSpeed2LeadTestPhones(raw?: string): string[] {
  if (!raw?.trim()) {
    return [];
  }

  const seen = new Set<string>();
  const phones: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const normalized = normalizePhone(trimmed);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    phones.push(normalized);
  }
  return phones;
}

export function resetSpeed2LeadTestPhonesCacheForTests(): void {
  cachedTestPhones = null;
}

export function getSpeed2LeadTestPhones(): string[] {
  if (cachedTestPhones === null) {
    cachedTestPhones = parseSpeed2LeadTestPhones(process.env.SPEED2LEAD_TEST_PHONES);
  }
  return cachedTestPhones;
}

/** True when SPEED2LEAD_TEST_PHONES is set to one or more normalized numbers. */
export function isSpeed2LeadTestPhoneAllowlistActive(): boolean {
  return getSpeed2LeadTestPhones().length > 0;
}

export function isSpeed2LeadTestPhone(phone: string): boolean {
  return getSpeed2LeadTestPhones().includes(normalizePhone(phone));
}

export type DiagnosticTestPhoneResult =
  | { ok: true; phone: string; phoneSuffix: string }
  | { ok: false; reason: "test_phones_not_configured" };

/** Resolve a preview diagnostic booking phone from SPEED2LEAD_TEST_PHONES (or explicit override). */
export function resolveDiagnosticTestPhone(explicit?: string): DiagnosticTestPhoneResult {
  const trimmed = explicit?.trim();
  if (trimmed) {
    const phone = normalizePhone(trimmed);
    return { ok: true, phone, phoneSuffix: phone.slice(-4) };
  }

  if (!isSpeed2LeadTestPhoneAllowlistActive()) {
    return { ok: false, reason: "test_phones_not_configured" };
  }

  const phone = getSpeed2LeadTestPhones()[0]!;
  return { ok: true, phone, phoneSuffix: phone.slice(-4) };
}

/**
 * When LLM is enabled and a test allowlist is configured, only allowlisted phones
 * may enter the orchestrator. Without an allowlist, behavior is unchanged.
 */
export function shouldUseSpeed2LeadLlmForPhone(phone: string): boolean {
  if (!isSpeed2LeadLlmEnabled()) {
    return false;
  }
  if (!isSpeed2LeadTestPhoneAllowlistActive()) {
    return true;
  }
  return isSpeed2LeadTestPhone(phone);
}
