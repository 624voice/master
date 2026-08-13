import { logAppointmentEvent } from "~/server/appointmentLifecycle/log";
import { logSmsTranscriptSafely } from "~/server/speed2Lead/transcript";
import { sendSms } from "~/server/sms/twilio";

export async function sendLifecycleSms(
  phone: string,
  body: string,
  meta?: { messageType?: string; eventId?: string },
): Promise<void> {
  try {
    await sendSms(phone, body);
    logSmsTranscriptSafely({
      direction: "outbound",
      phone,
      body,
      context: null,
    });
    logAppointmentEvent("confirmation_sent", {
      phone,
      messageType: meta?.messageType,
      eventId: meta?.eventId,
    });
  } catch (error) {
    logAppointmentEvent("twilio_error", {
      phone,
      messageType: meta?.messageType,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
