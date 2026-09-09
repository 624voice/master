import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import { logSmsTranscriptSafely } from "~/server/speed2Lead/transcript";
import { outboundWasAccepted, sendSmsWithState, sendStateKeys } from "~/server/sms/sendState";

export async function sendLifecycleSms(
  phone: string,
  body: string,
  meta: { messageType: string; eventId: string },
): Promise<boolean> {
  const key = sendStateKeys.lifecycle(meta.eventId, meta.messageType);
  try {
    const result = await sendSmsWithState({ key, to: phone, body });
    if (!outboundWasAccepted(result)) {
      if (result.outcome === "indeterminate") {
        logAppointmentEvent("twilio_error", {
          phone,
          messageType: meta.messageType,
          error: `indeterminate:${result.reason}`,
          eventId: meta.eventId,
        });
      }
      return false;
    }
    if (result.outcome === "already_sent") {
      return true;
    }
    logSmsTranscriptSafely({
      direction: "outbound",
      phone,
      body,
      context: null,
    });
    logAppointmentEvent("confirmation_sent", {
      phone,
      messageType: meta.messageType,
      eventId: meta.eventId,
    });
    return true;
  } catch (error) {
    logAppointmentEvent("twilio_error", {
      phone,
      messageType: meta.messageType,
      error: error instanceof Error ? error.message : String(error),
      eventId: meta.eventId,
    });
    throw error;
  }
}
