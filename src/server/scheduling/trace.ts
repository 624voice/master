import { CONSULTATION_TIMEZONE } from "~/server/appointmentLifecycle/consultationConfig";
import { parseCentralParts } from "~/server/appointmentLifecycle/consultationSlots";
import type {
  OfferPresentationType,
  ResponseSource,
  SchedulingTrace,
  ZeroSlotReason,
} from "~/server/scheduling/types";

export function createEmptyTrace(now: Date): SchedulingTrace {
  const parts = parseCentralParts(now, CONSULTATION_TIMEZONE);
  return {
    centralNow: {
      date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
      time: `${parts.hour}:${String(parts.minute).padStart(2, "0")}`,
      timezone: CONSULTATION_TIMEZONE,
    },
    providerInvoked: false,
    rawProviderSlotCount: 0,
    filteredSlotCount: 0,
    finalOfferedSlotCount: 0,
    finalOfferedSlots: [],
    responseSource: "no_provider",
    offerPresentationType: "none",
    bookingAttempted: false,
    eventIdPresent: false,
  };
}

export function logSchedulingTrace(trace: SchedulingTrace, phoneSuffix?: string): void {
  if (!phoneSuffix) return;
  console.log(
    JSON.stringify({
      component: "schedulingService",
      event: "scheduling_trace",
      at: new Date().toISOString(),
      phoneSuffix: `***${phoneSuffix}`,
      ...trace,
    }),
  );
}

export function inferZeroSlotReason(args: {
  providerInvoked: boolean;
  rawProviderSlotCount: number;
  filteredSlotCount: number;
  providerOk: boolean;
}): ZeroSlotReason | undefined {
  if (!args.providerInvoked) return "never_called";
  if (!args.providerOk) return "provider_error";
  if (args.rawProviderSlotCount === 0) return "provider_empty";
  if (args.filteredSlotCount === 0) return "constraint_filter";
  return undefined;
}

export function inferResponseSource(providerInvoked: boolean, reusedStale: boolean): ResponseSource {
  if (!providerInvoked) return "no_provider";
  if (reusedStale) return "stale_state";
  return "fresh_fetch";
}

export function inferOfferPresentationType(args: {
  slots: string[];
  lastPresentedOfferKey?: string;
  requestKeyChanged: boolean;
}): OfferPresentationType {
  if (args.slots.length === 0) return "no_availability";
  const nextKey = [...args.slots].sort().join("|");
  if (!args.lastPresentedOfferKey) return "first_offer";
  if (args.requestKeyChanged) return "changed_offer";
  if (args.lastPresentedOfferKey === nextKey) return "repeat_offer";
  return "changed_offer";
}
