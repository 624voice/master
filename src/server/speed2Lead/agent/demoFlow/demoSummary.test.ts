import { describe, expect, test } from "bun:test";
import { VAPI_DEMO_SUMMARY_STRUCTURED_OUTPUT_ID } from "~/config/vapi";
import {
  hasDemoSummarySourceData,
  normalizeDemoSummary,
  parseDemoSummaryFromVapiPayload,
} from "~/server/speed2Lead/agent/demoFlow/demoSummary";

const sampleSummaryPayload = {
  serviceAreaChecked: true,
  schedulingFlowCompleted: false,
  appointmentBookedInDemo: false,
  objectionsRaised: ["pricing"],
  upsellPresented: true,
  topPositiveMoment: "natural voice",
  topConcern: null,
  prospectSentiment: "positive" as const,
};

describe("parseDemoSummaryFromVapiPayload", () => {
  test("empty analysis.structuredData does not block call.artifact structuredOutputs", () => {
    const result = parseDemoSummaryFromVapiPayload({
      structuredData: {},
      messageArtifactStructuredOutputs: undefined,
      callArtifactStructuredOutputs: {
        [VAPI_DEMO_SUMMARY_STRUCTURED_OUTPUT_ID]: {
          result: sampleSummaryPayload,
        },
      },
    });

    expect(result).not.toBeNull();
    expect(result!.prospectSentiment).toBe("positive");
    expect(result!.objectionsRaised).toEqual(["pricing"]);
  });

  test("prefers message.artifact structuredOutputs over call.artifact", () => {
    const result = parseDemoSummaryFromVapiPayload({
      structuredData: undefined,
      messageArtifactStructuredOutputs: {
        [VAPI_DEMO_SUMMARY_STRUCTURED_OUTPUT_ID]: {
          result: { ...sampleSummaryPayload, prospectSentiment: "negative" },
        },
      },
      callArtifactStructuredOutputs: {
        [VAPI_DEMO_SUMMARY_STRUCTURED_OUTPUT_ID]: {
          result: sampleSummaryPayload,
        },
      },
    });

    expect(result?.prospectSentiment).toBe("negative");
  });

  test("reads meaningful analysis.structuredData before artifacts", () => {
    const result = parseDemoSummaryFromVapiPayload({
      structuredData: { ...sampleSummaryPayload, appointmentBookedInDemo: true },
      messageArtifactStructuredOutputs: {
        [VAPI_DEMO_SUMMARY_STRUCTURED_OUTPUT_ID]: {
          result: { ...sampleSummaryPayload, prospectSentiment: "neutral" },
        },
      },
    });

    expect(result?.appointmentBookedInDemo).toBe(true);
  });
});

describe("hasDemoSummarySourceData", () => {
  test("rejects empty object", () => {
    expect(hasDemoSummarySourceData({})).toBe(false);
    expect(normalizeDemoSummary({})).toBeNull();
  });

  test("accepts partial schema payloads", () => {
    expect(hasDemoSummarySourceData({ appointmentBookedInDemo: true })).toBe(true);
  });
});
