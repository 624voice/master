/**
 * Field-level visitor-facing copy source map.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ASSESSMENT_QUESTIONS, DIMENSION_LABELS } from "../../src/lib/assessment/questions";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(REPO_ROOT, "review-artifacts/phase2/content-source-map-field-level.json");

type Row = {
  copyUnit: string;
  exactStringOrMetadata: string;
  authoritativeSourceDocument: string;
  sourceSectionAndField: string;
  destinationFile: string;
  featureFlagOrGate: string;
  status: string;
  verificationEvidence: string;
};

const rows: Row[] = [];

function add(row: Omit<Row, "status"> & { status?: string }): void {
  rows.push({ status: "implemented", ...row, status: row.status ?? "implemented" });
}

function readRouteMeta(routeFile: string): { title: string; description: string } {
  const source = readFileSync(join(REPO_ROOT, routeFile), "utf8");
  const title = source.match(/title:\s*["'`]([^"'`]+)["'`]/)?.[1] ?? "";
  const description =
    source.match(/description:\s*["'`]([^"'`]+)["'`]/)?.[1] ?? "";
  return { title, description };
}

const routeMetaFiles: Array<[string, string, string]> = [
  ["/", "src/routes/index.tsx", "624VoiceHomepageCopy-v2.1-EXTRACTED.txt §2"],
  ["/what-we-do", "src/routes/what-we-do.tsx", "624VoiceWebsiteContentPhase2Final-EXTRACTED.txt §4"],
  ["/how-we-work", "src/routes/how-we-work.tsx", "624VoiceWebsiteContentPhase2Final-EXTRACTED.txt §5"],
  ["/demo", "src/routes/demo.tsx", "624VoiceWebsiteContentPhase2Final-EXTRACTED.txt §6"],
  ["/about", "src/routes/about.tsx", "624VoiceWebsiteContentPhase2Final-EXTRACTED.txt §7"],
  ["/contact", "src/routes/contact.tsx", "Phase 2Final contact copy (pre-existing)"],
  ["/assessment", "src/routes/assessment.tsx", "Phase2Final Assessment UX §Assessment intro"],
];

for (const [route, file, doc] of routeMetaFiles) {
  const meta = readRouteMeta(file);
  if (meta.title) {
    add({
      copyUnit: `${route} SEO title`,
      exactStringOrMetadata: meta.title,
      authoritativeSourceDocument: doc,
      sourceSectionAndField: "head.title",
      destinationFile: file,
      featureFlagOrGate: "none",
      verificationEvidence: `readRouteMeta ${file}`,
    });
  }
  if (meta.description) {
    add({
      copyUnit: `${route} SEO description`,
      exactStringOrMetadata: meta.description,
      authoritativeSourceDocument: doc,
      sourceSectionAndField: "head.description",
      destinationFile: file,
      featureFlagOrGate: "none",
      verificationEvidence: `readRouteMeta ${file}`,
    });
  }
}

const assessmentIntro = readFileSync(join(REPO_ROOT, "src/routes/assessment.tsx"), "utf8");
const h1 = assessmentIntro.match(/Find Your[\s\S]*?Top Priorities/)?.[0] ?? "";
add({
  copyUnit: "Assessment introduction H1",
  exactStringOrMetadata: h1.replace(/\s+/g, " "),
  authoritativeSourceDocument: "Phase2Final Assessment UX",
  sourceSectionAndField: "Assessment intro hero",
  destinationFile: "src/routes/assessment.tsx",
  featureFlagOrGate: "none",
  verificationEvidence: "S-JRN-01, safe-qa assessment-01-start.png",
});

for (const question of ASSESSMENT_QUESTIONS) {
  add({
    copyUnit: `Assessment question ${question.id}`,
    exactStringOrMetadata: question.text,
    authoritativeSourceDocument: "Phase2Final Assessment question bank",
    sourceSectionAndField: `Question ${question.id}.text`,
    destinationFile: "src/lib/assessment/questions.ts",
    featureFlagOrGate: "none",
    verificationEvidence: `questions.ts ASSESSMENT_QUESTIONS id=${question.id}`,
  });
  for (const choice of question.choices) {
    add({
      copyUnit: `Assessment ${question.id} option`,
      exactStringOrMetadata: choice.label,
      authoritativeSourceDocument: "Phase2Final Assessment question bank",
      sourceSectionAndField: `Question ${question.id} choice score=${choice.score}`,
      destinationFile: "src/lib/assessment/questions.ts",
      featureFlagOrGate: "none",
      verificationEvidence: `questions.ts choice label`,
    });
  }
}

add({
  copyUnit: "Assumptions-review heading",
  exactStringOrMetadata: "Review your respond assumptions",
  authoritativeSourceDocument: "Phase2Final Assessment UX §Respond review",
  sourceSectionAndField: "RespondAssumptionsReview heading",
  destinationFile: "src/components/assessment/RespondAssumptionsReview.tsx",
  featureFlagOrGate: "none",
  verificationEvidence: "S-CMP-06",
});

add({
  copyUnit: "Lead gate heading",
  exactStringOrMetadata: "Unlock your full assessment results",
  authoritativeSourceDocument: "Phase2Final Assessment UX §Lead gate",
  sourceSectionAndField: "AssessmentGate h2",
  destinationFile: "src/components/assessment/AssessmentGate.tsx",
  featureFlagOrGate: "REQUIRE_LEAD_FOR_RESULTS (true)",
  verificationEvidence: "S-CMP-01",
});

for (const [field, label] of [
  ["gate-first-name", "First name"],
  ["gate-last-name", "Last name"],
  ["gate-business", "Business name"],
  ["gate-email", "Email"],
  ["gate-phone", "Phone number"],
] as const) {
  add({
    copyUnit: `Lead gate label ${label}`,
    exactStringOrMetadata: label,
    authoritativeSourceDocument: "Phase2Final Assessment UX §Lead gate F.1",
    sourceSectionAndField: `label for=${field}`,
    destinationFile: "src/components/assessment/AssessmentGate.tsx",
    featureFlagOrGate: "none",
    verificationEvidence: "AssessmentGate.tsx label scan",
  });
}

add({
  copyUnit: "SMS consent copy",
  exactStringOrMetadata:
    "I agree to receive text messages from 624 Voice about my assessment results. Message and data rates may apply. Reply STOP to opt out.",
  authoritativeSourceDocument: "Phase2Final Assessment UX §SMS consent",
  sourceSectionAndField: "AssessmentGate smsConsent span",
  destinationFile: "src/components/assessment/AssessmentGate.tsx",
  featureFlagOrGate: "ASSESSMENT_ROI_AGENT_LIVE_ENABLED (false in private impl)",
  verificationEvidence: "S-CMP-08, S-JRN-PIPE-03",
});

for (const [msg, gate] of [
  ["First name is required.", "validateLeadInfo"],
  ["Enter a valid email address.", "validateLeadInfo"],
  ["Enter a valid phone number.", "validateLeadInfo"],
  ["Could not submit your assessment. Please try again.", "assessment.tsx catch"],
] as const) {
  add({
    copyUnit: `Validation or failure message: ${msg.slice(0, 32)}…`,
    exactStringOrMetadata: msg,
    authoritativeSourceDocument: "Phase2Final Assessment UX §Validation",
    sourceSectionAndField: gate,
    destinationFile: gate.includes("tsx") ? "src/routes/assessment.tsx" : "src/lib/lead/validateLead.ts",
    featureFlagOrGate: "none",
    verificationEvidence: "S-JRN-PIPE-01, S-JRN-PIPE-07",
  });
}

add({
  copyUnit: "Results disclaimer",
  exactStringOrMetadata:
    "This Assessment is directional and based on the information you provided. It is a starting point, not a full operational diagnosis. A paid AI Revenue and Operations Diagnostic is used only when a deeper review is warranted.",
  authoritativeSourceDocument: "Phase2Final Assessment results §Disclaimer",
  sourceSectionAndField: "AssessmentResults DISCLAIMER",
  destinationFile: "src/components/assessment/AssessmentResults.tsx",
  featureFlagOrGate: "none",
  verificationEvidence: "S-CMP-10, S-PDF-03",
});

add({
  copyUnit: "Invalid/expired report token message",
  exactStringOrMetadata: "This assessment report link has expired or is invalid.",
  authoritativeSourceDocument: "Phase2Final token PDF route",
  sourceSectionAndField: "serveAssessmentTokenPdf 404 body",
  destinationFile: "src/server/report/serveAssessmentTokenPdf.server.ts",
  featureFlagOrGate: "none",
  verificationEvidence: "S-JRN-PIPE-06",
});

add({
  copyUnit: "Services redirect destination",
  exactStringOrMetadata: "/what-we-do (307/302 redirect from /services)",
  authoritativeSourceDocument: "Phase2Final route table",
  sourceSectionAndField: "services.tsx beforeLoad redirect",
  destinationFile: "src/routes/services.tsx",
  featureFlagOrGate: "none",
  verificationEvidence: "services-redirect-evidence.json",
});

const navSource = readFileSync(join(REPO_ROOT, "src/routes/__root.tsx"), "utf8");
for (const label of ["What We Do", "How We Work", "Demo", "About", "Contact", "Assessment"]) {
  if (navSource.includes(label)) {
    add({
      copyUnit: `Desktop/mobile nav label: ${label}`,
      exactStringOrMetadata: label,
      authoritativeSourceDocument: "Phase2Final nav labels",
      sourceSectionAndField: "Header navigation",
      destinationFile: "src/routes/__root.tsx",
      featureFlagOrGate: "none",
      verificationEvidence: "safe-qa screenshots, supplementalPublicCopy.test.ts",
    });
  }
}

add({
  copyUnit: "404 page copy",
  exactStringOrMetadata: "Back to Home",
  authoritativeSourceDocument: "Phase2Final default not-found",
  sourceSectionAndField: "router notFoundComponent",
  destinationFile: "src/router.tsx",
  featureFlagOrGate: "none",
  verificationEvidence: "safe-qa 404.png",
});

add({
  copyUnit: "Provenance label all modeled",
  exactStringOrMetadata: "Estimate based on your business type and size.",
  authoritativeSourceDocument: "Phase2Final §F.1 combined provenance",
  sourceSectionAndField: "engine.resolveRespondInputs label",
  destinationFile: "src/lib/assessment/engine.ts",
  featureFlagOrGate: "none",
  verificationEvidence: "L#27, S-JRN-04",
});

add({
  copyUnit: "Dimension labels",
  exactStringOrMetadata: JSON.stringify(DIMENSION_LABELS),
  authoritativeSourceDocument: "Phase2Final dimension naming",
  sourceSectionAndField: "DIMENSION_LABELS",
  destinationFile: "src/lib/assessment/questions.ts",
  featureFlagOrGate: "none",
  verificationEvidence: "questions.ts DIMENSION_LABELS",
});

const forbiddenPatterns = [
  /TODO/i,
  /FIXME/i,
  /audit note/i,
  /developer instruction/i,
  /scaffolding/i,
];
const publicRoutes = readdirSync(join(REPO_ROOT, "src/routes")).filter((f) =>
  f.endsWith(".tsx"),
);
let scaffoldLeak = false;
for (const file of publicRoutes) {
  const text = readFileSync(join(REPO_ROOT, "src/routes", file), "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) scaffoldLeak = true;
  }
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      rowCount: rows.length,
      noPublicScaffoldingConfirmed: !scaffoldLeak,
      rows,
    },
    null,
    2,
  ),
);
console.log(`Wrote ${rows.length} rows to ${OUT}`);
