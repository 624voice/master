import { DEMO_MAX_CALL_SECONDS, VAPI_ASSISTANT_ID } from "~/config/vapi";

export { DEMO_MAX_CALL_SECONDS, VAPI_ASSISTANT_ID };

export function getVapiAssistantId(): string {
  return process.env.VITE_VAPI_ASSISTANT_ID ?? VAPI_ASSISTANT_ID;
}
