import { describe, expect, test } from "bun:test";
import {
  S2L_ATTRIBUTION_END,
  S2L_ATTRIBUTION_START,
  buildAttributionBlock,
  upsertAttributionBlock,
} from "~/server/appointmentLifecycle/calendarMetadata";

const block = buildAttributionBlock({
  brand: "624Voice",
  attributionSource: "multi_touch",
  prospect: "Jane Doe",
  business: "Jane HVAC",
  phone: "+15551234567",
  email: "jane@example.com",
});

describe("calendar metadata upsert", () => {
  test("markers are brand-neutral and Source displays MULTI_TOUCH", () => {
    expect(S2L_ATTRIBUTION_START).toBe("--- S2L ATTRIBUTION START ---");
    expect(S2L_ATTRIBUTION_END).toBe("--- S2L ATTRIBUTION END ---");
    expect(block).toContain("Agent/Brand: 624Voice");
    expect(block).toContain("Source: MULTI_TOUCH");
    expect(block).not.toContain("--- 624");
  });

  test("neither marker → append", () => {
    const result = upsertAttributionBlock("Existing notes", block);
    expect(result.malformed).toBe(false);
    expect(result.description.startsWith("Existing notes")).toBe(true);
    expect(result.description).toContain(S2L_ATTRIBUTION_START);
  });

  test("both markers → replace only the interior", () => {
    const existing = `Keep me\n${S2L_ATTRIBUTION_START}\nSource: ROI\n${S2L_ATTRIBUTION_END}\nKeep me too`;
    const result = upsertAttributionBlock(existing, block);
    expect(result.malformed).toBe(false);
    expect(result.description).toContain("Keep me");
    expect(result.description).toContain("Keep me too");
    expect(result.description).toContain("Source: MULTI_TOUCH");
    expect(result.description).not.toContain("Source: ROI");
  });

  test("only one marker is malformed — append, do not truncate", () => {
    const existing = `Important outside\n${S2L_ATTRIBUTION_START}\npartial`;
    const result = upsertAttributionBlock(existing, block);
    expect(result.malformed).toBe(true);
    expect(result.description).toContain("Important outside");
    expect(result.description).toContain("partial");
    expect(result.description).toContain(S2L_ATTRIBUTION_END);
  });

  test("UNKNOWN display does not imply a lead source rewrite", () => {
    const unknown = buildAttributionBlock({ brand: "624Voice", attributionSource: "unknown" });
    expect(unknown).toContain("Source: UNKNOWN");
  });
});
