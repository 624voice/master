/** Jessica — Vapi web demo assistant (public id, safe in client bundle). */
export const VAPI_ASSISTANT_ID = "14034cb9-f583-4010-b54f-a81177744e01";

/** Max demo call length in seconds (6 minutes). */
export const DEMO_MAX_CALL_SECONDS = 360;

export function getVapiPublicKey(): string | undefined {
  return import.meta.env.VITE_VAPI_PUBLIC_KEY;
}

export function getVapiAssistantId(): string {
  return import.meta.env.VITE_VAPI_ASSISTANT_ID ?? VAPI_ASSISTANT_ID;
}

export function isVapiDemoConfigured(): boolean {
  return Boolean(getVapiPublicKey());
}
