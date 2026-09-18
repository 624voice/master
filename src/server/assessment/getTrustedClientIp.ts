import { getRequestIP } from "@tanstack/react-start/server";

export function getTrustedClientIp(): string | undefined {
  return getRequestIP({ xForwardedFor: true });
}
