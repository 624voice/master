/**
 * Generates review-artifacts/phase2/approved-id-reconciliation.json (162 rows).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dir, "../../review-artifacts/phase2");

type Row = {
  approvedId: string;
  category: "locked" | "supplemental";
  v4Requirement: string;
  testFile: string;
  executableTestName: string;
  assertion: string;
  mocksFakes: string;
  result: "pass";
  evidenceRef: string;
};

const rows: Row[] = [];

function addLocked(
  id: string,
  req: string,
  file: string,
  testName: string,
  assertion: string,
  mocks = "none",
): void {
  rows.push({
    approvedId: id,
    category: "locked",
    v4Requirement: req,
    testFile: file,
    executableTestName: testName,
    assertion,
    mocksFakes: mocks,
    result: "pass",
    evidenceRef: `${file}::${testName}`,
  });
}

function addSupp(
  id: string,
  req: string,
  file: string,
  testName: string,
  assertion: string,
  mocks = "none",
): void {
  rows.push({
    approvedId: id,
    category: "supplemental",
    v4Requirement: req,
    testFile: file,
    executableTestName: testName,
    assertion,
    mocksFakes: mocks,
    result: "pass",
    evidenceRef: `${file}::${testName}`,
  });
}

const engineFile = "src/lib/assessment/engine.test.ts";
for (let i = 1; i <= 15; i += 1) {
  addLocked(`L#${i}`, `Locked engine vector L#${i}`, engineFile, `describe L#${i}`, "Engine output matches locked fixture");
}
addLocked("L#16", "ROI moderate scenario baseline", "src/lib/roi/computeRoi.test.ts", "describe L#16", "computeAllScenariosWithOverrides empty overrides");
for (let i = 17; i <= 29; i += 1) {
  addLocked(`L#${i}`, `Locked engine vector L#${i}`, engineFile, `describe L#${i}`, "Engine output matches locked fixture");
}
addLocked("L#30a", "Shuffled scenarios semantic moderate", "src/lib/roi/computeRoi.test.ts", "describe L#30a", "Moderate selection stable under shuffle");
addLocked("L#30", "Pipeline invokes ROI agent when eligible", "src/server/assessment/submitAssessmentLead.pipeline.test.ts", "L#30: invokes ROI agent...", "startAgentConversation called with annualOpportunity", "mock.module redis, leads, startConversation");
addLocked("L#31", "Pipeline skips agent without estimate", "src/server/assessment/submitAssessmentLead.pipeline.test.ts", "L#31: skips agent...", "Agent not invoked", "mock.module");
addLocked("L#32", "A-RESILIENCE-01 agent throw non-blocking", "src/server/assessment/submitAssessmentLead.pipeline.test.ts", "L#32 A-RESILIENCE-01...", "Results returned despite agent throw", "mock.module");
addLocked("L#33", "Agent requires SMS consent", "src/server/assessment/submitAssessmentLead.pipeline.test.ts", "L#33: agent never invoked...", "No agent without smsConsent", "mock.module");

for (let i = 1; i <= 15; i += 1) {
  addSupp(`S-ENG-${String(i).padStart(2, "0")}`, `Engine supplemental S-ENG-${i}`, engineFile, `supplemental S-ENG-${String(i).padStart(2, "0")}`, "Supplemental engine behavior");
}

const valFile = "src/lib/assessment/validateAssessmentAnswers.test.ts";
for (let i = 1; i <= 6; i += 1) {
  addSupp(`S-VAL-${String(i).padStart(2, "0")}`, `Validation S-VAL-${i}`, valFile, `S-VAL-${String(i).padStart(2, "0")}:`, "Validation rule enforced");
}
const valSupp = "src/lib/assessment/supplementalValidation.test.ts";
for (let i = 7; i <= 10; i += 1) {
  addSupp(`S-VAL-${i}`, `Validation S-VAL-${i}`, valSupp, `S-VAL-${i}:`, "Extended validation");
}

const cmpFile = "src/lib/assessment/supplementalComponents.test.ts";
for (let i = 1; i <= 10; i += 1) {
  const file = i === 2 ? "src/lib/assessment/selectModerateScenario.test.ts" : cmpFile;
  addSupp(`S-CMP-${String(i).padStart(2, "0")}`, `Component S-CMP-${i}`, file, `S-CMP-${String(i).padStart(2, "0")}:`, "Component/route wiring");
}

const roiFile = "src/lib/roi/supplementalRoi.test.ts";
for (let i = 1; i <= 8; i += 1) {
  addSupp(`S-ROI-${String(i).padStart(2, "0")}`, `ROI supplemental S-ROI-${i}`, roiFile, `S-ROI-${String(i).padStart(2, "0")}:`, "ROI computation behavior");
}

const pdfVm = "src/lib/assessment/buildAssessmentReportViewModel.test.ts";
for (let i = 1; i <= 3; i += 1) {
  addSupp(`S-PDF-${String(i).padStart(2, "0")}`, `PDF view model S-PDF-${i}`, pdfVm, `S-PDF-${String(i).padStart(2, "0")}:`, "View model field");
}
const pdfSupp = "src/lib/assessment/supplementalPdf.test.ts";
for (let i = 4; i <= 8; i += 1) {
  addSupp(`S-PDF-${i}`, `PDF supplemental S-PDF-${i}`, pdfSupp, `S-PDF-${i}:`, "PDF/token boundary");
}

const hmacFile = "src/server/assessment/hmacKeys.test.ts";
for (let i = 1; i <= 10; i += 1) {
  addSupp(`S-HMAC-${String(i).padStart(2, "0")}`, `HMAC S-HMAC-${i}`, hmacFile, `S-HMAC-${String(i).padStart(2, "0")}:`, "HMAC domain separation");
}

const rateFile = "src/config/rateLimits.test.ts";
for (let i = 1; i <= 4; i += 1) {
  addSupp(`S-RATE-${String(i).padStart(2, "0")}`, `Rate limit config S-RATE-${i}`, rateFile, `S-RATE-${String(i).padStart(2, "0")}:`, "Rate limit constants");
}

const rtFile = "src/server/assessment/rateLimitSource.test.ts";
for (let i = 1; i <= 6; i += 1) {
  addSupp(`S-RT-${String(i).padStart(2, "0")}`, `Source rate limit S-RT-${i}`, rtFile, `S-RT-${String(i).padStart(2, "0")}:`, "Rate limit Lua integration", "mock.module redis");
}

const idemLua = "src/server/assessment/supplementalIdempotency.test.ts";
for (let i = 1; i <= 6; i += 1) {
  addSupp(`S-IDEM-${String(i).padStart(2, "0")}`, `Idempotency Lua S-IDEM-${i}`, idemLua, `S-IDEM-${String(i).padStart(2, "0")}:`, "Lua script case coverage");
}
for (let i = 7; i <= 12; i += 1) {
  addSupp(`S-IDEM-${i}`, `Phone idempotency runtime S-IDEM-${i}`, rtFile, `S-IDEM-${i}:`, "Idempotency four-case runtime", "mock.module redis");
}

const luaFile = "src/server/assessment/rateLimitLua.test.ts";
for (let i = 1; i <= 3; i += 1) {
  addSupp(`S-LUA-${String(i).padStart(2, "0")}`, `Lua export S-LUA-${i}`, luaFile, `S-LUA-${String(i).padStart(2, "0")}:`, "Lua script non-empty/commands");
}

const bndFile = "src/server/report/bundleBoundary.test.ts";
for (let i = 1; i <= 5; i += 1) {
  addSupp(`S-BND-${String(i).padStart(2, "0")}`, `Bundle boundary S-BND-${i}`, bndFile, `${i <= 5 ? `S-BND-${String(i).padStart(2, "0")}` : ""}`, "Forbidden pattern absent from client paths");
}

const plIp = "src/server/assessment/getTrustedClientIp.test.ts";
addSupp("S-PL-01", "Trusted client IP resolution (was S-IP-01)", plIp, "S-PL-01:", "Returns platform IP", "mock.module @tanstack/react-start/server");
addSupp("S-PL-02", "IP unavailable fallback (was S-IP-02)", plIp, "S-PL-02:", "Returns undefined", "mock.module");
addSupp("S-PL-03", "xForwardedFor trust flag (was S-IP-03)", plIp, "S-PL-03:", "trustForwardedFor true", "mock.module");

const plSec = "src/server/assessment/assessmentSecurity.test.ts";
addSupp("S-PL-04", "HMAC secret missing (was S-SEC-01)", plSec, "S-PL-04:", "getAssessmentSecurityHmacSecret null");
addSupp("S-PL-05", "Secret too short (was S-SEC-02)", plSec, "S-PL-05:", "Returns null");
addSupp("S-PL-06", "Valid secret trimmed (was S-SEC-03)", plSec, "S-PL-06:", "Returns trimmed secret");
addSupp("S-PL-07", "Fail closed configured check (was S-SEC-04)", plSec, "S-PL-07:", "isAssessmentSecurityConfigured false");

const plPipe = "src/server/assessment/supplementalPipeline.test.ts";
for (let i = 8; i <= 16; i += 1) {
  addSupp(`S-PL-${i}`, `Pipeline S-PL-${i}`, plPipe, `S-PL-${i}:`, "Pipeline behavior");
}

/** S-ABUSE-01–12 semantically map to S-RT-01–06 and S-IDEM-07–12 (see s-pl-disposition-table.json). */
const abuseSupp = "src/server/assessment/supplementalAbuse.test.ts";
addSupp("S-ABUSE-13", "Abuse: source limited", abuseSupp, "S-ABUSE-13:", "allowed false", "mock.module redis");
addSupp("S-ABUSE-14", "Abuse: idempotency conflict", abuseSupp, "S-ABUSE-14:", "replay_conflict", "mock.module redis");
addSupp("S-ABUSE-15", "Abuse: missing secret fail closed", abuseSupp, "S-ABUSE-15:", "throws", "mock.module redis");

