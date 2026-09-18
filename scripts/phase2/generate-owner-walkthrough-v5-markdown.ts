/**
 * Generates Phase 2 owner keyboard walkthrough v5 markdown for Chris.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  DESKTOP_VP,
  MOBILE_VP,
  VIEWPORT_SETUP,
  SHARED_HEADER_REF,
  RESET_STEPS,
  HEADER_STEPS_FROM_624,
  CHOICE_BUTTON_MODEL,
  answerNotAtAllRarelySteps,
  answerMostlyOftenSteps,
  answerConsistentlyAlwaysSteps,
  formatCheck,
  type WalkthroughCheck,
} from "./ownerWalkthroughV5Content";
import { ALLOWED_PREP_HOSTS } from "./safePreviewPrepareNetworkGuard";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(REPO_ROOT, "review-artifacts/phase2/owner-keyboard-walkthrough-v5.md");

const EXECUTABLE_SHA = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
}).stdout.trim();

const checks: WalkthroughCheck[] = [];

function add(c: Omit<WalkthroughCheck, "id">): void {
  checks.push({ id: checks.length + 1, ...c });
}

add({
  title: "Desktop header — five Tabs from 624 Voice to About",
  viewport: DESKTOP_VP,
  startUrl: "http://127.0.0.1:3000/",
  startState: "Fresh page load",
  startFocus: "Document body before reset Tab",
  steps: [...RESET_STEPS, ...HEADER_STEPS_FROM_624.slice(0, 5)],
  expectedRenderedState: "Home page rendered; desktop header visible.",
  finalFocus: "About header link",
  leavesStateForNext: "Focus on About header link.",
  pass: "After reset Tab (624 Voice) and exactly five additional Tab presses, focus is the About header link.",
  fail: "About is not focused or a header link is skipped.",
});

add({
  title: "Desktop header — sixth Tab reaches Book consultation",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 1 final state",
  startFocus: "About header link",
  steps: ["Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link."],
  expectedRenderedState: "Home page rendered.",
  finalFocus: "Book Your AI Growth Systems Consultation header link",
  leavesStateForNext: "Focus on Book Your AI Growth Systems Consultation header link.",
  pass: "One Tab from About focuses Book Your AI Growth Systems Consultation header link.",
  fail: "Book Your AI Growth Systems Consultation header link is not focused.",
});

add({
  title: "Mobile nav — Enter opens menu",
  viewport: MOBILE_VP,
  startUrl: "http://127.0.0.1:3000/",
  startState: "Fresh page load",
  startFocus: "Document body before reset Tab",
  steps: [
    ...RESET_STEPS,
    "Press Tab. Verify focused element: Mobile navigation menu summary control.",
    "Press Enter.",
  ],
  expectedRenderedState: "Mobile navigation panel visible below header.",
  finalFocus: "Mobile navigation menu summary control",
  leavesStateForNext: "Mobile menu open; focus on summary control.",
  pass: "Menu panel is visible and summary retains focus after Enter.",
  fail: "Menu panel does not open or Enter navigates away.",
});

add({
  title: "Mobile nav links in order after menu open",
  viewport: MOBILE_VP,
  startUrl: null,
  startState: "Check 3 final state",
  startFocus: "Mobile navigation menu summary control (menu open)",
  steps: [
    "Press Tab. Verify focused element: What We Do mobile nav link.",
    "Press Tab. Verify focused element: How We Work mobile nav link.",
    "Press Tab. Verify focused element: Live Demo mobile nav link.",
    "Press Tab. Verify focused element: Free Assessment mobile nav link.",
    "Press Tab. Verify focused element: About mobile nav link.",
    "Press Tab. Verify focused element: Book Your AI Growth Systems Consultation mobile nav link.",
  ],
  expectedRenderedState: "Mobile navigation panel open.",
  finalFocus: "Book Your AI Growth Systems Consultation mobile nav link",
  leavesStateForNext: "Mobile menu open; focus on Book mobile nav link.",
  pass: "All six mobile nav links receive focus in listed order with one Tab each.",
  fail: "Any listed mobile nav link is skipped or not focusable.",
});

add({
  title: "Mobile nav — Escape closes menu",
  viewport: MOBILE_VP,
  startUrl: null,
  startState: "Check 4 final state",
  startFocus: "Book Your AI Growth Systems Consultation mobile nav link",
  steps: ["Press Escape."],
  expectedRenderedState: "Mobile navigation panel closed.",
  finalFocus: "Mobile navigation menu summary control",
  leavesStateForNext: "Mobile menu closed; focus on summary control.",
  pass: "Menu closes and focus remains on the summary control.",
  fail: "Menu stays open or focus is lost outside the header.",
});

function routeReachability(
  title: string,
  url: string,
  afterHeader: string[],
  finalFocus: string,
  rendered: string,
): void {
  add({
    title,
    viewport: DESKTOP_VP,
    startUrl: url,
    startState: "Fresh page load",
    startFocus: "Document body before reset Tab",
    steps: [...RESET_STEPS, ...HEADER_STEPS_FROM_624, ...afterHeader],
    expectedRenderedState: rendered,
    finalFocus,
    leavesStateForNext: `Focus on ${finalFocus}.`,
    pass: `Each listed key press moves focus to the named element; final focus is ${finalFocus}.`,
    fail: "Any named element is missing, out of order, or not focusable.",
  });
}

routeReachability(
  "Home keyboard reachability",
  "http://127.0.0.1:3000/",
  [
    "Press Tab. Verify focused element: Book Your AI Growth Systems Consultation hero link.",
    "Press Tab. Verify focused element: Get Your Free Assessment link.",
    "Press Tab. Verify focused element: See the System Work link.",
  ],
  "See the System Work link",
  "Home page hero and links rendered.",
);

add({
  title: "Home focus visible",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 6 final state",
  startFocus: "See the System Work link",
  steps: ["Observe the focused link for a visible focus indicator (ring or outline)."],
  expectedRenderedState: "See the System Work link remains focused.",
  finalFocus: "See the System Work link with visible focus indicator",
  leavesStateForNext: "Focus on See the System Work link.",
  pass: "Focus indicator is visibly distinct on See the System Work link.",
  fail: "No visible focus indicator on the focused link.",
});

routeReachability(
  "/what-we-do keyboard reachability",
  "http://127.0.0.1:3000/what-we-do",
  ["Press Tab. Verify focused element: See How the Journey Fits Together link."],
  "See How the Journey Fits Together link",
  "What We Do page rendered.",
);

add({
  title: "/what-we-do focus visible",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 8 final state",
  startFocus: "See How the Journey Fits Together link",
  steps: ["Observe visible focus indicator on See How the Journey Fits Together link."],
  expectedRenderedState: "What We Do page rendered.",
  finalFocus: "See How the Journey Fits Together link with visible focus indicator",
  leavesStateForNext: "Focus on See How the Journey Fits Together link.",
  pass: "Focus indicator visible on See How the Journey Fits Together link.",
  fail: "No visible focus indicator on the focused link.",
});

routeReachability(
  "/how-we-work keyboard reachability",
  "http://127.0.0.1:3000/how-we-work",
  [
    "Press Tab. Verify focused element: Book Your AI Growth Systems Consultation page CTA link.",
    "Press Tab. Verify focused element: Get Your Free Assessment link.",
  ],
  "Get Your Free Assessment link",
  "How We Work page rendered.",
);

add({
  title: "/how-we-work focus visible",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 10 final state",
  startFocus: "Get Your Free Assessment link",
  steps: ["Observe visible focus indicator on Get Your Free Assessment link."],
  expectedRenderedState: "How We Work page rendered.",
  finalFocus: "Get Your Free Assessment link with visible focus indicator",
  leavesStateForNext: "Focus on Get Your Free Assessment link.",
  pass: "Focus indicator visible on Get Your Free Assessment link.",
  fail: "No visible focus indicator on the focused link.",
});

routeReachability(
  "/demo keyboard reachability",
  "http://127.0.0.1:3000/demo",
  [
    "Press Tab. Verify focused element: Start your demo with Jessica button.",
    "Press Tab. Verify focused element: Start live demo with Jessica button.",
  ],
  "Start live demo with Jessica button",
  "Live Demo page rendered.",
);

add({
  title: "/demo focus visible",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 12 final state",
  startFocus: "Start live demo with Jessica button",
  steps: ["Observe visible focus indicator on Start live demo with Jessica button."],
  expectedRenderedState: "Live Demo page rendered.",
  finalFocus: "Start live demo with Jessica button with visible focus indicator",
  leavesStateForNext: "Focus on Start live demo with Jessica button.",
  pass: "Focus indicator visible on Start live demo with Jessica button.",
  fail: "No visible focus indicator on the focused button.",
});

routeReachability(
  "/about keyboard reachability",
  "http://127.0.0.1:3000/about",
  [
    "Press Tab. Verify focused element: Book Your AI Growth Systems Consultation page CTA link.",
    "Press Tab. Verify focused element: Get Your Free Assessment link.",
  ],
  "Get Your Free Assessment link",
  "About page rendered.",
);

add({
  title: "/about focus visible",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 14 final state",
  startFocus: "Get Your Free Assessment link",
  steps: ["Observe visible focus indicator on Get Your Free Assessment link."],
  expectedRenderedState: "About page rendered.",
  finalFocus: "Get Your Free Assessment link with visible focus indicator",
  leavesStateForNext: "Focus on Get Your Free Assessment link.",
  pass: "Focus indicator visible on Get Your Free Assessment link.",
  fail: "No visible focus indicator on the focused link.",
});

routeReachability(
  "/contact keyboard reachability",
  "http://127.0.0.1:3000/contact",
  [
    "Press Tab. Verify focused element: First name field.",
    "Press Tab. Verify focused element: Last name field.",
    "Press Tab. Verify focused element: Business name field.",
    "Press Tab. Verify focused element: Trade select.",
  ],
  "Trade select",
  "Contact form rendered.",
);

add({
  title: "/contact focus visible",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 16 final state",
  startFocus: "Trade select",
  steps: ["Observe visible focus indicator on Trade select."],
  expectedRenderedState: "Contact form rendered.",
  finalFocus: "Trade select with visible focus indicator",
  leavesStateForNext: "Focus on Trade select.",
  pass: "Focus indicator visible on Trade select.",
  fail: "No visible focus indicator on Trade select.",
});

add({
  title: "/services redirect",
  viewport: DESKTOP_VP,
  startUrl: "http://127.0.0.1:3000/services",
  startState: "Fresh navigation",
  startFocus: "Address bar",
  steps: [
    "Press Command+L, type http://127.0.0.1:3000/services, press Enter.",
    "Press Command+L, read address bar URL.",
  ],
  expectedRenderedState: "What We Do page content rendered.",
  finalFocus: "Address bar showing http://127.0.0.1:3000/what-we-do",
  leavesStateForNext: "Browser at /what-we-do.",
  pass: "Address bar reads http://127.0.0.1:3000/what-we-do after loading /services.",
  fail: "Address bar does not read http://127.0.0.1:3000/what-we-do.",
});

routeReachability(
  "404 keyboard reachability",
  "http://127.0.0.1:3000/does-not-exist-404",
  ["Press Tab. Verify focused element: Back to Home link."],
  "Back to Home link",
  "404 page with Back to Home link rendered.",
);

add({
  title: "404 focus visible",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 19 final state",
  startFocus: "Back to Home link",
  steps: ["Observe visible focus indicator on Back to Home link."],
  expectedRenderedState: "404 page rendered.",
  finalFocus: "Back to Home link with visible focus indicator",
  leavesStateForNext: "Focus on Back to Home link.",
  pass: "Focus indicator visible on Back to Home link.",
  fail: "No visible focus indicator on Back to Home link.",
});

add({
  title: "Assessment BP1 — native SELECT trade HVAC and Continue",
  viewport: DESKTOP_VP,
  startUrl: "http://127.0.0.1:3000/assessment",
  startState: "Fresh page load",
  startFocus: "Document body before reset Tab",
  steps: [
    ...RESET_STEPS,
    ...HEADER_STEPS_FROM_624,
    "Press Tab. Verify focused element: Trade select (native SELECT; initial option Choose a trade…).",
    "Press ArrowDown. Verify selected option: Plumbers.",
    "Press ArrowDown. Verify selected option: Electricians.",
    "Press ArrowDown. Verify selected option: HVAC.",
    "Press Tab. Verify focused element: Continue button.",
    "Press Enter.",
  ],
  expectedRenderedState: "BP2 fleet-size question rendered.",
  finalFocus: "Document body on BP2 step",
  leavesStateForNext: "BP2 visible; trade=HVAC; focus on document body.",
  pass: "BP2 fleet question displayed; trade select value is HVAC; after Continue focus is document body.",
  fail: "BP2 not shown, trade is not HVAC, or focus after Continue is not document body.",
});

add({
  title: "Assessment BP2 — native SELECT fleet 3–7, return to BP1, forward to respond review",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 21 final state",
  startFocus: "Document body on BP2 step",
  steps: [
    "Press Shift+Tab. Verify focused element: Back button.",
    "Press Shift+Tab. Verify focused element: Fleet size select (native SELECT).",
    "Press ArrowDown. Verify selected option: 1–2 vehicles.",
    "Press ArrowDown. Verify selected option: 3–7 vehicles.",
    "Press Tab. Verify focused element: Back button.",
    "Press Enter. Verify rendered screen: BP1 trade select visible.",
    "Press Tab. Verify focused element: Continue button.",
    "Press Enter. Verify rendered screen: BP2 fleet select visible.",
    "Press Shift+Tab. Verify focused element: Fleet size select.",
    "Press ArrowDown. Verify selected option: 1–2 vehicles.",
    "Press ArrowDown. Verify selected option: 3–7 vehicles.",
    "Press Tab. Verify focused element: Back button.",
    "Press Tab. Verify focused element: Continue button.",
    "Press Enter.",
  ],
  expectedRenderedState: "Respond review screen with Monthly inbound calls field visible.",
  finalFocus: "Continue button on respond review screen",
  leavesStateForNext: "Respond review visible; fleet=3–7; focus on Continue button.",
  pass: "Back returns to BP1; forward path reaches respond review with focus on Continue button.",
  fail: "Back/Continue path does not reach respond review or fleet is not 3–7.",
});

add({
  title: "Assessment respond — enter 450 and Continue to GF-S",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 22 final state",
  startFocus: "Continue button on respond review screen",
  steps: [
    "Press Shift+Tab. Verify focused element: Back button.",
    "Press Shift+Tab. Verify focused element: R3 Not sure checkbox.",
    "Press Shift+Tab. Verify focused element: Average job value field.",
    "Press Shift+Tab. Verify focused element: R2 Not sure checkbox.",
    "Press Shift+Tab. Verify focused element: Missed-call rate field.",
    "Press Shift+Tab. Verify focused element: R1 Not sure checkbox.",
    "Press Shift+Tab. Verify focused element: Monthly inbound calls field.",
    "Press Command+A. Press Backspace.",
    "Type 450.",
    "Press Tab. Verify focused element: R1 Not sure checkbox.",
    "Press Tab. Verify focused element: Missed-call rate field.",
    "Press Tab. Verify focused element: R2 Not sure checkbox.",
    "Press Tab. Verify focused element: Average job value field.",
    "Press Tab. Verify focused element: R3 Not sure checkbox.",
    "Press Tab. Verify focused element: Back button.",
    "Press Tab. Verify focused element: Continue button.",
    "Press Enter.",
  ],
  expectedRenderedState:
    "GF-S question visible: How consistently do new customers find your business when they need your services?",
  finalFocus: "Document body on GF-S step",
  leavesStateForNext: "GF-S visible; Monthly inbound calls value 450; focus on document body.",
  pass: "GF-S screening question displayed and Monthly inbound calls field value is 450; after Continue focus is document body.",
  fail: "GF-S question not shown, R1 is not 450, or focus after Continue is not document body.",
});

add({
  title: "Assessment GF-S and GF follow-ups through CV-S",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 23 final state",
  startFocus: "Document body on GF-S step",
  steps: [
    CHOICE_BUTTON_MODEL,
    `Use ${SHARED_HEADER_REF}.`,
    ...answerConsistentlyAlwaysSteps(),
    "Verify rendered question: Do you track where new leads come from (calls, web, referrals, ads)?",
    `Use ${SHARED_HEADER_REF}.`,
    ...answerMostlyOftenSteps(),
    "Verify rendered question: Is your Google Business Profile complete, current, and actively managed?",
    `Use ${SHARED_HEADER_REF}.`,
    ...answerNotAtAllRarelySteps(),
    "Verify rendered question: Do you have a simple way for prospects to request service online or after hours?",
    `Use ${SHARED_HEADER_REF}.`,
    ...answerNotAtAllRarelySteps(),
    "Verify rendered question: How consistently do inbound leads convert into booked jobs or appointments?",
  ],
  expectedRenderedState: "CV-S screening question visible.",
  finalFocus: "Document body on CV-S step",
  leavesStateForNext: "CV-S question visible; GF follow-ups completed.",
  pass: "GF-F1, GF-F2, GF-F3 answered and CV-S question is displayed.",
  fail: "Any GF follow-up question text missing or CV-S not reached.",
});

add({
  title: "Assessment CV-S through MI-S to teaser",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 24 final state",
  startFocus: "Document body on CV-S step",
  steps: [
    CHOICE_BUTTON_MODEL,
    `Use ${SHARED_HEADER_REF}.`,
    ...answerNotAtAllRarelySteps(),
    "Verify rendered question: How consistently do you stay in touch with past customers to earn repeat business?",
    `Use ${SHARED_HEADER_REF}.`,
    ...answerNotAtAllRarelySteps(),
    "Verify rendered question: How much manual admin work still falls on your team for scheduling and follow-up?",
    `Use ${SHARED_HEADER_REF}.`,
    ...answerNotAtAllRarelySteps(),
    "Verify rendered question: How clearly can you see which marketing and operations efforts are working?",
    `Use ${SHARED_HEADER_REF}.`,
    ...answerNotAtAllRarelySteps(),
    "Verify heading text: Your top priority.",
    "Verify button label: Unlock Full Results.",
  ],
  expectedRenderedState: "Teaser screen with Unlock Full Results button.",
  finalFocus: "Document body on teaser step",
  leavesStateForNext: "Teaser visible; focus on document body.",
  pass: "Teaser shows Your top priority heading and Unlock Full Results button.",
  fail: "Teaser heading or Unlock Full Results button is missing.",
});

add({
  title: "Assessment stale-answer removal — full backtrack and forward",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 25 final state",
  startFocus: "Document body on teaser step (first pass)",
  steps: [
    "Press Tab. Verify focused element: Back button.",
    "Press Enter. Verify rendered question: How clearly can you see which marketing and operations efforts are working?",
    "Press Tab. Verify focused element: Back button.",
    "Press Enter. Verify rendered question: How much manual admin work still falls on your team for scheduling and follow-up?",
    "Press Tab. Verify focused element: Back button.",
    "Press Enter. Verify rendered question: How consistently do you stay in touch with past customers to earn repeat business?",
    "Press Tab. Verify focused element: Back button.",
    "Press Enter. Verify rendered question: How consistently do inbound leads convert into booked jobs or appointments?",
    "Press Tab. Verify focused element: Back button.",
    "Press Enter. Verify rendered question: Do you have a simple way for prospects to request service online or after hours?",
    "Press Tab. Verify focused element: Back button.",
    "Press Enter. Verify rendered question: Is your Google Business Profile complete, current, and actively managed?",
    "Press Tab. Verify focused element: Back button.",
    "Press Enter. Verify rendered question: Do you track where new leads come from (calls, web, referrals, ads)?",
    "Press Tab. Verify focused element: Back button.",
    "Press Enter. Verify rendered question: How consistently do new customers find your business when they need your services?",
    `Use ${SHARED_HEADER_REF}.`,
    ...answerNotAtAllRarelySteps(),
    "Verify page does NOT contain question: Do you track where new leads come from (calls, web, referrals, ads)?",
    "Verify page does NOT contain question: Is your Google Business Profile complete, current, and actively managed?",
    "Verify page does NOT contain question: Do you have a simple way for prospects to request service online or after hours?",
    `Use ${SHARED_HEADER_REF}.`,
    ...answerNotAtAllRarelySteps(),
    "Verify rendered question: How consistently do you stay in touch with past customers to earn repeat business?",
    `Use ${SHARED_HEADER_REF}.`,
    ...answerNotAtAllRarelySteps(),
    "Verify rendered question: How much manual admin work still falls on your team for scheduling and follow-up?",
    `Use ${SHARED_HEADER_REF}.`,
    ...answerNotAtAllRarelySteps(),
    "Verify rendered question: How clearly can you see which marketing and operations efforts are working?",
    `Use ${SHARED_HEADER_REF}.`,
    ...answerNotAtAllRarelySteps(),
    "Verify heading text: Your top priority.",
  ],
  expectedRenderedState:
    "Teaser screen (second time); none of the three GF-F follow-up question texts present after GF-S lowered.",
  finalFocus: "Document body on teaser step (second time)",
  leavesStateForNext: "Teaser visible after stale removal; focus on document body.",
  pass: "All three GF-F follow-up question texts are absent after GF-S is lowered; teaser reached again.",
  fail: "Any GF-F1, GF-F2, or GF-F3 question text appears after GF-S is lowered to Not at all / rarely.",
});

add({
  title: "Assessment teaser to lead gate",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 26 final state",
  startFocus: "Document body on teaser step (after stale removal)",
  steps: [
    "Press Tab. Verify focused element: Back button.",
    "Press Tab. Verify focused element: Unlock Full Results button.",
    "Press Enter.",
  ],
  expectedRenderedState: "Lead gate heading Unlock your full assessment results; all gate fields empty.",
  finalFocus: "Document body on lead gate",
  leavesStateForNext: "Lead gate visible; all fields empty; SMS consent unchecked; focus on document body.",
  pass: "Lead gate form visible with empty fields and SMS consent checkbox unchecked.",
  fail: "Lead gate not displayed or any field is prefilled.",
});

add({
  title: "Lead gate invalid submit",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 27 final state",
  startFocus: "Document body on lead gate",
  steps: [
    "Press Tab. Verify focused element: First name field.",
    "Type one space character.",
    "Press Tab. Verify focused element: Last name field. Type Testowner.",
    "Press Tab. Verify focused element: Business name field. Type Owner QA Fake HVAC Co.",
    "Press Tab. Verify focused element: Email field. Type owner-qa-fake@example.invalid.",
    "Press Tab. Verify focused element: Phone field. Type 5550100199.",
    "Press Tab. Verify focused element: SMS consent checkbox (unchecked).",
    "Press Tab. Verify focused element: See My Full Results button.",
    "Press Enter.",
  ],
  expectedRenderedState: "Alert with text: First name is required.",
  finalFocus: "See My Full Results button",
  leavesStateForNext: "Validation alert visible; SMS consent unchecked; focus on See My Full Results button.",
  pass: "Alert displays exactly First name is required. and focus remains on See My Full Results button.",
  fail: "Alert text differs, alert missing, or focus is not on See My Full Results button.",
});

add({
  title: "Lead gate SMS consent toggle",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 28 final state",
  startFocus: "See My Full Results button",
  steps: [
    "Press Shift+Tab. Verify focused element: SMS consent checkbox (unchecked).",
    "Press Space. Verify checkbox is checked.",
    "Press Space. Verify checkbox is unchecked.",
  ],
  expectedRenderedState: "Lead gate form still visible.",
  finalFocus: "SMS consent checkbox (unchecked)",
  leavesStateForNext: "SMS consent unchecked; focus on SMS consent checkbox.",
  pass: "Checkbox toggles checked then returns unchecked; final focus on SMS consent checkbox.",
  fail: "Checkbox does not toggle or ends checked.",
});

add({
  title: "Lead gate valid submission to results",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 29 final state",
  startFocus: "SMS consent checkbox (unchecked)",
  steps: [
    "Press Shift+Tab. Verify focused element: Phone field.",
    "Press Shift+Tab. Verify focused element: Email field.",
    "Press Shift+Tab. Verify focused element: Business name field.",
    "Press Shift+Tab. Verify focused element: Last name field.",
    "Press Shift+Tab. Verify focused element: First name field.",
    "Press Command+A. Press Backspace.",
    "Type Alex.",
    "Press Tab. Verify focused element: Last name field (value Testowner).",
    "Press Tab. Verify focused element: Business name field (value Owner QA Fake HVAC Co).",
    "Press Tab. Verify focused element: Email field (value owner-qa-fake@example.invalid).",
    "Press Tab. Verify focused element: Phone field (value 5550100199).",
    "Press Tab. Verify focused element: SMS consent checkbox (leave unchecked).",
    "Press Tab. Verify focused element: See My Full Results button.",
    "Press Enter.",
  ],
  expectedRenderedState: "Results heading Your priority areas; Download Assessment Report button visible.",
  finalFocus: "Document body on results page",
  leavesStateForNext: "Results page rendered; SMS consent was not checked; focus on document body.",
  pass: "Your priority areas heading and Download Assessment Report button visible after submission with SMS consent unchecked.",
  fail: "Results page not shown or submission error alert appears.",
});

add({
  title: "Report download first attempt — 503 alert",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 30 final state",
  startFocus: "Document body on results page",
  steps: [
    "Press Tab. Verify focused element: Book a Meeting link.",
    "Press Tab. Verify focused element: Book a Meeting button.",
    "Press Tab. Verify focused element: Download Assessment Report button.",
    "Press Enter.",
    "Read role=alert region text.",
  ],
  expectedRenderedState:
    "Alert text: Report temporarily unavailable. Please try again in a moment.; Your priority areas still visible; Try downloading report again button visible.",
  finalFocus: "Download Assessment Report button",
  leavesStateForNext: "503 alert visible; results page rendered; focus on Download Assessment Report button.",
  pass: "Alert text matches exactly; results remain visible; Try downloading report again button is present.",
  fail: "Alert text differs, results disappear, or retry button missing.",
});

add({
  title: "Report download retry success",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 31 final state",
  startFocus: "Download Assessment Report button",
  steps: [
    "Press Tab. Verify focused element: Try downloading report again button.",
    "Press Enter.",
  ],
  expectedRenderedState:
    "Chrome opens a new tab with PDF viewer (blob: URL); original tab still shows Your priority areas.",
  finalFocus: "PDF viewer tab (new tab active)",
  leavesStateForNext: "PDF tab active; results tab remains open in background.",
  pass: "New PDF tab opens and results tab still shows Your priority areas.",
  fail: "No PDF tab opens or results tab is closed.",
});

add({
  title: "Return from PDF viewer — results tab active",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 32 final state",
  startFocus: "PDF viewer tab",
  steps: ["Press Command+W to close the PDF tab."],
  expectedRenderedState: "Original results tab active with Your priority areas visible.",
  finalFocus: "Document body on results page",
  leavesStateForNext: "Results page active; focus on document body; fail-once attempt consumed.",
  pass: "PDF tab closes and results tab is active without using Tab on PDF-only controls.",
  fail: "Wrong tab closed or results page is not visible.",
});

add({
  title: "Report download repeat access",
  viewport: DESKTOP_VP,
  startUrl: null,
  startState: "Check 33 final state",
  startFocus: "Document body on results page",
  steps: [
    "Press Tab. Verify focused element: Book a Meeting link.",
    "Press Tab. Verify focused element: Book a Meeting button.",
    "Press Tab. Verify focused element: Download Assessment Report button.",
    "Press Enter.",
  ],
  expectedRenderedState: "Chrome opens PDF in new tab immediately with no 503 alert.",
  finalFocus: "PDF viewer tab (new tab active)",
  leavesStateForNext: "Second PDF download succeeded.",
  pass: "Second download opens PDF without 503 alert or fail-once message.",
  fail: "503 alert reappears or download fails.",
});

const md = [
  "# PHASE 2 — OWNER KEYBOARD QA HANDOFF (A11Y-090 v5)",
  "",
  "## SHA TABLE",
  "",
  "| Field | Value |",
  "|---|---|",
  "| Previous executable preview SHA | `c8e92da4674b3077d4dc598c6c154f75b1658d52` |",
  `| New final executable preview SHA | \`${EXECUTABLE_SHA}\` |`,
  "| Supersedes (prior closeout executable) | `e17a72b99f8dc37930fe381bd2293af15a551720` |",
  "| Full evidence-only HEAD built on final executable SHA | (set after evidence commit) |",
  "| Actual current PR #97 HEAD | (set after evidence commit) |",
  "| Evidence-only HEAD and PR HEAD same commit? | (set after evidence commit) |",
  "| Historical/superseded SHA (prior f3b09ac round; not Chris checkout chain) | `491e4adbcc3df96cc524e95c7232c5d95473c6d7` |",
  "",
  "## CHECKOUT",
  "",
  "```bash",
  `git checkout ${EXECUTABLE_SHA}`,
  "```",
  "",
  "## PREREQUISITES",
  "",
  "- macOS with Google Chrome",
  "- Bun installed",
  "- Docker Desktop running",
  "- Physical keyboard only",
  "- Fake data only (Section Fake Data)",
  "- Do not set PHASE2_OWNER_QA_REPORT_FAIL_ONCE or PHASE2_SAFE_PREVIEW manually",
  "",
  "## SECRET-SAFE PREPARATION",
  "",
  "```bash",
  "bun run scripts/phase2/prepare-safe-preview-deps.ts",
  "```",
  "",
  `Allowed prep hosts (exact): ${ALLOWED_PREP_HOSTS.join(", ")}.`,
  "",
  "**Stop if you see:** ERROR: preparation egress policy failed; ERROR: bun.lock changed; ERROR: frozen lockfile install failed; ERROR: Docker is unavailable; ERROR: Docker image build failed.",
  "",
  "## PREVIEW START",
  "",
  "```bash",
  "bun run scripts/phase2/start-safe-assessment-preview.ts",
  "```",
  "",
  "**URL:** http://127.0.0.1:3000",
  "",
  "**Stop if you see:** ERROR: Safe preview cannot start without secret-safe preparation; ERROR: iptables unavailable; ERROR: cannot configure iptables.",
  "",
  "## VIEWPORT SETUP",
  "",
  VIEWPORT_SETUP,
  "",
  "## FAKE DATA",
  "",
  "| Field | Value |",
  "|---|---|",
  "| First name | Alex |",
  "| Last name | Testowner |",
  "| Business | Owner QA Fake HVAC Co |",
  "| Email | owner-qa-fake@example.invalid |",
  "| Phone | 5550100199 |",
  "",
  "## CONTROL MODELS (verified by automated supplements)",
  "",
  "### BP1/BP2 (X-SAFE-PREVIEW-FOCUS-04)",
  "- BP1 Trade select: native SELECT; ArrowDown changes option; Tab moves to Continue; Enter advances to BP2 with focus on document body.",
  "- BP2 Fleet size select: native SELECT; Shift+Tab from body reaches select; ArrowDown changes option; Tab to Back then Continue; Enter advances to respond review with focus on Continue button.",
  "",
  "### Screening choices (X-SAFE-PREVIEW-FOCUS-02)",
  "- BUTTON with aria-pressed; Tab between choices; Space selects; Tab to Not sure, Back, Continue; Enter advances.",
  "",
  `## ${SHARED_HEADER_REF}`,
  "",
  "From 624 Voice header link:",
  ...HEADER_STEPS_FROM_624.map((s, i) => `${i + 1}. ${s.replace("Press Tab. Verify focused element: ", "Tab → ")}`),
  "",
  "## KEYBOARD CHECKS",
  "",
  `**Total checks: ${checks.length}**`,
  "",
  ...checks.map(formatCheck),
  "",
  "## SHUTDOWN",
  "",
  "Press Ctrl+C in the preview terminal. Confirm the Docker container stops.",
  "",
  "## OWNER ATTESTATION (blank)",
  "",
  "| Field | Value |",
  "|---|---|",
  `| Tested SHA | ${EXECUTABLE_SHA} |`,
  "| Operator | |",
  "| Executed at (ISO) | |",
  "| Confirmed physical keyboard only | |",
  "| Confirmed no production credentials | |",
  "| Confirmed no live external side effects | |",
  ...checks.map((c) => `| Check ${c.id} result | |`),
  "| Final conclusion | |",
  "",
  "Private implementation remains in progress. Awaiting owner keyboard QA.",
  "",
].join("\n");

mkdirSync(join(REPO_ROOT, "review-artifacts/phase2"), { recursive: true });
writeFileSync(OUT, md);
const hash = createHash("sha256").update(md).digest("hex");
writeFileSync(
  join(REPO_ROOT, "review-artifacts/phase2/owner-keyboard-walkthrough-v5.sha256"),
  `${hash}  owner-keyboard-walkthrough-v5.md\n`,
);
console.log(JSON.stringify({ out: OUT, checks: checks.length, sha256: hash }, null, 2));
