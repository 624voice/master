import type { RunAssessmentResult } from "./runAssessment";

export function buildAssessmentLeadMessage(result: RunAssessmentResult): string {
  const ranked = result.priorityGroups
    .flat()
    .map((d) => `${d.label}:${d.status === "scored" ? d.band : "Needs clarification"}`)
    .join(", ");
  const clarify = result.clarifyGroup
    .map((d) => `${d.label}:Needs clarification`)
    .join(", ");
  const respondBand =
    result.respondSeverity.status === "scored"
      ? result.respondSeverity.band
      : "Needs clarification";
  const parts = [
    `Priority: ${ranked || "none"}`,
    clarify ? `Clarify: ${clarify}` : "",
    `Respond: ${respondBand}`,
    `Provenance: ${result.combinedLabel}`,
  ].filter(Boolean);
  return parts.join(" | ").slice(0, 900);
}
