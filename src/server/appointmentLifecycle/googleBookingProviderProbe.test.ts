import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { resetSpeed2LeadTestPhonesCacheForTests } from "~/server/speed2Lead/testPhoneAllowlist";

const { probeHandsetEquivalentBookProviderSlot } = await import(
  "~/server/appointmentLifecycle/googleBookingProviderProbe"
);

describe("probeHandsetEquivalentBookProviderSlot", () => {
  let bookProviderSlotSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    delete process.env.SPEED2LEAD_TEST_PHONES;
    resetSpeed2LeadTestPhonesCacheForTests();
    const provider = await import("~/server/scheduling/provider");
    bookProviderSlotSpy = spyOn(provider, "bookProviderSlot").mockResolvedValue({
      ok: true,
      eventId: "evt-diagnostic",
      selectedStart: "2026-08-26T14:00:00.000Z",
      replayed: false,
    });
  });

  afterEach(() => {
    mock.restore();
    delete process.env.SPEED2LEAD_TEST_PHONES;
    resetSpeed2LeadTestPhonesCacheForTests();
  });

  test("returns sanitized configuration error when SPEED2LEAD_TEST_PHONES is unset", async () => {
    const result = await probeHandsetEquivalentBookProviderSlot({
      start: "2026-08-26T14:00:00.000Z",
      cleanup: false,
    });

    expect(result.ok).toBe(false);
    expect(result.configurationError).toBe("test_phones_not_configured");
    expect(result.error).toBe("SPEED2LEAD_TEST_PHONES is not configured");
    expect(result.phoneSuffix).toBe("****");
    expect(JSON.stringify(result)).not.toContain("+1");
    expect(bookProviderSlotSpy).toHaveBeenCalledTimes(0);
  });

  test("uses first allowlisted test phone without exposing full number in response", async () => {
    process.env.SPEED2LEAD_TEST_PHONES = "+15551234567,+15559876543";
    resetSpeed2LeadTestPhonesCacheForTests();

    const result = await probeHandsetEquivalentBookProviderSlot({
      start: "2026-08-26T14:00:00.000Z",
      cleanup: false,
    });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("handset_book_provider_slot");
    expect(result.entrypoint).toBe("bookProviderSlot");
    expect(result.phoneSuffix).toBe("4567");
    expect(JSON.stringify(result)).not.toContain("+15551234567");
    expect(bookProviderSlotSpy).toHaveBeenCalledTimes(1);
    expect(bookProviderSlotSpy.mock.calls[0]?.[0]).toMatchObject({
      customer: { phone: "+15551234567" },
      phoneSuffix: "4567",
    });
  });

  test("accepts explicit phone override for handset-equivalent diagnostic", async () => {
    const result = await probeHandsetEquivalentBookProviderSlot({
      start: "2026-08-26T14:00:00.000Z",
      phone: "+15559998888",
      cleanup: false,
    });

    expect(result.ok).toBe(true);
    expect(result.phoneSuffix).toBe("8888");
    expect(bookProviderSlotSpy.mock.calls[0]?.[0]).toMatchObject({
      customer: { phone: "+15559998888" },
      phoneSuffix: "8888",
    });
  });
});
