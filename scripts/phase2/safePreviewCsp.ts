/** Shared CSP for Phase 2 safe owner preview (browser egress boundary). */
export const SAFE_PREVIEW_CSP_DIRECTIVES = {
  "default-src": "'self' http://127.0.0.1:* http://localhost:* data: blob:",
  "connect-src":
    "'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*",
  "img-src": "'self' data: http://127.0.0.1:* http://localhost:*",
  "script-src":
    "'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:* http://localhost:*",
  "style-src": "'self' 'unsafe-inline'",
  "font-src": "'self' data:",
  "frame-src": "'self' http://127.0.0.1:* http://localhost:*",
  "form-action": "'self' http://127.0.0.1:* http://localhost:*",
  "frame-ancestors": "'none'",
  "base-uri": "'self'",
} as const;

export const SAFE_PREVIEW_CSP_HEADER = Object.entries(SAFE_PREVIEW_CSP_DIRECTIVES)
  .map(([key, value]) => `${key} ${value}`)
  .join("; ");
