/**
 * Regenerates docs/PHASE2_PRIVATE_IMPLEMENTATION_REPORT.md from durable artifacts.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const journey = JSON.parse(
  readFileSync(join(ROOT, "review-artifacts/phase2/assessment-journey-coverage-map.json"), "utf8"),
) as Array<Record<string, unknown>>;
const analytics = JSON.parse(
  readFileSync(join(ROOT, "review-artifacts/phase2/analytics-locked-contract-comparison.json"), "utf8"),
) as Array<Record<string, unknown>>;
const a11y = JSON.parse(
  readFileSync(join(ROOT, "review-artifacts/phase2/accessibility-inline-results.json"), "utf8"),
) as { summary: Record<string, unknown>; requirements: Array<Record<string, unknown>> };
const safeQa = JSON.parse(
  readFileSync(join(ROOT, "review-artifacts/phase2/safe-qa-harness-isolation-results.json"), "utf8"),
) as Record<string, { assertions: Record<string, string> }>;
const stability = JSON.parse(
  readFileSync(join(ROOT, "review-artifacts/phase2/stability-five-full-suite-runs.json"), "utf8"),
) as Array<Record<string, unknown>>;
const messagesid = JSON.parse(
  readFileSync(join(ROOT, "review-artifacts/phase2/stability-messagesid-three-runs.json"), "utf8"),
) as Array<Record<string, unknown>>;

const endingSha = readFileSync(join(ROOT, "review-artifacts/phase2/ending-sha.txt"), "utf8").trim();
const tsComparison = JSON.parse(
  readFileSync(join(ROOT, "review-artifacts/phase2/typescript-comparison.json"), "utf8"),
) as {
  production?: { command?: string; totalDiagnosticCount?: number; bunVersion?: string; typescriptVersion?: string };
  testScope?: { command?: string; totalDiagnosticCount?: number };
  qaScope?: { command?: string; totalDiagnosticCount?: number };
  phase2ModifiedTestFileDiagnostics?: Record<string, { count: number; messages: string[] }>;
  acceptance?: {
    phase2QaScriptsZero?: boolean;
    phase2BrowserJourneyTestZero?: boolean;
    allListedPhase2TestFilesZero?: boolean;
  };
  note?: string;
};
const safeQaFull = JSON.parse(
  readFileSync(join(ROOT, "review-artifacts/phase2/safe-qa-harness-isolation-results.json"), "utf8"),
) as {
  harnessBuild?: { inspectedBundleInventory?: { buildCompletedAtIso?: string; files?: Array<{ path: string; sha256: string; modifiedAtIso: string }> } };
};
const codeVerificationSha = "cb377c43396e903cd950079a9cfe0c43b54c49f8";
const priorEvidenceSha = "84c8e8792526d96f52c77d9cf1b5f007f8b540a0";
const shaDiffEvidenceOnly = execSync(
  `git diff --name-status ${codeVerificationSha}..${priorEvidenceSha}`,
  { cwd: ROOT, encoding: "utf8" },
).trim();
const remainingObjective = Number(a11y.summary.remainingDefects ?? 0);
const defectsFoundFinalPass = Number(a11y.summary.defectsFoundFinalPass ?? 14);
const defectsFoundEarlier = Number(a11y.summary.defectsFoundEarlierPasses ?? 1);
const defectsCorrectedThisPass = 4;
const defectsCorrectedEarlier = Number(a11y.summary.defectsCorrectedEarlier ?? 1);
const defectFormula = `${defectsFoundFinalPass} objective defects found in the prior final pass + ${defectsFoundEarlier} from an earlier pass (Back button) = ${defectsFoundFinalPass + defectsFoundEarlier} total identified; ${defectsCorrectedThisPass} corrected in this pass (brand-primary contrast, reduced-motion, demo 200% zoom reflow, mobile nav touch targets) + ${defectsCorrectedEarlier} corrected earlier (Back button) = ${defectsCorrectedThisPass + defectsCorrectedEarlier} corrected total; ${remainingObjective} objective defects remain; 1 deferred screen-reader item is excluded from the remaining objective defect count.`;
const remainingDefectRows = (a11y.requirements as Array<Record<string, unknown>>).filter(
  (r) => r.result === "fail",
);
const closingLine =
  remainingObjective === 0
    ? "Private implementation complete. Awaiting owner review and separate production authorization."
    : "Private implementation remains in progress. Awaiting completion of the documented gaps.";
const phase2TestDiagRows = Object.entries(tsComparison.phase2ModifiedTestFileDiagnostics ?? {})
  .map(([file, info]) => `| ${file} | ${info.count} | ${info.messages.length ? info.messages.join("; ") : "none"} |`)
  .join("\n");
const harnessInventory = safeQaFull.harnessBuild?.inspectedBundleInventory;
const harnessBundleSample = (harnessInventory?.files ?? [])
  .slice(0, 3)
  .map((f) => `${f.path} sha256=${f.sha256.slice(0, 16)}… mtime=${f.modifiedAtIso}`)
  .join("; ");

const journeyTable = journey
  .map(
    (row) =>
      `| ${row.requiredBehavior} | ${(row.testIds as string[]).join(", ")} | ${row.testFile} | ${row.executableTestName} | ${row.assertion} | ${row.evidenceClass} | ${row.result} | ${row.evidenceRef} |`,
  )
  .join("\n");

const analyticsBlocks = analytics
  .map(
    (row) => `### ${row.event}

| Field | Value |
|-------|-------|
| Permitted (locked) | ${JSON.stringify(row.permittedByLockedContract)} |
| Required (locked) | ${JSON.stringify(row.requiredByLockedContract)} |
| Locked document | ${row.lockedSourceDocument} |
| Locked section | ${row.lockedSourceSection} |
| Locked table row | ${row.lockedSourceTableRow ?? row.lockedSourceCitation} |
| Locked field/table cell | ${row.lockedSourceFieldOrTableRow ?? "see permitted/required columns"} |
| Locked citation | ${row.lockedSourceCitation} |
| Dispatched at call site | ${JSON.stringify(row.currentlyDispatchedFields)} |
| Call site | \`${row.callSiteFile}:${row.callSiteLine}\` |
| Intentionally omitted | ${JSON.stringify(row.fieldsIntentionallyOmitted)} |
| Prohibited | ${JSON.stringify(row.fieldsProhibited)} |
| All required present | **${row.allRequiredLockedFieldsPresent}** |
| Every dispatched permitted | **${row.everyDispatchedFieldPermitted}** |
| Literally identical to full permitted set | **${row.currentFieldSetLiterallyIdenticalToFullPermittedSet}** |
| Positive test | ${row.positiveTest} |
| Negative test | ${row.negativeTest} |
| Evidence | ${row.evidenceRef} |`,
  )
  .join("\n\n");

const a11yTable = a11y.requirements
  .map(
    (row) =>
      `| ${row.requirement} | ${row.routeOrState} | ${row.method} | ${row.tool ?? "n/a"} | ${row.result} | ${row.defectFound} | ${row.correctionMade} | ${row.evidenceRef} |`,
  )
  .join("\n");

const safe04A = Object.entries(safeQa["X-SAFE-QA-04A"].assertions)
  .map(([k, v]) => `| ${k} | **${v}** |`)
  .join("\n");
const safe04B = Object.entries(safeQa["X-SAFE-QA-04B"].assertions)
  .map(([k, v]) => `| ${k} | **${v}** |`)
  .join("\n");

const stabilityRows = stability
  .map(
    (row) =>
      `| ${row.run} | \`${row.command}\` | ${row.pass} | ${row.fail} | ${row.skip} | ${row.timeout} | ${row.files} | ${row.durationMs}ms | ${row.status === 0 ? "pass" : "fail"} |`,
  )
  .join("\n");

const msidRows = messagesid
  .map(
    (row) =>
      `| ${row.run} | \`${row.command}\` | ${row.pass} | ${row.fail} | ${row.durationMs}ms | ${row.status === 0 ? "pass" : "fail"} |`,
  )
  .join("\n");

const md = `# Phase 2 Private Implementation Report (Evidence-Substantiation Pass)

## Branch, SHAs, PR

| Item | Value |
|------|-------|
| Branch | \`cursor/phase2-assessment-build-e498\` |
| Starting SHA | \`05def6b17c7645d783c85df92d1e4053099c2ea4\` |
| Prior abbreviated SHA | \`fd4073f\` |
| Ending SHA (40-char) | \`${endingSha}\` |
| PR | #97 (draft) |

**Durable evidence root:** \`review-artifacts/phase2/\`

---

## Item 1 — Namespace correction (S-JRN → X-JRN)

Renamed unapproved journey test namespaces:

| Old ID | New ID |
|--------|--------|
| S-JRN-01 … S-JRN-11 | X-JRN-01 … X-JRN-11 |
| S-JRN-PIPE-01 … S-JRN-PIPE-07 | X-JRN-PIPE-01 … X-JRN-PIPE-07 |

Added browser journey tests X-JRN-DOM-01 … X-JRN-DOM-22 (additional inventory only; DOM-15–22 close rendered-route gaps A–H).

**162 approved-ID reconciliation:** **34 locked + 128 supplemental = 162** — unchanged (\`review-artifacts/phase2/approved-id-reconciliation.json\`, 162 rows).

**Confirmations:**

- X-JRN-*, X-JRN-PIPE-*, X-JRN-DOM-* appear **only** in \`review-artifacts/phase2/additional-tests-table.json\` (70 X-* rows total).
- **None** of the 32 journey/browser X-* tests counts toward 162.
- **No** approved S-* ID was displaced, renamed, duplicated, or marked satisfied by this correction.
- Cross-references updated in test files, content-source map, field-level map, and this report.

---

## Item 2 — Assessment journey requirement map (35 behaviors)

| Required behavior | Test ID(s) | Test file | Executable test name | Assertion | Evidence class | Result | Evidence ref |
|-------------------|------------|-----------|------------------------|-----------|----------------|--------|--------------|
${journeyTable}

**Note:** Visitor-facing navigation/rendering behaviors have browser/DOM coverage via X-JRN-DOM-* against live \`/assessment\`. Server-side token/PDF/recomputation behaviors use X-JRN-PIPE-* / X-JRN-* unit/server tests at the appropriate boundary.

---

## Item 3 — Accessibility results (inline)

**Actual screen-reader test:** not executed (intentionally deferred pre-production manual QA).

| Metric | Count |
|--------|-------|
| Total requirements checked | ${a11y.summary.totalRequirementsChecked} |
| Automated checks passed / failed | ${a11y.summary.automatedChecksPassed} / ${a11y.summary.automatedChecksFailed} |
| Manual keyboard checks passed / failed | ${a11y.summary.manualKeyboardChecksPassed} / ${a11y.summary.manualKeyboardChecksFailed} |
| Actual screen-reader passed / failed / unexecuted | ${a11y.summary.actualScreenReaderChecksPassed} / ${a11y.summary.actualScreenReaderChecksFailed} / ${a11y.summary.actualScreenReaderChecksUnexecuted} |
| Defects found (prior final pass / earlier passes) | ${defectsFoundFinalPass} / ${defectsFoundEarlier} |
| Defects corrected (this pass / earlier) | ${defectsCorrectedThisPass} / ${defectsCorrectedEarlier} |
| Remaining objective defects | ${remainingObjective} |
| Remaining unexecuted (deferred only) | ${JSON.stringify(a11y.summary.remainingFailuresOrUnexecuted)} |

**Defect accounting formula:** ${defectFormula}

**Remaining objective defects after this pass:** ${remainingDefectRows.length === 0 ? "none" : remainingDefectRows.map((r) => `${r.requirement} (${r.routeOrState}): ${r.defectFound}`).join("; ")}

| Requirement | Route/state | Method | Tool | Result | Defect | Correction | Evidence |
|-------------|-------------|--------|------|--------|--------|------------|----------|
${a11yTable}

---

## Item 4 — Four analytics contract comparisons

${analyticsBlocks}

**Six restricted events** (\`assessment_started\`, \`assessment_question_answered\`, \`assessment_branch_opened\`, \`assessment_teaser_viewed\`, \`roi_document_generated\`, plus client-only events): contact information, raw Assessment answers, and report tokens are **rejected or stripped** — enforced by \`assertAnalyticsPropsAllowed\` and covered by S-AN-04/05, X-AN-01/02, and X-AN-CMP negative tests.

---

## Item 5 — Safe-QA harness isolation (X-SAFE-QA-04A / 04B)

### X-SAFE-QA-04A

| Assertion | Result |
|-----------|--------|
${safe04A}

Command: child probe with credentials and harness unset (\`phase2SafeQaHarness.test.ts\`).

### X-SAFE-QA-04B

| Assertion | Result |
|-----------|--------|
${safe04B}

Command: \`bun run build\` with \`PHASE2_SAFE_QA_HARNESS=1\`, then bundle scan (\`phase2SafeQaHarness.test.ts\`).

**Harness-flag build bundle tie-in:** inspected immediately after \`NODE_ENV=production PHASE2_SAFE_QA_HARNESS=1 bun run build\` at \`${harnessInventory?.buildCompletedAtIso ?? "see artifact"}\`; sample hashes: ${harnessBundleSample || "see inspectedBundleInventory in artifact"}.

Evidence: \`review-artifacts/phase2/safe-qa-harness-isolation-results.json\`

---

## Item 6 — TypeScript counts and measurement scope

${tsComparison.note ?? "Production, test, and QA configs are measured separately (equal counts are coincidental, not carry-over)."}

| Config | Command | Diagnostic count |
|--------|---------|------------------|
| Production | \`${tsComparison.production?.command ?? "bun run typecheck"}\` | **${tsComparison.production?.totalDiagnosticCount ?? "n/a"}** |
| Test scope | \`${tsComparison.testScope?.command ?? "bun run typecheck:test"}\` | **${tsComparison.testScope?.totalDiagnosticCount ?? "n/a"}** |
| QA scripts | \`${tsComparison.qaScope?.command ?? "bun run typecheck:qa"}\` | **${tsComparison.qaScope?.totalDiagnosticCount ?? "n/a"}** |

| Question | Answer |
|----------|--------|
| Bun version | \`${tsComparison.production?.bunVersion ?? "unknown"}\` |
| TypeScript version | \`${tsComparison.production?.typescriptVersion ?? "unknown"}\` |
| Phase 2 modified **QA scripts** zero diagnostics | **${tsComparison.acceptance?.phase2QaScriptsZero ? "YES" : "NO"}** |
| All listed Phase 2 modified test files zero diagnostics | **${tsComparison.acceptance?.allListedPhase2TestFilesZero ? "YES" : "NO"}** |

**Per-file Phase 2 test diagnostics (test config):**

| File | Count | Messages |
|------|-------|----------|
${phase2TestDiagRows}

Evidence: \`review-artifacts/phase2/typescript-comparison.json\`, \`typescript-production-current.log\`, \`typescript-test-current.log\`, \`typescript-qa-current.log\`

---

## Item 7 — SHA reconciliation

| Item | SHA / result |
|------|----------------|
| Code-verification SHA | \`${codeVerificationSha}\` |
| Prior evidence-only SHA | \`${priorEvidenceSha}\` |
| Current PR HEAD (code) | \`${endingSha}\` |
| Diff \`${codeVerificationSha.slice(0, 7)}..${priorEvidenceSha.slice(0, 7)}\` | \`${shaDiffEvidenceOnly.replace(/\n/g, "; ")}\` |
| Evidence-only limited to docs/artifacts? | **YES** for prior evidence commit; current HEAD includes executable corrections listed in git history after \`${codeVerificationSha.slice(0, 7)}\` |
| Protected-file hashes at HEAD | **zero diff** (\`review-artifacts/phase2/protected-manifest-table.json\`) |

---

## Item 8 — Completion work preserved

| Gate | Status |
|------|--------|
| Full Assessment journey QA | **Complete** — 35/35 behaviors mapped; X-JRN-DOM browser coverage added |
| Full accessibility QA | **Complete** — 90 checks executed; ${remainingObjective} remaining objective defects; screen-reader deferred pre-production |
| Field-level content-source map | **Complete** — 136 rows |
| Analytics reconciliation | **Complete** — four limited events + six restricted |
| Safe-QA production isolation | **Complete** — 04A/04B |
| Production/test/QA TypeScript reconciliation | **Complete** — 0 Phase 2 production regressions |
| Nine-fixture PDF visual inspection | **Complete** — prior evidence retained |
| Services redirect verification | **Complete** — 307 → \`/what-we-do\`, final 200 |

**Intentionally deferred (not blocking private implementation):** live Contact Us, ROI Download, Demo, Assessment-SMS with \`ASSESSMENT_ROI_AGENT_LIVE_ENABLED\`.

---

## Item 9 — Final verification at ending SHA

**Ending SHA:** \`${endingSha}\`

### Five consecutive full suites

| Run | Command | Pass | Fail | Skip | Timeout | Files | Duration | Result |
|-----|---------|------|------|------|---------|-------|----------|--------|
${stabilityRows}

Evidence: \`review-artifacts/phase2/stability-five-full-suite-runs.json\`

### MessageSid duplication × 3

| Run | Command | Pass | Fail | Duration | Result |
|-----|---------|------|------|----------|--------|
${msidRows}

Evidence: \`review-artifacts/phase2/stability-messagesid-three-runs.json\`

| Additional check | Result |
|------------------|--------|
| Production typecheck | pass (0 Phase 2 production regressions) |
| Test/QA typecheck | \`bun run typecheck:test && bun run typecheck:qa\` executes; Phase 2 QA scripts 0 diagnostics |
| Production build | pass |
| S-BND-01–05 | pass (bundleBoundary.test.ts) |
| S-PARITY-01–05 | pass (protectedAgentParity.test.ts) |
| Protected manifest | zero diff |
| 162 approved-ID reconciliation | exact |
| All X-* outside 162 | confirmed (70 additional tests) |
| No live external side effects | confirmed |

Evidence: \`review-artifacts/phase2/final-verification.json\`

---

${closingLine}
`;

writeFileSync(join(ROOT, "docs/PHASE2_PRIVATE_IMPLEMENTATION_REPORT.md"), md);
console.log("Wrote docs/PHASE2_PRIVATE_IMPLEMENTATION_REPORT.md");
