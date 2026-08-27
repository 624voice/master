declare const __SPEED2LEAD_AGENT_V2__: string;
declare const __SPEED2LEAD_LLM_ENABLED__: string;
declare const __SPEED2LEAD_CONTACT_AGENT_V2__: string;

function readBuildTimeFlag(name: "agent" | "llm" | "contactAgent"): boolean {
  try {
    if (name === "agent") return __SPEED2LEAD_AGENT_V2__ === "true";
    if (name === "contactAgent") return __SPEED2LEAD_CONTACT_AGENT_V2__ === "true";
    return __SPEED2LEAD_LLM_ENABLED__ === "true";
  } catch {
    return false;
  }
}

/** Resolve a boolean env flag from runtime process.env or build-time embed. */
export function resolveSpeed2LeadEnvFlag(
  envName: "SPEED2LEAD_AGENT_V2" | "SPEED2LEAD_LLM_ENABLED" | "SPEED2LEAD_CONTACT_AGENT_V2",
): boolean {
  if (process.env[envName] === "true") return true;
  if (envName === "SPEED2LEAD_AGENT_V2") return readBuildTimeFlag("agent");
  if (envName === "SPEED2LEAD_CONTACT_AGENT_V2") return readBuildTimeFlag("contactAgent");
  return readBuildTimeFlag("llm");
}
