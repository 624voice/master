/**
 * Generates deterministic owner keyboard walkthrough procedure JSON.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REPO_ROOT = join(import.meta.dir, "../..");
const FOCUS_PATH = join(REPO_ROOT, "review-artifacts/phase2/owner-focus-order-sequences.json");
const OUT = join(REPO_ROOT, "review-artifacts/phase2/owner-keyboard-walkthrough-procedure.json");

const EXECUTABLE_SHA =
  spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).stdout.trim();

const FAKE = {
  firstName: "Alex",
  lastName: "Testowner",
  businessName: "Owner QA Fake HVAC Co",
  email: "owner-qa-fake@example.invalid",
  phone: "5550100199",
  trade: "HVAC",
  fleetSize: "3-7",
  monthlyCalls: "450",
};

const RESET = {
  name: "standard-page-reset",
  steps: [
    "Command+L, type the check URL, Enter.",
    "Tab once.",
    "Verify focus is the 624 Voice header link (home logo link).",
  ],
  firstTabFocus: "624 Voice header link",
};

type Check = {
  id: number;
  title: string;
  viewport: string;
  startState: string;
  steps: string[];
  finalFocusOrState: string;
  pass: string;
  fail: string;
  leavesStateForNext?: string;
};

const checks: Check[] = [];

function add(c: Omit<Check, "id">): void {
  checks.push({ id: checks.length + 1, ...c });
}

add({
  title: "Desktop header nav — Tab count to About is 5",
  viewport: "1280×900 desktop (Command+0, DevTools closed)",
  startState: "Fresh load of http://127.0.0.1:3000/",
  steps: [
    ...RESET.steps,
    "Tab → What We Do.",
    "Tab → How We Work.",
    "Tab → Live Demo.",
    "Tab → Free Assessment.",
    "Tab → About.",
  ],
  finalFocusOrState: "About header link",
  pass: "After exactly 5 Tab presses from 624 Voice, focus is the About link.",
  fail: "About is not focused after 5 Tabs, or any intermediate link is skipped or out of order.",
});

add({
  title: "Desktop header nav — Book consultation is Tab 6",
  viewport: "1280×900 desktop",
  startState: "Check 1 final state (focus on About)",
  steps: ["Tab → Book Your AI Growth Systems Consultation."],
  finalFocusOrState: "Book Your AI Growth Systems Consultation header link",
  pass: "One Tab from About focuses Book Your AI Growth Systems Consultation.",
  fail: "Book consultation link is not focused.",
});

add({
  title: "Mobile nav — Enter opens menu",
  viewport: "375×800 mobile (DevTools device toolbar, Responsive 375×800)",
  startState: "Fresh load of http://127.0.0.1:3000/",
  steps: [
    ...RESET.steps,
    "Tab → Mobile navigation menu summary control.",
    "Enter.",
  ],
  finalFocusOrState: "Mobile navigation menu summary (menu open)",
  pass: "Menu panel is visible and summary retains focus after Enter.",
  fail: "Menu panel does not open, or Enter navigates away.",
});

add({
  title: "Mobile nav links after open",
  viewport: "375×800 mobile",
  startState: "Check 3 final state (mobile menu open, focus on summary)",
  steps: [
    "Tab → What We Do.",
    "Tab → How We Work.",
    "Tab → Live Demo.",
    "Tab → Free Assessment.",
    "Tab → About.",
    "Tab → Book Your AI Growth Systems Consultation.",
  ],
  finalFocusOrState: "Book Your AI Growth Systems Consultation mobile nav link",
  pass: "All six mobile nav links are focused in order with one Tab each.",
  fail: "Any listed link is skipped or not focusable.",
});

add({
  title: "Mobile nav — Escape closes without trap",
  viewport: "375×800 mobile",
  startState: "Check 4 final state",
  steps: ["Escape."],
  finalFocusOrState: "Mobile navigation menu summary (menu closed)",
  pass: "Menu closes and focus remains on the summary control.",
  fail: "Focus is trapped or lost outside header.",
});

function routeReachability(
  path: string,
  tabSteps: string[],
  finalTarget: string,
): void {
  add({
    title: `${path} keyboard reachability`,
    viewport: "1280×900 desktop",
    startState: `Fresh load of http://127.0.0.1:3000${path}`,
    steps: [...RESET.steps, ...tabSteps],
    finalFocusOrState: finalTarget,
    pass: `Each named control receives focus in order; final focus is ${finalTarget}.`,
    fail: "Any named control is missing, out of order, or not focusable.",
  });
}

routeReachability("/", [
  "Tab → What We Do.",
  "Tab → How We Work.",
  "Tab → Live Demo.",
  "Tab → Free Assessment.",
  "Tab → About.",
  "Tab → Book Your AI Growth Systems Consultation.",
  "Tab → Book Your AI Growth Systems Consultation (hero).",
  "Tab → Get Your Free Assessment.",
  "Tab → See the System Work.",
], "See the System Work link");

add({
  title: "Home / focus visible",
  viewport: "1280×900 desktop",
  startState: "Check 6 final state (focus on See the System Work)",
  steps: ["Observe focus ring or focus-visible styling on the focused link."],
  finalFocusOrState: "Visible focus indicator on See the System Work",
  pass: "Focus indicator is visibly distinct on the focused control.",
  fail: "No visible focus indicator on the focused control.",
});

routeReachability("/what-we-do", [
  "Tab → What We Do.",
  "Tab → How We Work.",
  "Tab → Live Demo.",
  "Tab → Free Assessment.",
  "Tab → About.",
  "Tab → Book Your AI Growth Systems Consultation.",
  "Tab → See How the Journey Fits Together.",
], "See How the Journey Fits Together link");

add({
  title: "/what-we-do focus visible",
  viewport: "1280×900 desktop",
  startState: "Check 8 final state",
  steps: ["Observe focus indicator on focused link."],
  finalFocusOrState: "Visible focus on See How the Journey Fits Together",
  pass: "Focus indicator visible.",
  fail: "Focus indicator not visible.",
});

routeReachability("/how-we-work", [
  "Tab through header to Book Your AI Growth Systems Consultation (6 Tabs from 624 Voice).",
  "Tab → Book Your AI Growth Systems Consultation (page CTA).",
  "Tab → Get Your Free Assessment.",
], "Get Your Free Assessment link");

add({
  title: "/how-we-work focus visible",
  viewport: "1280×900 desktop",
  startState: "Check 10 final state",
  steps: ["Observe focus indicator."],
  finalFocusOrState: "Visible focus on Get Your Free Assessment",
  pass: "Focus indicator visible.",
  fail: "Focus indicator not visible.",
});

routeReachability("/demo", [
  "Tab through header to Book Your AI Growth Systems Consultation (6 Tabs from 624 Voice).",
  "Tab → Start your demo with Jessica button.",
  "Tab → Start live demo with Jessica button.",
], "Start live demo with Jessica button");

add({
  title: "/demo focus visible",
  viewport: "1280×900 desktop",
  startState: "Check 12 final state",
  steps: ["Observe focus indicator on Start live demo with Jessica."],
  finalFocusOrState: "Visible focus on demo button",
  pass: "Focus indicator visible.",
  fail: "Focus indicator not visible.",
});

routeReachability("/about", [
  "Tab through header to Book Your AI Growth Systems Consultation (6 Tabs from 624 Voice).",
  "Tab → Book Your AI Growth Systems Consultation (page CTA).",
  "Tab → Get Your Free Assessment.",
], "Get Your Free Assessment link");

add({
  title: "/about focus visible",
  viewport: "1280×900 desktop",
  startState: "Check 14 final state",
  steps: ["Observe focus indicator."],
  finalFocusOrState: "Visible focus on Get Your Free Assessment",
  pass: "Focus indicator visible.",
  fail: "Focus indicator not visible.",
});

routeReachability("/contact", [
  "Tab through header to Book Your AI Growth Systems Consultation (6 Tabs from 624 Voice).",
  "Tab → First name field (#firstName).",
  "Tab → Last name field (#lastName).",
  "Tab → Business name field (#businessName).",
  "Tab → Trade select (#trade).",
], "Trade select (#trade)");

add({
  title: "/contact focus visible",
  viewport: "1280×900 desktop",
  startState: "Check 16 final state (focus on #trade)",
  steps: ["Observe focus indicator on trade select."],
  finalFocusOrState: "Visible focus on #trade",
  pass: "Focus indicator visible.",
  fail: "Focus indicator not visible.",
});

add({
  title: "/services redirect",
  viewport: "1280×900 desktop",
  startState: "Any page",
  steps: [
    "Command+L, type http://127.0.0.1:3000/services, Enter.",
    "Command+L, read address bar.",
  ],
  finalFocusOrState: "Address bar shows http://127.0.0.1:3000/what-we-do",
  pass: "Browser URL is /what-we-do after loading /services.",
  fail: "URL is not /what-we-do.",
});

routeReachability("/does-not-exist-404", [
  "Tab through header to Book Your AI Growth Systems Consultation (6 Tabs from 624 Voice).",
  "Tab → Back to Home.",
], "Back to Home link");

add({
  title: "404 focus visible",
  viewport: "1280×900 desktop",
  startState: "Check 19 final state",
  steps: ["Observe focus indicator on Back to Home."],
  finalFocusOrState: "Visible focus on Back to Home",
  pass: "Focus indicator visible.",
  fail: "Focus indicator not visible.",
});

add({
  title: "Assessment BP1 — select HVAC",
  viewport: "1280×900 desktop",
  startState: "Fresh load of http://127.0.0.1:3000/assessment",
  steps: [
    ...RESET.steps,
    "Tab → What We Do.",
    "Tab → How We Work.",
    "Tab → Live Demo.",
    "Tab → Free Assessment.",
    "Tab → About.",
    "Tab → Book Your AI Growth Systems Consultation.",
    "Tab → #assessment-bp1 trade select (7 Tabs from 624 Voice).",
    "ArrowDown → Plumbers.",
    "ArrowDown → Electricians.",
    "ArrowDown → HVAC.",
    "Tab → Continue button.",
    "Enter.",
  ],
  finalFocusOrState: "BP2 fleet select (#assessment-bp2) visible; step shows fleet question",
  pass: "Fleet size question is displayed after Continue.",
  fail: "BP2 not shown or trade is not HVAC.",
  leavesStateForNext: "BP2 step, trade=HVAC",
});

add({
  title: "Assessment BP2 — select 3-7 and Back to BP1",
  viewport: "1280×900 desktop",
  startState: "Check 21 final state (BP2 visible, trade=HVAC)",
  steps: [
    "Tab to #assessment-bp2 if not focused.",
    "ArrowDown → 1–2 vehicles.",
    "ArrowDown → 3–7 vehicles.",
    "Tab → Back button.",
    "Enter.",
  ],
  finalFocusOrState: "BP1 trade select (#assessment-bp1) visible",
  pass: "Back returns to BP1 with HVAC still selected.",
  fail: "BP1 not shown.",
  leavesStateForNext: "BP1, trade=HVAC",
});

add({
  title: "Assessment BP2 — select 3-7 and Continue to respond review",
  viewport: "1280×900 desktop",
  startState: "Check 22 final state (BP1, trade=HVAC)",
  steps: [
    "Tab → Continue.",
    "Enter (BP2).",
    "ArrowDown → 1–2 vehicles.",
    "ArrowDown → 3–7 vehicles.",
    "Tab → Continue.",
    "Enter.",
  ],
  finalFocusOrState: "Respond review with #respond-R1 visible",
  pass: "Review your respond assumptions screen shows Monthly inbound calls field.",
  fail: "Respond review not displayed.",
  leavesStateForNext: "Respond review, fleet=3-7",
});

add({
  title: "Assessment respond — set monthly calls to 450",
  viewport: "1280×900 desktop",
  startState: "Check 23 final state",
  steps: [
    "Tab to #respond-R1 if needed.",
    "Select all text in field (Command+A).",
    "Type 450.",
    "Tab → Continue.",
    "Enter.",
  ],
  finalFocusOrState: "Screening question: How consistently do new customers find your business when they need your services?",
  pass: "GF-S question text is visible; R1 value is 450.",
  fail: "GF-S question not shown or R1 not 450.",
  leavesStateForNext: "GF-S question, R1=450",
});

add({
  title: "Assessment GF-S and conditional follow-ups",
  viewport: "1280×900 desktop",
  startState: "Check 24 final state (GF-S question)",
  steps: [
    "Tab → Not at all / rarely.",
    "Tab → Somewhat / occasionally.",
    "Tab → Mostly / often.",
    "Tab → Consistently / always.",
    "Space (select Consistently / always).",
    "Tab → Continue.",
    "Enter.",
    "Answer GF-F1 Do you track where new leads come from (calls, web, referrals, ads)?: Tab×3 → Mostly / often, Space, Tab → Continue, Enter.",
    "Answer GF-F2 Is your Google Business Profile complete, current, and actively managed?: Tab → Not at all / rarely, Space, Tab → Continue, Enter.",
    "Answer GF-F3 Do you have a simple way for prospects to request service online or after hours?: Tab → Not at all / rarely, Space, Tab → Continue, Enter.",
  ],
  finalFocusOrState: "CV-S question: How consistently do inbound leads convert into booked jobs or appointments?",
  pass: "CV-S question displayed after GF follow-ups.",
  fail: "CV-S not reached or GF follow-up labels missing.",
  leavesStateForNext: "CV-S question, GF follow-ups answered",
});

add({
  title: "Assessment remaining screening questions",
  viewport: "1280×900 desktop",
  startState: "Check 25 final state (CV-S)",
  steps: [
    "CV-S: Tab → Not at all / rarely, Space, Tab → Continue, Enter.",
    "RG-S How consistently do you stay in touch with past customers to earn repeat business?: Tab → Not at all / rarely, Space, Tab → Continue, Enter.",
    "RM-S How much manual admin work still falls on your team for scheduling and follow-up?: Tab → Not at all / rarely, Space, Tab → Continue, Enter.",
    "MI-S How clearly can you see which marketing and operations efforts are working?: Tab → Not at all / rarely, Space, Tab → Continue, Enter.",
  ],
  finalFocusOrState: "Teaser screen with Unlock Full Results button",
  pass: "Teaser shows Your top priority and Unlock Full Results button.",
  fail: "Teaser not displayed.",
  leavesStateForNext: "Teaser screen",
});

add({
  title: "Assessment mandatory stale-answer removal",
  viewport: "1280×900 desktop",
  startState: "Check 26 final state (teaser visible)",
  steps: [
    "Tab → Back, Enter (MI-S).",
    "Tab → Back, Enter (RM-S).",
    "Tab → Back, Enter (RG-S).",
    "Tab → Back, Enter (CV-S).",
    "Tab → Back, Enter (GF-F3).",
    "Tab → Back, Enter (GF-F2).",
    "Tab → Back, Enter (GF-F1).",
    "Tab → Back, Enter (GF-S).",
    "On GF-S: Tab → Not at all / rarely, Space.",
    "Tab → Continue, Enter.",
    "Confirm rendered page does NOT show Do you track where new leads come from (calls, web, referrals, ads)?",
    "CV-S: Tab → Not at all / rarely, Space, Tab → Continue, Enter.",
    "RG-S: Tab → Not at all / rarely, Space, Tab → Continue, Enter.",
    "RM-S: Tab → Not at all / rarely, Space, Tab → Continue, Enter.",
    "MI-S: Tab → Not at all / rarely, Space, Tab → Continue, Enter.",
  ],
  finalFocusOrState: "Teaser screen (second time) without GF-F1 question ever reappearing",
  pass: "After lowering GF-S score, GF-F1/GF-F2/GF-F3 never render; teaser reached again.",
  fail: "Any GF-F follow-up question appears after GF-S score lowered.",
  leavesStateForNext: "Teaser screen (post stale-removal)",
});

add({
  title: "Assessment teaser to lead gate",
  viewport: "1280×900 desktop",
  startState: "Check 27 final state",
  steps: [
    "Tab → Unlock Full Results.",
    "Enter.",
  ],
  finalFocusOrState: "Lead gate heading Unlock your full assessment results; #gate-first-name empty",
  pass: "Lead gate form visible with empty fields.",
  fail: "Gate not displayed.",
  leavesStateForNext: "Lead gate, all fields empty, SMS consent unchecked",
});

add({
  title: "Lead gate invalid submit",
  viewport: "1280×900 desktop",
  startState: "Check 28 final state (empty gate, SMS consent unchecked)",
  steps: [
    "Tab through to See My Full Results submit button.",
    "Enter.",
  ],
  finalFocusOrState: "Alert text First name is required.; focus remains in form",
  pass: "Red alert with role=alert shows First name is required.; gate remains open.",
  fail: "Different alert text, no alert, or navigation away.",
  leavesStateForNext: "Lead gate, validation alert visible, SMS consent unchecked",
});

add({
  title: "Lead gate SMS consent toggle",
  viewport: "1280×900 desktop",
  startState: "Check 29 final state (SMS consent unchecked)",
  steps: [
    "Tab to SMS consent checkbox.",
    "Verify checkbox is unchecked.",
    "Space (check).",
    "Verify checkbox is checked.",
    "Space (uncheck).",
  ],
  finalFocusOrState: "SMS consent checkbox unchecked",
  pass: "Checkbox toggles checked then returns unchecked.",
  fail: "Checkbox does not toggle or ends checked.",
  leavesStateForNext: "Lead gate, SMS consent unchecked",
});

add({
  title: "Lead gate valid submission",
  viewport: "1280×900 desktop",
  startState: "Check 30 final state (SMS consent unchecked)",
  steps: [
    "Tab → #gate-first-name, type Alex.",
    "Tab → #gate-last-name, type Testowner.",
    "Tab → #gate-business, type Owner QA Fake HVAC Co.",
    "Tab → #gate-email, type owner-qa-fake@example.invalid.",
    "Tab → #gate-phone, type 5550100199.",
    "Tab → SMS consent checkbox (leave unchecked).",
    "Tab → See My Full Results.",
    "Enter.",
  ],
  finalFocusOrState: "Results page heading Your priority areas",
  pass: "Results page renders with Your priority areas and Download Assessment Report button.",
  fail: "Results page not shown or submission error alert.",
  leavesStateForNext: "Results page, report not yet downloaded",
});

add({
  title: "Report download first attempt — 503 alert",
  viewport: "1280×900 desktop",
  startState: "Check 31 final state (results page, first visit)",
  steps: [
    "Tab to Download Assessment Report button.",
    "Enter.",
    "Read alert region (role=alert).",
  ],
  finalFocusOrState: "Alert text Report temporarily unavailable. Please try again in a moment.; results page still visible underneath",
  pass: "503 alert exact text shown; Your priority areas still on page; Try downloading report again button visible.",
  fail: "Different alert, no alert, or results page replaced.",
  leavesStateForNext: "Results page with 503 alert and retry button",
});

add({
  title: "Report download retry — keyboard to success",
  viewport: "1280×900 desktop",
  startState: "Check 32 final state (503 alert visible)",
  steps: [
    "Tab → Try downloading report again button.",
    "Enter.",
  ],
  finalFocusOrState: "Chrome opens new tab with PDF viewer (blob: URL); results tab remains open",
  pass: "New tab opens showing PDF; original tab still shows Your priority areas.",
  fail: "No PDF tab, or retry button missing.",
  leavesStateForNext: "PDF tab focused, results tab in background",
});

add({
  title: "Return from PDF tab to results",
  viewport: "1280×900 desktop",
  startState: "Check 33 final state (PDF tab active)",
  steps: [
    "Command+W (close PDF tab).",
  ],
  finalFocusOrState: "Results tab active; Download Assessment Report button available",
  pass: "Focus returns to results page without using Tab on controls that exist only in PDF viewer.",
  fail: "Wrong tab closed or results page lost.",
  leavesStateForNext: "Results page, first download attempt consumed",
});

add({
  title: "Report download repeat access",
  viewport: "1280×900 desktop",
  startState: "Check 34 final state (results page after returning from PDF)",
  steps: [
    "Tab → Download Assessment Report button.",
    "Enter.",
  ],
  finalFocusOrState: "Chrome opens PDF in new tab immediately (no 503 alert)",
  pass: "Second download succeeds without 503; no fail-once alert reappears.",
  fail: "503 alert appears again or download fails.",
});

const focusData = JSON.parse(readFileSync(FOCUS_PATH, "utf8"));

const procedure = {
  procedureId: "A11Y-090-owner-procedure-v3",
  totalChecks: checks.length,
  browser: "Google Chrome on macOS only",
  executableCheckoutSha: EXECUTABLE_SHA,
  applicationBehaviorSha: "d54286ec9f875d7627c3a027bf7407664389f4e6",
  resetFixture: RESET,
  focusOrderEvidence: focusData.resetProcedure,
  desktopNavTabCounts: focusData.desktopNavFrom624Voice,
  safeFixtureData: { ...FAKE, noRealPii: true },
  reportErrorFixture: {
    activation:
      "Automatic in approved preview launcher: container entrypoint sets PHASE2_SAFE_PREVIEW=1 and PHASE2_OWNER_QA_REPORT_FAIL_ONCE=1. Chris sets no environment variable.",
    guardCode: "IS_SAFE_PREVIEW && PHASE2_OWNER_QA_REPORT_FAIL_ONCE === \"1\"",
    productionSafe:
      "PHASE2_OWNER_QA_REPORT_FAIL_ONCE=1 alone (without PHASE2_SAFE_PREVIEW=1) does not activate fixture.",
    firstButtonLabel: "Download Assessment Report",
    alertText: "Report temporarily unavailable. Please try again in a moment.",
    retryButtonLabel: "Try downloading report again",
    pdfDelivery: "Chrome opens new tab with PDF viewer via blob URL",
  },
  preparationCommand: "bun run scripts/phase2/prepare-safe-preview-deps.ts",
  startupCommand: "bun run scripts/phase2/start-safe-assessment-preview.ts",
  checks,
  attestation: {
    operator: "",
    executedAtIso: "",
    confirmedPhysicalKeyboardOnly: "",
    confirmedNoProductionCredentials: "",
    confirmedNoLiveExternalSideEffects: "",
    perCheckResults: checks.map((c) => ({ id: c.id, title: c.title, result: "", notes: "" })),
    finalConclusion: "",
  },
};

writeFileSync(OUT, JSON.stringify(procedure, null, 2));
console.log(`Wrote ${checks.length} checks to ${OUT}`);
