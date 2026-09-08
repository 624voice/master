import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import type { AgentTurnOutput } from "~/server/speed2Lead/agent/llmTurn";

function source(relativeFromThisFile: string): string {
  return readFileSync(new URL(relativeFromThisFile, import.meta.url), "utf8");
}

describe("rebuilt-agent scheduling boundary", () => {
  test("getActiveProfile fails closed to bookingMode link", () => {
    expect(getActiveProfile().bookingMode).toBe("link");
  });

  test("LLM turn contract has no conversational-scheduling actions or stages", () => {
    const llm = source("./llmTurn.ts");
    expect(llm).toContain('enum: ["discovery", "bridge", "booking_link_pending", "booked", "declined", "handoff"]');
    expect(llm).not.toMatch(/offering_slots/);
    expect(llm).not.toMatch(/confirming/);
    expect(llm).not.toMatch(/confirm_booking/);
    expect(llm).not.toMatch(/slot_choice_index/);
    expect(llm).not.toMatch(/offer_slots|book_slot|confirm_slot/);

    const sample: AgentTurnOutput = {
      reply: "ok",
      stage: "bridge",
      primary_pain: null,
      wants_meeting: true,
      opt_out: false,
      discovery_answer_sufficient: false,
    };
    expect("confirm_booking" in sample).toBe(false);
    expect("slot_choice_index" in sample).toBe(false);
  });

  test("inbound engine does not import or invoke conversational booking", () => {
    const inbound = source("./handleInbound.ts");
    expect(inbound).not.toMatch(/confirmBookSlot|offerSlots|resolveSlotsForAgentTurn/);
    expect(inbound).not.toMatch(/buildContactSchedulingTurnReply|buildDiscoverySchedulingTurnReply/);
    expect(inbound).not.toMatch(/processSchedulingTurn|applyExplicitBookConfirmOutput|validateConfirmBooking/);
    expect(inbound).toContain("executeBookingLinkTransition");
    expect(inbound).toContain("executeBookingLinkResend");
  });

  test("profile type cannot express a conversational booking mode", () => {
    const profile = source("./profile.ts");
    expect(profile).toMatch(/bookingMode:\s*"link"/);
    expect(profile).not.toMatch(/bookingMode:\s*"slots"|bookingMode:\s*"conversational"/);
  });
});
