import { describe, expect, test } from "bun:test";
import {
  buildDeployVersionInfo,
  deployVersionJson,
  shouldExposeDetailedHealth,
} from "~/server/deployVersion";

describe("deploy version diagnostic", () => {
  test("returns non-sensitive Netlify metadata fields", () => {
    process.env.CONTEXT = "deploy-preview";
    process.env.COMMIT_REF = "4398e7bcd082643bf8e4d8e18a6ff454d23648ad";
    process.env.BRANCH = "cursor/llm-orchestrator-537c";
    process.env.URL = "https://deploy-preview-61--624voice.netlify.app";
    process.env.DEPLOY_ID = "6a8daf520f46590008ca3374";
    process.env.SPEED2LEAD_LLM_ENABLED = "true";
    process.env.SPEED2LEAD_AGENT_V2 = "true";
    process.env.SPEED2LEAD_CONTACT_AGENT_V2 = "true";
    process.env.SPEED2LEAD_DEMO_AGENT_V2 = "true";

    const info = buildDeployVersionInfo(new Date("2026-08-25T18:00:00.000Z"));

    expect(info.gitCommitSha).toBe("4398e7bcd082643bf8e4d8e18a6ff454d23648ad");
    expect(info.branch).toBe("cursor/llm-orchestrator-537c");
    expect(info.deployContext).toBe("deploy-preview");
    expect(info.environment).toBe("preview");
    expect(info.speed2LeadLlmEnabled).toBe(true);
    expect(info.speed2LeadAgentV2Enabled).toBe(true);
    expect(info.speed2LeadContactAgentV2Enabled).toBe(true);
    expect(info.speed2LeadDemoAgentV2Enabled).toBe(true);
    expect(info.deployUrl).toContain("deploy-preview-61");
    expect(JSON.stringify(info)).not.toContain("TWILIO");
    expect(JSON.stringify(info)).not.toContain("OPENAI");
  });

  test("open owner-QA preview returns minimal public health JSON", () => {
    process.env.PHASE2_OWNER_QA_PREVIEW = "1";
    process.env.PHASE2_OWNER_QA_EDGE_BASIC_AUTH_DISABLED = "1";
    process.env.COMMIT_REF = "c6ae9b4ba2b1735bd5849c1e88a18b16c8ec3b01";
    expect(shouldExposeDetailedHealth()).toBe(false);
    expect(deployVersionJson()).toBe('{"status":"ok"}');
  });
});
