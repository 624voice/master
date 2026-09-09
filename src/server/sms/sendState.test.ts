import { beforeEach, describe, expect, test } from "bun:test";
import {
  capturedOutboundSms,
  capturedRedisStore,
  installSpeed2LeadIntegrationMocks,
  resetSpeed2LeadIntegrationMocks,
  setFakeSendSms,
} from "~/server/speed2Lead/testSupport/integrationMocks";

installSpeed2LeadIntegrationMocks();

const {
  classifyProviderSendError,
  getSendStateRecord,
  saveSendStateRecord,
  sendSmsWithState,
  sendStateKeys,
  sendStateRedisKey,
} = await import("~/server/sms/sendState");

function expiredLeaseIso(): string {
  return new Date(Date.now() - 60_000).toISOString();
}

function futureLeaseIso(): string {
  return new Date(Date.now() + 60_000).toISOString();
}

describe("opener send-state key scope", () => {
  test("agent opener is phone + flow + episode, not phone-only", () => {
    const key = sendStateKeys.agentOpener("+15550001999", "roi", "2026-01-01T00:00:00.000Z");
    expect(key).toBe("agent-opener:+15550001999:roi:2026-01-01T00:00:00.000Z");
    expect(key).not.toBe(sendStateKeys.agentOpener("+15550001999", "contact", "2026-01-01T00:00:00.000Z"));
    expect(key).not.toBe(
      sendStateKeys.agentOpener("+15550001999", "roi", "2026-02-01T00:00:00.000Z"),
    );
  });

  test("legacy demo opener is phone + episode, not phone-only", () => {
    const key = sendStateKeys.legacyDemoOpener("+15550001998", "vapi-call-1");
    expect(key).toBe("legacy-demo-opener:+15550001998:vapi-call-1");
    expect(key).not.toBe(sendStateKeys.legacyDemoOpener("+15550001998", "vapi-call-2"));
  });

  test("booking-link and lifecycle keys are unchanged", () => {
    expect(sendStateKeys.bookingLinkInitial("+15550001997", "created")).toBe(
      "booking-link:+15550001997:created:initial",
    );
    expect(sendStateKeys.lifecycle("evt-1", "confirmation")).toBe("lifecycle:evt-1:confirmation");
    expect(sendStateKeys.noResponse("+15550001997", "created", 0)).toBe(
      "no-response:+15550001997:created:0",
    );
  });
});

describe("classifyProviderSendError", () => {
  test("timeouts and connection resets are indeterminate", () => {
    expect(classifyProviderSendError({ message: "timeout", code: "ETIMEDOUT" })).toBe("indeterminate");
    expect(classifyProviderSendError({ message: "socket hang up", code: "ECONNRESET" })).toBe(
      "indeterminate",
    );
  });

  test("conclusive 5xx / 429 are retryable", () => {
    expect(classifyProviderSendError({ message: "rate limited", status: 429, code: 20429 })).toBe(
      "retryable",
    );
    expect(classifyProviderSendError({ message: "unavailable", status: 503 })).toBe("retryable");
  });

  test("conclusive 4xx are terminal", () => {
    expect(classifyProviderSendError({ message: "invalid number", status: 400, code: 21211 })).toBe(
      "terminal",
    );
  });

  test("unconfigured Twilio never reached the provider and is retryable", () => {
    expect(classifyProviderSendError(new Error("Twilio is not configured"))).toBe("retryable");
  });
});

describe("sendSmsWithState crash and provider-fake outcomes", () => {
  beforeEach(() => {
    resetSpeed2LeadIntegrationMocks();
  });

  test("crash-before-submitting: stale claimed lease is reclaimed and sent", async () => {
    const key = "unit-stale-claimed";
    await saveSendStateRecord({
      key,
      status: "claimed",
      claimedAt: expiredLeaseIso(),
      leaseExpiresAt: expiredLeaseIso(),
      attemptCount: 1,
      attemptId: "old-attempt",
      updatedAt: expiredLeaseIso(),
    });

    const result = await sendSmsWithState({ key, to: "+15550000001", body: "hello" });
    expect(result.outcome).toBe("sent");
    expect(capturedOutboundSms).toEqual(["hello"]);
    const record = await getSendStateRecord(key);
    expect(record?.status).toBe("sent");
    expect(record?.attemptCount).toBe(2);
  });

  test("crash-after-submitting: stale submitting becomes indeterminate and is not resent", async () => {
    const key = "unit-stale-submitting";
    await saveSendStateRecord({
      key,
      status: "submitting",
      claimedAt: expiredLeaseIso(),
      leaseExpiresAt: expiredLeaseIso(),
      attemptCount: 1,
      attemptId: "crashed",
      submittingAttemptId: "crashed",
      updatedAt: expiredLeaseIso(),
    });

    const result = await sendSmsWithState({ key, to: "+15550000002", body: "hello" });
    expect(result.outcome).toBe("indeterminate");
    expect(capturedOutboundSms).toEqual([]);
    const record = await getSendStateRecord(key);
    expect(record?.status).toBe("indeterminate");
  });

  test("provider timeout after submitting is indeterminate and is not retried as a send", async () => {
    const key = "unit-timeout";
    setFakeSendSms(async () => {
      const error = new Error("Twilio request timeout");
      (error as { code?: string }).code = "ETIMEDOUT";
      throw error;
    });

    const first = await sendSmsWithState({ key, to: "+15550000003", body: "hello" });
    expect(first.outcome).toBe("indeterminate");
    expect(capturedOutboundSms).toEqual([]);

    setFakeSendSms(null);
    const replay = await sendSmsWithState({ key, to: "+15550000003", body: "hello" });
    expect(replay.outcome).toBe("indeterminate");
    expect(capturedOutboundSms).toEqual([]);
  });

  test("confirmed provider 5xx is failed_retryable and a later attempt can send", async () => {
    const key = "unit-retryable";
    setFakeSendSms(async () => {
      throw Object.assign(new Error("service unavailable"), { status: 503 });
    });

    const first = await sendSmsWithState({ key, to: "+15550000004", body: "hello" });
    expect(first.outcome).toBe("failed_retryable");
    expect(capturedOutboundSms).toEqual([]);

    setFakeSendSms(null);
    const retry = await sendSmsWithState({ key, to: "+15550000004", body: "hello" });
    expect(retry.outcome).toBe("sent");
    expect(capturedOutboundSms).toEqual(["hello"]);
  });

  test("a live lease on claimed is not stolen by a second worker", async () => {
    const key = "unit-live-claim";
    await saveSendStateRecord({
      key,
      status: "claimed",
      claimedAt: new Date().toISOString(),
      leaseExpiresAt: futureLeaseIso(),
      attemptCount: 1,
      attemptId: "owner",
      updatedAt: new Date().toISOString(),
    });

    const result = await sendSmsWithState({ key, to: "+15550000005", body: "hello" });
    expect(result.outcome).toBe("skipped_in_progress");
    expect(capturedOutboundSms).toEqual([]);
  });

  test("already sent replays do not call the provider again", async () => {
    const key = "unit-already-sent";
    const first = await sendSmsWithState({ key, to: "+15550000006", body: "hello" });
    expect(first.outcome).toBe("sent");
    const second = await sendSmsWithState({ key, to: "+15550000006", body: "hello" });
    expect(second.outcome).toBe("already_sent");
    expect(capturedOutboundSms).toEqual(["hello"]);
    expect(capturedRedisStore.has(sendStateRedisKey(key))).toBe(true);
  });
});
