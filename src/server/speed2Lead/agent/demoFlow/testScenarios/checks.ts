import { buildDemoNoResponseMessage0 } from "~/server/speed2Lead/agent/demoFlow/noResponseCampaign";
import { getActiveProfile } from "~/server/speed2Lead/agent/profile";
import { createAgentSession } from "~/server/speed2Lead/agent/state";
import { isOptedOut } from "~/server/speed2Lead/session";
import type { DemoCheckContext } from "~/server/speed2Lead/agent/demoFlow/testScenarios/types";

function lastAssistant(transcript: DemoCheckContext["transcript"]): string {
  const messages = [...transcript].reverse();
  return messages.find((m) => m.role === "assistant")?.content ?? "";
}

function allAssistant(transcript: DemoCheckContext["transcript"]): string[] {
  return transcript.filter((m) => m.role === "assistant").map((m) => m.content);
}

export async function isPhoneOptedOut(phone: string): Promise<boolean> {
  return isOptedOut(phone);
}

export function runDemoMechanicalChecks(
  checkId: string,
  ctx: DemoCheckContext,
): { pass: boolean; detail: string } {
  switch (checkId) {
    case "fullOpenerShape": {
      const opener = ctx.seed.messages[0]?.content ?? "";
      const pass =
        opener.includes("Saw you just finished trying Jessica") &&
        opener.includes("what stood out most");
      return { pass, detail: opener.slice(0, 120) };
    }
    case "shortOpenerShape": {
      const opener = ctx.seed.messages[0]?.content ?? "";
      const pass =
        opener.includes("cut out early") &&
        opener.includes("fresh link");
      return { pass, detail: opener.slice(0, 120) };
    }
    case "stopOptedOut": {
      return { pass: true, detail: "verified async in harness" };
    }
    case "crossFlowBlockedSecondOpener": {
      return {
        pass: ctx.crossFlowBlocked === true,
        detail: ctx.crossFlowBlocked ? "blocked" : "not blocked",
      };
    }
    case "missingSummaryStillHasOpener": {
      const pass = ctx.seed.demoSummary == null && ctx.seed.messages.length > 0;
      return { pass, detail: `messages=${ctx.seed.messages.length}` };
    }
    case "injectionRedirect": {
      const reply = lastAssistant(ctx.transcript);
      const pass = reply.toLowerCase().includes("624voice") && !reply.toLowerCase().includes("system prompt");
      return { pass, detail: reply.slice(0, 120) };
    }
    case "offTopicRedirect": {
      const reply = lastAssistant(ctx.transcript);
      const pass = reply.toLowerCase().includes("demo") || reply.toLowerCase().includes("scheduling");
      return { pass, detail: reply.slice(0, 120) };
    }
    case "discoveryCapAtTwo": {
      const count = ctx.finalSession?.discoveryQuestionCount ?? 0;
      const pass = count <= 2;
      return { pass, detail: `discoveryQuestionCount=${count}` };
    }
    case "enteredScheduling": {
      const stage = ctx.finalSession?.stage;
      const pass = stage === "offering_slots" || stage === "confirming" || stage === "booked";
      return { pass, detail: `stage=${stage}` };
    }
    case "fakeDemoBookingNotRealBooked": {
      const pass = ctx.finalSession?.stage !== "booked" || Boolean(ctx.finalSession?.bookedStartIso);
      return {
        pass,
        detail: `stage=${ctx.finalSession?.stage} bookedStartIso=${ctx.finalSession?.bookedStartIso ?? "none"}`,
      };
    }
    case "noResponseStage0Copy": {
      const session = createAgentSession({
        tenantId: getActiveProfile().tenantId,
        phone: ctx.phone,
        flow: "demo",
        firstName: ctx.seed.firstName,
        businessName: ctx.seed.businessName,
      });
      const copy = buildDemoNoResponseMessage0(getActiveProfile(), session);
      const pass = copy.includes("trying Jessica earlier");
      return { pass, detail: copy.slice(0, 120) };
    }
    case "declineTerminal": {
      const pass = ctx.finalSession?.stage === "declined";
      return { pass, detail: `stage=${ctx.finalSession?.stage}` };
    }
    case "contextualBridge": {
      const reply = lastAssistant(ctx.transcript);
      const business = ctx.seed.businessName.toLowerCase();
      const pass =
        reply.toLowerCase().includes("jessica") ||
        reply.toLowerCase().includes(business) ||
        reply.toLowerCase().includes("difference") ||
        reply.toLowerCase().includes("handling");
      return { pass, detail: reply.slice(0, 120) };
    }
    case "pricingScopedAnswer": {
      const reply = lastAssistant(ctx.transcript);
      const pass =
        reply.toLowerCase().includes("depends") ||
        reply.toLowerCase().includes("volume") ||
        reply.toLowerCase().includes("setup");
      return { pass, detail: reply.slice(0, 120) };
    }
    default:
      return { pass: false, detail: `unknown check ${checkId}` };
  }
}

export function transcriptContainsQuestionAbout(transcript: DemoCheckContext["transcript"], needle: string): boolean {
  return allAssistant(transcript).some((body) => body.toLowerCase().includes(needle.toLowerCase()));
}
