import { describe, expect, test } from "bun:test";
import {
  getGoogleServiceAccountCredentialDiagnostics,
  inspectGooglePrivateKey,
  isGooglePrivateKeyStructurallyValid,
  normalizeGoogleServiceAccountPrivateKey,
  sanitizeGoogleApiErrorBody,
} from "~/server/appointmentLifecycle/googleCredentials";

const VALID_KEY = `-----BEGIN PRIVATE KEY-----
LINE1
LINE2
-----END PRIVATE KEY-----`;

describe("googleCredentials", () => {
  test("normalizes escaped newlines from Netlify-style storage", () => {
    const normalized = normalizeGoogleServiceAccountPrivateKey(
      "-----BEGIN PRIVATE KEY-----\\nLINE1\\nLINE2\\n-----END PRIVATE KEY-----",
    );
    expect(normalized).toBe(VALID_KEY);
    expect(isGooglePrivateKeyStructurallyValid(normalized)).toBe(true);
  });

  test("normalizes double-escaped newlines", () => {
    const normalized = normalizeGoogleServiceAccountPrivateKey(
      "-----BEGIN PRIVATE KEY-----\\\\nLINE1\\\\nLINE2\\\\n-----END PRIVATE KEY-----",
    );
    expect(normalized).toBe(VALID_KEY);
  });

  test("strips surrounding quotes", () => {
    const normalized = normalizeGoogleServiceAccountPrivateKey(
      `"-----BEGIN PRIVATE KEY-----\\nLINE1\\nLINE2\\n-----END PRIVATE KEY-----"`,
    );
    expect(normalized).toBe(VALID_KEY);
  });

  test("parses private key id from JSON credential blob", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "id-24voice-calendar@voice-search-504400.iam.gserviceaccount.com",
      private_key_id: "7a44b1881943",
      private_key: "-----BEGIN PRIVATE KEY-----\\nLINE1\\nLINE2\\n-----END PRIVATE KEY-----",
    });
    process.env.GOOGLE_CALENDAR_ID = "info@624voice.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_ID = "7a44b1881943";

    const diagnostics = getGoogleServiceAccountCredentialDiagnostics();
    expect(diagnostics.privateKeyIdFromCredentials).toBe("7a44b1881943");
    expect(diagnostics.privateKeyIdMatchesConfigured).toBe(true);
    expect(diagnostics.serviceAccountEmail).toBe(
      "id-24voice-calendar@voice-search-504400.iam.gserviceaccount.com",
    );

    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_ID;
  });

  test("inspectGooglePrivateKey reports PEM header/footer validity", () => {
    expect(inspectGooglePrivateKey(VALID_KEY)).toEqual({
      privateKeyPresent: true,
      privateKeyPemHeaderValid: true,
      privateKeyPemFooterValid: true,
      privateKeyLineCount: 4,
    });
    expect(inspectGooglePrivateKey("not-a-key")).toEqual({
      privateKeyPresent: true,
      privateKeyPemHeaderValid: false,
      privateKeyPemFooterValid: false,
      privateKeyLineCount: 1,
    });
  });

  test("sanitizeGoogleApiErrorBody extracts reason and message", () => {
    const parsed = sanitizeGoogleApiErrorBody(
      JSON.stringify({
        error: {
          code: 403,
          message: "Not Authorized",
          errors: [{ reason: "forbidden", message: "Not Authorized to access this calendar" }],
        },
      }),
      403,
    );
    expect(parsed.httpStatus).toBe(403);
    expect(parsed.googleErrorReason).toBe("forbidden");
    expect(parsed.googleErrorMessage).toBe("Not Authorized to access this calendar");
  });
});
