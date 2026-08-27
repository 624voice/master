/**
 * Cutover switch for the rebuilt agent. Kept as a single flag in one place
 * so the old and new engines can run side by side during validation: new
 * ROI leads go to whichever engine this returns, while any conversation
 * already in flight under the old engine keeps working unchanged (the
 * inbound webhook routes by which session actually exists for that phone).
 */
export function isSpeed2LeadAgentV2Enabled(): boolean {
  return process.env.SPEED2LEAD_AGENT_V2 === "true";
}
