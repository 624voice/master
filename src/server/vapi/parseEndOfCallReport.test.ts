import { describe, expect, test } from "bun:test";
import { VAPI_DEMO_SUMMARY_STRUCTURED_OUTPUT_ID } from "~/config/vapi";
import { parseEndOfCallReport } from "./parseEndOfCallReport";

describe("parseEndOfCallReport", () => {
  test("parses end-of-call-report with artifact transcript and metadata", () => {
    const result = parseEndOfCallReport({
      message: {
        type: "end-of-call-report",
        endedReason: "hangup",
        durationSeconds: 142,
        analysis: {
          structuredData: { appointmentBookedInDemo: true },
        },
        artifact: {
          transcript: "AI: Hello\nUser: Hi there",
          recording: { url: "https://storage.example/rec.wav" },
        },
        call: {
          id: "call-123",
          assistant: {
            metadata: {
              firstName: "Chris",
              lastName: "Smith",
              businessName: "Smith Plumbing",
              email: "chris@example.com",
              phone: "+15551234567",
              website: "https://example.com",
              smsConsent: true,
              source: "voice_demo",
            },
          },
        },
      },
    });

    expect(result).not.toBeNull();
    expect(result!.transcript).toContain("AI: Hello");
    expect(result!.recordingUrl).toBe("https://storage.example/rec.wav");
    expect(result!.durationSeconds).toBe(142);
    expect(result!.endedReason).toBe("hangup");
    expect(result!.metadata.firstName).toBe("Chris");
    expect(result!.metadata.email).toBe("chris@example.com");
    expect(result!.callId).toBe("call-123");
    expect(result!.analysisStructuredData).toEqual({ appointmentBookedInDemo: true });
  });

  test("extracts structuredOutputs from call.artifact", () => {
    const payload = {
      [VAPI_DEMO_SUMMARY_STRUCTURED_OUTPUT_ID]: {
        result: { appointmentBookedInDemo: true, prospectSentiment: "positive" },
      },
    };

    const result = parseEndOfCallReport({
      message: {
        type: "end-of-call-report",
        call: {
          id: "call-456",
          artifact: {
            structuredOutputs: payload,
          },
        },
      },
    });

    expect(result).not.toBeNull();
    expect(result!.callArtifactStructuredOutputs).toEqual(payload);
    expect(result!.messageArtifactStructuredOutputs).toBeUndefined();
  });

  test("returns null for non end-of-call-report messages", () => {
    expect(
      parseEndOfCallReport({ message: { type: "status-update" } }),
    ).toBeNull();
  });
});
