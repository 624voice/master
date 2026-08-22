const PEM_BEGIN = "-----BEGIN PRIVATE KEY-----";
const PEM_END = "-----END PRIVATE KEY-----";

export type GooglePrivateKeyDiagnostics = {
  privateKeyPresent: boolean;
  privateKeyPemHeaderValid: boolean;
  privateKeyPemFooterValid: boolean;
  privateKeyLineCount: number;
};

export type GoogleServiceAccountCredentialDiagnostics = GooglePrivateKeyDiagnostics & {
  serviceAccountEmail: string | null;
  calendarId: string | null;
  privateKeyIdConfigured: string | null;
  privateKeyIdFromCredentials: string | null;
  privateKeyIdMatchesConfigured: boolean | null;
};

export type GoogleApiErrorDetails = {
  httpStatus?: number;
  googleErrorReason?: string;
  googleErrorMessage?: string;
};

export type GoogleProviderFailureStage =
  | "not_configured"
  | "invalid_private_key"
  | "token_exchange"
  | "calendar_api";

export type GoogleProviderDiagnostic = GoogleServiceAccountCredentialDiagnostics &
  GoogleApiErrorDetails & {
    tokenGenerationSucceeded: boolean;
    failureStage?: GoogleProviderFailureStage;
    requestEndpoint?: "oauth2.token" | "calendar.events.list";
    requestStartIso?: string;
    requestEndIso?: string;
  };

type ParsedServiceAccountJson = {
  clientEmail?: string;
  privateKey?: string;
  privateKeyId?: string;
};

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Normalize Netlify / env-stored PEM material without logging secrets. */
export function normalizeGoogleServiceAccountPrivateKey(
  raw: string | undefined,
): string | undefined {
  let key = trimOptional(raw);
  if (!key) return undefined;

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  let previous = "";
  while (previous !== key) {
    previous = key;
    key = key.replace(/\\\\n/g, "\\n").replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  }

  return key.trim();
}

function tryParseServiceAccountJson(raw: string | undefined): ParsedServiceAccountJson | null {
  const trimmed = trimOptional(raw);
  if (!trimmed || !trimmed.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      client_email?: string;
      private_key?: string;
      private_key_id?: string;
    };
    return {
      clientEmail: trimOptional(parsed.client_email),
      privateKey: normalizeGoogleServiceAccountPrivateKey(parsed.private_key),
      privateKeyId: trimOptional(parsed.private_key_id),
    };
  } catch {
    return null;
  }
}

export function inspectGooglePrivateKey(
  privateKey: string | undefined,
): GooglePrivateKeyDiagnostics {
  const normalized = normalizeGoogleServiceAccountPrivateKey(privateKey);
  return {
    privateKeyPresent: Boolean(normalized),
    privateKeyPemHeaderValid: normalized?.includes(PEM_BEGIN) ?? false,
    privateKeyPemFooterValid: normalized?.includes(PEM_END) ?? false,
    privateKeyLineCount: normalized ? normalized.split("\n").length : 0,
  };
}

export function isGooglePrivateKeyStructurallyValid(privateKey: string | undefined): boolean {
  const diagnostics = inspectGooglePrivateKey(privateKey);
  return (
    diagnostics.privateKeyPresent &&
    diagnostics.privateKeyPemHeaderValid &&
    diagnostics.privateKeyPemFooterValid &&
    diagnostics.privateKeyLineCount >= 3
  );
}

