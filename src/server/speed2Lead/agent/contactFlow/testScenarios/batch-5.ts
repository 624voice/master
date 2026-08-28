import { buildVagueInquiryOpener } from "~/server/speed2Lead/agent/contactFlow/openers";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import type { ContactScenarioBatch } from "~/server/speed2Lead/agent/contactFlow/testScenarios/types";
import { createAgentSession } from "~/server/speed2Lead/agent/state";
import { tomorrowDateKey } from "~/server/speed2Lead/agent/testScenarios/dateUtils";

/** Batch 5 — Chris Aug 27 live-handset transcript regression (allowlisted test handset). */
export function buildContactBatch5(referenceDate = new Date()): ContactScenarioBatch {
  const profile = getActiveProfile();
  const timezone = profile.timezone;
  const tomorrowKey = tomorrowDateKey(referenceDate, timezone);

  const chrisSession = createAgentSession({
    tenantId: profile.tenantId,
    phone: "+12149722278",
    flow: "contact",
    firstName: "test 3",
    businessName: "test 3",
    trade: "Plumbing",
    fleetSize: "2",
    websiteStatus: "has",
    helpTextSummary: "AI for after hours calls",
    formMessage: "test 3",
    inquiryClarity: "vague",
  });

  const chrisOpener = buildVagueInquiryOpener(chrisSession);

  return {
    batchId: "contact-batch-5",
    title: "Contact agent batch 5 — Chris live-handset transcript (Aug 27)",
    scenarios: [
      {
        id: "c23-chris-handset-transcript",
        title: "Full Chris test-3 transcript — discovery, scheduling prefs, 2pm",
        seed: {
          flow: "contact",
          inquiryClarity: "vague",
          firstName: "test 3",
          businessName: "test 3",
          trade: "Plumbing",
          fleetSize: "2",
          helpTextSummary: "AI for after hours calls",
          formMessage: "test 3",
          stage: "discovery",
          messages: [{ role: "assistant", content: chrisOpener }],
        },
        turns: [
          { inbound: "I was wanting to look into ai for handling after hours calls" },
          { inbound: "Not sure, we miss a few calls a week and when we call them back they've moved on" },
          { inbound: "Lets schedule a call" },
          { inbound: "Tomorrow" },
          { inbound: "Tomorrow afternoon" },
          { inbound: "2pm" },
        ],
        expectedChecks: [
          "vagueOpenerGrammar",
          "noOffTopicRedirectOnDiscoveryAnswer",
          "tomorrowAdvancesScheduling",
          "tomorrowAfternoonRetainsDate",
          "twoPmRetainsSchedulingState",
          "noInventedCalendarApology",
        ],
        reviewNotes:
          "Replays Chris Aug 27 handset test 3 on harness phone — bugs 2–4 must stay fixed.",
        meta: { timezone, referenceIso: referenceDate.toISOString(), tomorrowDateKey: tomorrowKey },
        useMockSlots: true,
      },
      {
        id: "c24-resubmit-while-active",
        title: "Resubmitting contact form while session active blocks second opener",
        seed: {
          flow: "contact",
          inquiryClarity: "vague",
          firstName: "test 2",
          businessName: "test 2",
          trade: "Plumbing",
          fleetSize: "2",
          helpTextSummary: "AI help",
          formMessage: "test 2",
          stage: "discovery",
          messages: [{ role: "assistant", content: chrisOpener }],
        },
        turns: [],
        expectedChecks: ["resubmitBlockedWhileActive"],
        reviewNotes:
          "Expected behavior per PR #84 — active non-terminal session blocks duplicate opener; use reset endpoint between manual tests.",
        meta: { timezone },
        mechanicalOnly: true,
      },
    ],
  };
}
