declare const __SPEED2LEAD_AGENT_V2__: string;
declare const __SPEED2LEAD_LLM_ENABLED__: string;

function readBuildTimeFlag(name: "agent" | "llm"): boolean {
  try {
    if (name === "agent") return __SPEED2LEAD_AGENT_V2__ === "true";
    return __SPEED2LEAD_LLM_ENABLED__ === "true";
  } catch {
    return false;
  }
}

/** Resolve a boolean env flag from runtime process.env or build-time embed. */
export function resolveSpeed2LeadEnvFlag(
  envName: "SPEED2LEAD_AGENT_V2" | "SPEED2LEAD_LLM_ENABLED",
): boolean {
  if (process.env[envName] === "true") return true;
  if (envName === "SPEED2LEAD_AGENT_V2") return readBuildTimeFlag("agent");
  return readBuildTimeFlag("llm");
}
