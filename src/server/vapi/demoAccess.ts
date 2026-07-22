import { createServerFn } from "@tanstack/react-start";
import {
  canStartVoiceDemo,
  markVoiceDemoUsed,
} from "~/server/vapi/demoUsage";

type DemoIdentity = {
  email: string;
  phone: string;
};

export const checkDemoEligibility = createServerFn({ method: "POST" })
  .validator((data: DemoIdentity) => data)
  .handler(async ({ data }) => {
    const allowed = await canStartVoiceDemo(data.email, data.phone);
    return { allowed };
  });

export const recordDemoCallStart = createServerFn({ method: "POST" })
  .validator((data: DemoIdentity) => data)
  .handler(async ({ data }) => {
    await markVoiceDemoUsed(data.email, data.phone);
    return { ok: true as const };
  });