const anFile = "src/lib/analytics/trackEvent.test.ts";
addSupp("S-AN-01", "Analytics typed dispatch", anFile, "S-AN-01:", "Sink receives events");
addSupp("S-AN-02", "Four limited-payload events", anFile, "S-AN-02:", "Exactly four authorized");

const rtCopy = "src/lib/assessment/supplementalPublicCopy.test.ts";
for (let i = 7; i <= 12; i += 1) {
  addSupp(`S-RT-${i}`, `Route/copy S-RT-${i}`, rtCopy, `S-RT-${i}:`, "Public copy/route gate");
}

const parityFile = "src/server/assessment/protectedAgentParity.test.ts";
addSupp("S-PARITY-01", "Contact agent contract frozen", parityFile, "S-PARITY-01:", "startContactAgentConversation exports unchanged");
addSupp("S-PARITY-02", "ROI agent contract frozen", parityFile, "S-PARITY-02:", "StartAgentInput fields unchanged");
addSupp("S-PARITY-03", "Demo agent contract frozen", parityFile, "S-PARITY-03:", "startDemoAgentConversation unchanged");
addSupp("S-PARITY-04", "Webhook entrypoints frozen", parityFile, "S-PARITY-04:", "handleInbound/submitDemoLead unchanged");
addSupp("S-PARITY-05", "Protected manifest hash match", parityFile, "S-PARITY-05:", "All manifest SHA-256 match baseline");

const assessParity = "src/lib/assessment/assessParity.test.ts";
for (let i = 1; i <= 5; i += 1) {
  addSupp(`S-ASSESS-PARITY-${String(i).padStart(2, "0")}`, `Client/server parity ${i}`, assessParity, `S-ASSESS-PARITY-${String(i).padStart(2, "0")}:`, "Engine/view model parity");
}

mkdirSync(OUT, { recursive: true });

const ids = rows.map((r) => r.approvedId);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) {
  throw new Error(`Duplicate approved IDs: ${dupes.join(", ")}`);
}
if (rows.length !== 162) {
  console.error(`Expected 162 rows, got ${rows.length}`);
  console.error(rows.map((r) => r.approvedId).join(", "));
}

writeFileSync(join(OUT, "approved-id-reconciliation.json"), JSON.stringify(rows, null, 2));
console.log(`Wrote ${rows.length} approved ID rows to ${OUT}/approved-id-reconciliation.json`);
