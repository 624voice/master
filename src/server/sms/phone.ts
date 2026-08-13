export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return digits.startsWith("+") ? phone.trim() : `+${digits}`;
}

export function tryNormalizePhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))) {
    return normalizePhone(phone);
  }
  return undefined;
}