export function getGoogleServiceAccountCredentialDiagnostics(): GoogleServiceAccountCredentialDiagnostics {
  const calendarId = trimOptional(process.env.GOOGLE_CALENDAR_ID) ?? null;
  const configuredKeyId = trimOptional(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_ID) ?? null;

  const jsonFromDedicatedEnv = tryParseServiceAccountJson(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );
  const jsonFromPrivateKeyEnv = tryParseServiceAccountJson(
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
  const parsedJson = jsonFromDedicatedEnv ?? jsonFromPrivateKeyEnv;

  const serviceAccountEmail =
    trimOptional(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) ??
    parsedJson?.clientEmail ??
    null;

  const privateKey =
    normalizeGoogleServiceAccountPrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) ??
    parsedJson?.privateKey;

  const privateKeyIdFromCredentials = parsedJson?.privateKeyId ?? null;
  const privateKeyIdMatchesConfigured =
    configuredKeyId && privateKeyIdFromCredentials
      ? configuredKeyId === privateKeyIdFromCredentials
      : configuredKeyId
        ? null
        : null;

  return {
    serviceAccountEmail,
    calendarId,
    ...inspectGooglePrivateKey(privateKey),
    privateKeyIdConfigured: configuredKeyId,
    privateKeyIdFromCredentials,
    privateKeyIdMatchesConfigured,
  };
}

export function getGoogleServiceAccountCredentials(): {
  clientEmail: string;
  privateKey: string;
} {
  const diagnostics = getGoogleServiceAccountCredentialDiagnostics();
  const jsonFromDedicatedEnv = tryParseServiceAccountJson(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );
  const jsonFromPrivateKeyEnv = tryParseServiceAccountJson(
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
  const parsedJson = jsonFromDedicatedEnv ?? jsonFromPrivateKeyEnv;

  const clientEmail =
    diagnostics.serviceAccountEmail ??
    parsedJson?.clientEmail;
  const privateKey =
    normalizeGoogleServiceAccountPrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) ??
    parsedJson?.privateKey;

  if (!clientEmail || !privateKey) {
    throw new Error("Google service account credentials are not configured");
  }
  if (!isGooglePrivateKeyStructurallyValid(privateKey)) {
    throw new Error("Google service account private key is structurally invalid");
  }

  return { clientEmail, privateKey };
}

export function isGoogleCalendarApiConfigured(): boolean {
  try {
    getGoogleServiceAccountCredentials();
    return Boolean(trimOptional(process.env.GOOGLE_CALENDAR_ID));
  } catch {
    return false;
  }
}

export function sanitizeGoogleApiErrorBody(
  body: string,
  httpStatus?: number,
): GoogleApiErrorDetails {
  const details: GoogleApiErrorDetails = { httpStatus };
  try {
    const parsed = JSON.parse(body) as {
      error?: string | {
        code?: number;
        message?: string;
        errors?: Array<{ reason?: string; message?: string }>;
      };
      error_description?: string;
      message?: string;
      errors?: Array<{ reason?: string; message?: string }>;
    };

    const nested =
      parsed.error && typeof parsed.error === "object" ? parsed.error.errors?.[0] : undefined;
    const flat = parsed.errors?.[0];

    if (parsed.error && typeof parsed.error === "string") {
      details.googleErrorReason = parsed.error;
      details.googleErrorMessage = parsed.error_description ?? parsed.message;
    } else if (nested) {
      details.googleErrorReason = nested.reason;
      details.googleErrorMessage = nested.message ?? parsed.error?.message;
    } else if (flat) {
      details.googleErrorReason = flat.reason;
      details.googleErrorMessage = flat.message;
    } else if (parsed.error && typeof parsed.error === "object" && parsed.error.message) {
      details.googleErrorMessage = parsed.error.message;
    } else if (parsed.message) {
      details.googleErrorMessage = parsed.message;
    }
  } catch {
    details.googleErrorMessage = body.slice(0, 240);
  }

  return details;
}

export function logGoogleProviderDiagnostic(
  diagnostic: GoogleProviderDiagnostic,
  extra: Record<string, string | number | boolean | undefined> = {},
): void {
  console.log(
    JSON.stringify({
      component: "googleCalendarProvider",
      event: "provider_diagnostic",
      at: new Date().toISOString(),
      ...diagnostic,
      ...extra,
    }),
  );
}
