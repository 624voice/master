/**
 * Generates mechanically audited owner keyboard walkthrough procedure JSON.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REPO_ROOT = join(import.meta.dir, "../..");
const OUT = join(REPO_ROOT, "review-artifacts/phase2/owner-keyboard-walkthrough-procedure.json");
const FOCUS = join(REPO_ROOT, "review-artifacts/phase2/owner-focus-order-sequences.json");

const EXECUTABLE_SHA =
  spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).stdout.trim();

type Check = {
  id: number;
  title: string;
  viewport: string;
  startUrl: string | null;
  startState: string;
  startFocus: string;
  steps: string[];
  expectedRenderedState: string;
  finalFocus: string;
  leavesStateForNext: string | null;
  pass: string;
  fail: string;
};

const checks: Check[] = [];

const DESKTOP = "Chrome DevTools Responsive mode: width 1280 CSS px, height 900 CSS px (Command+Option+I → device toolbar → Responsive → enter 1280 × 900)";
const MOBILE = "Chrome DevTools Responsive mode: width 375 CSS px, height 800 CSS px (Command+Option+I → device toolbar → Responsive → enter 375 × 800)";

const RESET_STEPS = [
  "Command+L, type the check URL, press Enter.",
  "Press Tab once.",
  "Verify focused element is the 624 Voice header link.",
];

const HEADER_FROM_624 = [
  "Press Tab. Verify focus: What We Do header link.",
  "Press Tab. Verify focus: How We Work header link.",
  "Press Tab. Verify focus: Live Demo header link.",
  "Press Tab. Verify focus: Free Assessment header link.",
  "Press Tab. Verify focus: About header link.",
  "Press Tab. Verify focus: Book Your AI Growth Systems Consultation header link.",
];

function add(c: Omit<Check, "id">): void {
  checks.push({ id: checks.length + 1, ...c });
}

add({
  title: "Desktop header nav — five Tabs from 624 Voice to About",
  viewport: DESKTOP,
  startUrl: "http://127.0.0.1:3000/",
  startState: "Fresh page load",
  startFocus: "Document body (no control focused) before reset Tab",
  steps: [...RESET_STEPS, ...HEADER_FROM_624.slice(0, 5)],
  expectedRenderedState: "Home page rendered; desktop header visible.",
  finalFocus: "About header link",
  leavesStateForNext: "Focus on About header link.",
  pass: "After reset Tab (624 Voice) and exactly five additional Tab presses, focus is the About header link with no skipped header links.",
  fail: "About is not focused, a header link is skipped, or fewer or more than five Tab presses were required from 624 Voice.",
});

add({
  title: "Desktop header nav — sixth Tab reaches Book consultation",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 1 final state",
  startFocus: "About header link",
  steps: ["Press Tab. Verify focus: Book Your AI Growth Systems Consultation header link."],
  expectedRenderedState: "Home page rendered.",
  finalFocus: "Book Your AI Growth Systems Consultation header link",
  leavesStateForNext: "Focus on Book Your AI Growth Systems Consultation header link.",
  pass: "One Tab from About focuses Book Your AI Growth Systems Consultation.",
  fail: "Book Your AI Growth Systems Consultation is not focused.",
});

add({
  title: "Mobile nav — Enter opens menu",
  viewport: MOBILE,
  startUrl: "http://127.0.0.1:3000/",
  startState: "Fresh page load",
  startFocus: "Document body before reset Tab",
  steps: [
    ...RESET_STEPS,
    "Press Tab. Verify focus: Mobile navigation menu summary control.",
    "Press Enter.",
  ],
  expectedRenderedState: "Mobile navigation panel visible below header.",
  finalFocus: "Mobile navigation menu summary control",
  leavesStateForNext: "Mobile menu open; focus on summary control.",
  pass: "Menu panel is visible and summary retains focus after Enter.",
  fail: "Menu panel does not open or Enter navigates away from the page.",
});

add({
  title: "Mobile nav links in order after menu open",
  viewport: MOBILE,
  startUrl: null,
  startState: "Check 3 final state",
  startFocus: "Mobile navigation menu summary control (menu open)",
  steps: [
    "Press Tab. Verify focus: What We Do mobile nav link.",
    "Press Tab. Verify focus: How We Work mobile nav link.",
    "Press Tab. Verify focus: Live Demo mobile nav link.",
    "Press Tab. Verify focus: Free Assessment mobile nav link.",
    "Press Tab. Verify focus: About mobile nav link.",
    "Press Tab. Verify focus: Book Your AI Growth Systems Consultation mobile nav link.",
  ],
  expectedRenderedState: "Mobile navigation panel open.",
  finalFocus: "Book Your AI Growth Systems Consultation mobile nav link",
  leavesStateForNext: "Mobile menu open; focus on Book mobile nav link.",
  pass: "All six mobile nav links receive focus in listed order with one Tab each.",
  fail: "Any listed mobile nav link is skipped or not focusable.",
});

add({
  title: "Mobile nav — Escape closes menu",
  viewport: MOBILE,
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

function routeCheck(
  title: string,
  url: string,
  afterHeaderSteps: string[],
  finalFocus: string,
  rendered: string,
): void {
  add({
    title,
    viewport: DESKTOP,
    startUrl: url,
    startState: "Fresh page load",
    startFocus: "Document body before reset Tab",
    steps: [...RESET_STEPS, ...HEADER_FROM_624, ...afterHeaderSteps],
    expectedRenderedState: rendered,
    finalFocus,
    leavesStateForNext: `Focus on ${finalFocus}.`,
    pass: `Each listed key press moves focus to the named element; final focus is ${finalFocus}.`,
    fail: "Any named element is missing, out of order, or not focusable.",
  });
}

routeCheck(
  "Home / keyboard reachability",
  "http://127.0.0.1:3000/",
  [
    "Press Tab. Verify focus: Book Your AI Growth Systems Consultation hero link.",
    "Press Tab. Verify focus: Get Your Free Assessment link.",
    "Press Tab. Verify focus: See the System Work link.",
  ],
  "See the System Work link",
  "Home page hero and links rendered.",
);

add({
  title: "Home / focus visible",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 6 final state",
  startFocus: "See the System Work link",
  steps: ["Observe the focused link for a visible focus indicator (ring or outline)."],
  expectedRenderedState: "See the System Work link remains focused.",
  finalFocus: "See the System Work link with visible focus indicator",
  leavesStateForNext: "Focus on See the System Work link.",
  pass: "Focus indicator is visibly distinct on See the System Work.",
  fail: "No visible focus indicator on the focused link.",
});

routeCheck(
  "/what-we-do keyboard reachability",
  "http://127.0.0.1:3000/what-we-do",
  ["Press Tab. Verify focus: See How the Journey Fits Together link."],
  "See How the Journey Fits Together link",
  "What We Do page rendered.",
);

add({
  title: "/what-we-do focus visible",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 8 final state",
  startFocus: "See How the Journey Fits Together link",
  steps: ["Observe visible focus indicator on See How the Journey Fits Together."],
  expectedRenderedState: "What We Do page rendered.",
  finalFocus: "See How the Journey Fits Together link with visible focus indicator",
  leavesStateForNext: "Focus on See How the Journey Fits Together link.",
  pass: "Focus indicator visible on See How the Journey Fits Together.",
  fail: "No visible focus indicator on the focused link.",
});

routeCheck(
  "/how-we-work keyboard reachability",
  "http://127.0.0.1:3000/how-we-work",
  [
    "Press Tab. Verify focus: Book Your AI Growth Systems Consultation page CTA link.",
    "Press Tab. Verify focus: Get Your Free Assessment link.",
  ],
  "Get Your Free Assessment link",
  "How We Work page rendered.",
);

add({
  title: "/how-we-work focus visible",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 10 final state",
  startFocus: "Get Your Free Assessment link",
  steps: ["Observe visible focus indicator on Get Your Free Assessment."],
  expectedRenderedState: "How We Work page rendered.",
  finalFocus: "Get Your Free Assessment link with visible focus indicator",
  leavesStateForNext: "Focus on Get Your Free Assessment link.",
  pass: "Focus indicator visible on Get Your Free Assessment.",
  fail: "No visible focus indicator on the focused link.",
});

routeCheck(
  "/demo keyboard reachability",
  "http://127.0.0.1:3000/demo",
  [
    "Press Tab. Verify focus: Start your demo with Jessica button.",
    "Press Tab. Verify focus: Start live demo with Jessica button.",
  ],
  "Start live demo with Jessica button",
  "Live Demo page rendered.",
);

add({
  title: "/demo focus visible",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 12 final state",
  startFocus: "Start live demo with Jessica button",
  steps: ["Observe visible focus indicator on Start live demo with Jessica."],
  expectedRenderedState: "Live Demo page rendered.",
  finalFocus: "Start live demo with Jessica button with visible focus indicator",
  leavesStateForNext: "Focus on Start live demo with Jessica button.",
  pass: "Focus indicator visible on Start live demo with Jessica.",
  fail: "No visible focus indicator on the focused button.",
});

routeCheck(
  "/about keyboard reachability",
  "http://127.0.0.1:3000/about",
  [
    "Press Tab. Verify focus: Book Your AI Growth Systems Consultation page CTA link.",
    "Press Tab. Verify focus: Get Your Free Assessment link.",
  ],
  "Get Your Free Assessment link",
  "About page rendered.",
);

add({
  title: "/about focus visible",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 14 final state",
  startFocus: "Get Your Free Assessment link",
  steps: ["Observe visible focus indicator on Get Your Free Assessment."],
  expectedRenderedState: "About page rendered.",
  finalFocus: "Get Your Free Assessment link with visible focus indicator",
  leavesStateForNext: "Focus on Get Your Free Assessment link.",
  pass: "Focus indicator visible on Get Your Free Assessment.",
  fail: "No visible focus indicator on the focused link.",
});

routeCheck(
  "/contact keyboard reachability",
  "http://127.0.0.1:3000/contact",
  [
    "Press Tab. Verify focus: First name field (#firstName).",
    "Press Tab. Verify focus: Last name field (#lastName).",
    "Press Tab. Verify focus: Business name field (#businessName).",
    "Press Tab. Verify focus: Trade select (#trade).",
  ],
  "Trade select (#trade)",
  "Contact form rendered.",
);

add({
  title: "/contact focus visible",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 16 final state",
  startFocus: "Trade select (#trade)",
  steps: ["Observe visible focus indicator on #trade."],
  expectedRenderedState: "Contact form rendered.",
  finalFocus: "Trade select (#trade) with visible focus indicator",
  leavesStateForNext: "Focus on #trade.",
  pass: "Focus indicator visible on #trade.",
  fail: "No visible focus indicator on #trade.",
});

add({
  title: "/services redirect",
  viewport: DESKTOP,
  startUrl: "http://127.0.0.1:3000/services",
  startState: "Fresh navigation",
  startFocus: "Address bar",
  steps: [
    "Command+L, type http://127.0.0.1:3000/services, press Enter.",
    "Command+L, read address bar URL.",
  ],
  expectedRenderedState: "What We Do page content rendered.",
  finalFocus: "Address bar showing http://127.0.0.1:3000/what-we-do",
  leavesStateForNext: "Browser at /what-we-do.",
  pass: "Address bar reads http://127.0.0.1:3000/what-we-do after loading /services.",
  fail: "Address bar does not read http://127.0.0.1:3000/what-we-do.",
});

routeCheck(
  "404 keyboard reachability",
  "http://127.0.0.1:3000/does-not-exist-404",
  ["Press Tab. Verify focus: Back to Home link."],
  "Back to Home link",
  "404 page with Back to Home link rendered.",
);

add({
  title: "404 focus visible",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 19 final state",
  startFocus: "Back to Home link",
  steps: ["Observe visible focus indicator on Back to Home."],
  expectedRenderedState: "404 page rendered.",
  finalFocus: "Back to Home link with visible focus indicator",
  leavesStateForNext: "Focus on Back to Home link.",
  pass: "Focus indicator visible on Back to Home.",
  fail: "No visible focus indicator on Back to Home.",
});

add({
  title: "Assessment BP1 — select HVAC and Continue",
  viewport: DESKTOP,
  startUrl: "http://127.0.0.1:3000/assessment",
  startState: "Fresh page load",
  startFocus: "Document body before reset Tab",
  steps: [
    ...RESET_STEPS,
    ...HEADER_FROM_624,
    "Press Tab. Verify focus: #assessment-bp1 trade select.",
    "Press ArrowDown. Verify selected option label: Plumbers.",
    "Press ArrowDown. Verify selected option label: Electricians.",
    "Press ArrowDown. Verify selected option label: HVAC.",
    "Press Tab. Verify focus: Continue button.",
    "Press Enter.",
  ],
  expectedRenderedState: "BP2 fleet-size question rendered; #assessment-bp2 visible.",
  finalFocus: "Document body (no control focused) on BP2 step",
  leavesStateForNext: "BP2 step visible; trade=HVAC; focus on document body.",
  pass: "BP2 fleet question is displayed and trade select value is HVAC.",
  fail: "BP2 not shown or trade is not HVAC.",
});

add({
  title: "Assessment BP2 — select 3-7, return to BP1, forward again to respond review",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 21 final state",
  startFocus: "Document body on BP2 step",
  steps: [
    "Press Shift+Tab. Verify focus: Back button.",
    "Press Shift+Tab. Verify focus: #assessment-bp2 fleet select.",
    "Press ArrowDown. Verify selected option label: 1–2 vehicles.",
    "Press ArrowDown. Verify selected option label: 3–7 vehicles.",
    "Press Tab. Verify focus: Back button.",
    "Press Enter. Verify screen: BP1 trade select (#assessment-bp1) visible.",
    "Press Tab. Verify focus: Continue button.",
    "Press Enter. Verify screen: BP2 fleet select visible.",
    "Press Shift+Tab. Verify focus: #assessment-bp2 fleet select.",
    "Press ArrowDown. Verify selected option label: 1–2 vehicles.",
    "Press ArrowDown. Verify selected option label: 3–7 vehicles.",
    "Press Tab. Verify focus: Back button.",
    "Press Tab. Verify focus: Continue button.",
    "Press Enter.",
  ],
  expectedRenderedState: "Respond review screen with #respond-R1 visible.",
  finalFocus: "Continue button on respond review screen",
  leavesStateForNext: "Respond review visible; fleet=3-7; focus on Continue button.",
  pass: "Back returns to BP1; forward path reaches respond review with #respond-R1 and focus on Continue.",
  fail: "Back/Continue path does not reach respond review or fleet is not 3-7.",
});

add({
  title: "Assessment respond — enter 450 and Continue to GF-S",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 22 final state",
  startFocus: "Continue button on respond review screen",
  steps: [
    "Press Shift+Tab. Verify focus: Back button.",
    "Press Shift+Tab. Verify focus: R3 Not sure checkbox.",
    "Press Shift+Tab. Verify focus: #respond-R3.",
    "Press Shift+Tab. Verify focus: R2 Not sure checkbox.",
    "Press Shift+Tab. Verify focus: #respond-R2.",
    "Press Shift+Tab. Verify focus: R1 Not sure checkbox.",
    "Press Shift+Tab. Verify focus: #respond-R1 Monthly inbound calls field.",
    "Press Command+A. Press Backspace.",
    "Type 450.",
    "Press Tab. Verify focus: R1 Not sure checkbox.",
    "Press Tab. Verify focus: #respond-R2.",
    "Press Tab. Verify focus: R2 Not sure checkbox.",
    "Press Tab. Verify focus: #respond-R3.",
    "Press Tab. Verify focus: R3 Not sure checkbox.",
    "Press Tab. Verify focus: Back button.",
    "Press Tab. Verify focus: Continue button.",
    "Press Enter.",
  ],
  expectedRenderedState: "GF-S question text visible: How consistently do new customers find your business when they need your services?",
  finalFocus: "Document body on GF-S step",
  leavesStateForNext: "GF-S question visible; #respond-R1 value 450; focus on document body.",
  pass: "GF-S screening question is displayed and Monthly inbound calls field value is 450.",
  fail: "GF-S question not shown or R1 is not 450.",
});

const CHOICE_MODEL =
  "Choice answers are BUTTON elements with aria-pressed (not native radio). Use Tab between choices and Space to select the focused button.";

const HEADER_FROM_BODY = [
  "Press Tab. Verify focus: 624 Voice header link.",
  "Press Tab. Verify focus: What We Do header link.",
  "Press Tab. Verify focus: How We Work header link.",
  "Press Tab. Verify focus: Live Demo header link.",
  "Press Tab. Verify focus: Free Assessment header link.",
  "Press Tab. Verify focus: About header link.",
  "Press Tab. Verify focus: Book Your AI Growth Systems Consultation header link.",
];

const CHOICE_TRAIL = [
  "Press Tab. Verify focus: Not sure button.",
  "Press Tab. Verify focus: Back button.",
  "Press Tab. Verify focus: Continue button.",
  "Press Enter.",
];

function answerNotAtAllRarely(): string[] {
  return [
    ...HEADER_FROM_BODY,
    "Press Tab. Verify focus: Not at all / rarely button.",
    "Press Space. Verify aria-pressed true on Not at all / rarely.",
    ...CHOICE_TRAIL,
  ];
}

function answerMostlyOften(): string[] {
  return [
    ...HEADER_FROM_BODY,
    "Press Tab. Verify focus: Not at all / rarely button.",
    "Press Tab. Verify focus: Somewhat / occasionally button.",
    "Press Tab. Verify focus: Mostly / often button.",
    "Press Space. Verify aria-pressed true on Mostly / often.",
    ...CHOICE_TRAIL,
  ];
}

add({
  title: "Assessment GF-S and GF follow-ups through CV-S",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 23 final state",
  startFocus: "Document body on GF-S step",
  steps: [
    CHOICE_MODEL,
    "Press Tab. Verify focus: 624 Voice header link.",
    "Press Tab. Verify focus: What We Do header link.",
    "Press Tab. Verify focus: How We Work header link.",
    "Press Tab. Verify focus: Live Demo header link.",
    "Press Tab. Verify focus: Free Assessment header link.",
    "Press Tab. Verify focus: About header link.",
    "Press Tab. Verify focus: Book Your AI Growth Systems Consultation header link.",
    "Press Tab. Verify focus: Not at all / rarely button.",
    "Press Tab. Verify focus: Somewhat / occasionally button.",
    "Press Tab. Verify focus: Mostly / often button.",
    "Press Tab. Verify focus: Consistently / always button.",
    "Press Space. Verify aria-pressed true on Consistently / always.",
    "Press Tab. Verify focus: Not sure button.",
    "Press Tab. Verify focus: Back button.",
    "Press Tab. Verify focus: Continue button.",
    "Press Enter. Verify question: Do you track where new leads come from (calls, web, referrals, ads)?",
    ...answerMostlyOften(),
    "Verify question: Is your Google Business Profile complete, current, and actively managed?",
    ...answerNotAtAllRarely(),
    "Verify question: Do you have a simple way for prospects to request service online or after hours?",
    ...answerNotAtAllRarely(),
    "Verify question: How consistently do inbound leads convert into booked jobs or appointments?",
  ],
  expectedRenderedState: "CV-S screening question visible.",
  finalFocus: "Document body on CV-S step",
  leavesStateForNext: "CV-S question visible; GF follow-ups completed.",
  pass: "GF-F1, GF-F2, GF-F3 answered and CV-S question is displayed.",
  fail: "Any GF follow-up question text missing or CV-S not reached.",
});

add({
  title: "Assessment CV-S through MI-S to teaser",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 23 final state",
  startFocus: "Document body on CV-S step",
  steps: [
    CHOICE_MODEL,
    ...answerNotAtAllRarely(),
    "Verify question: How consistently do you stay in touch with past customers to earn repeat business?",
    ...answerNotAtAllRarely(),
    "Verify question: How much manual admin work still falls on your team for scheduling and follow-up?",
    ...answerNotAtAllRarely(),
    "Verify question: How clearly can you see which marketing and operations efforts are working?",
    ...answerNotAtAllRarely(),
    "Verify heading text: Your top priority.",
    "Verify button label: Unlock Full Results.",
  ],
  expectedRenderedState: "Teaser screen with Unlock Full Results button.",
  finalFocus: "Document body on teaser step",
  leavesStateForNext: "Teaser visible; focus on document body.",
  pass: "Teaser shows Your top priority and Unlock Full Results button.",
  fail: "Teaser heading or Unlock Full Results button is missing.",
});

add({
  title: "Assessment stale-answer removal — backtrack and GF-S lower",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 25 final state",
  startFocus: "Document body on teaser step (first pass)",
  steps: [
    "Press Tab. Verify focus: Back button.",
    "Press Enter. Verify question: How clearly can you see which marketing and operations efforts are working? (MI-S)",
    "Press Tab. Verify focus: Back button.",
    "Press Enter. Verify question: How much manual admin work still falls on your team for scheduling and follow-up? (RM-S)",
    "Press Tab. Verify focus: Back button.",
    "Press Enter. Verify question: How consistently do you stay in touch with past customers to earn repeat business? (RG-S)",
    "Press Tab. Verify focus: Back button.",
    "Press Enter. Verify question: How consistently do inbound leads convert into booked jobs or appointments? (CV-S)",
    "Press Tab. Verify focus: Back button.",
    "Press Enter. Verify question: Do you have a simple way for prospects to request service online or after hours? (GF-F3)",
    "Press Tab. Verify focus: Back button.",
    "Press Enter. Verify question: Is your Google Business Profile complete, current, and actively managed? (GF-F2)",
    "Press Tab. Verify focus: Back button.",
    "Press Enter. Verify question: Do you track where new leads come from (calls, web, referrals, ads)? (GF-F1)",
    "Press Tab. Verify focus: Back button.",
    "Press Enter. Verify question: How consistently do new customers find your business when they need your services? (GF-S)",
    ...HEADER_FROM_BODY,
    "Press Tab. Verify focus: Not at all / rarely button.",
    "Press Space. Verify aria-pressed true on Not at all / rarely (lowering GF-S from Consistently / always).",
    ...CHOICE_TRAIL,
    "Verify page does NOT contain: Do you track where new leads come from (calls, web, referrals, ads)?",
    "Verify page does NOT contain: Is your Google Business Profile complete, current, and actively managed?",
    "Verify page does NOT contain: Do you have a simple way for prospects to request service online or after hours?",
    ...answerNotAtAllRarely(),
    "Verify question: How consistently do you stay in touch with past customers to earn repeat business? (RG-S)",
    ...answerNotAtAllRarely(),
    "Verify question: How much manual admin work still falls on your team for scheduling and follow-up? (RM-S)",
    ...answerNotAtAllRarely(),
    "Verify question: How clearly can you see which marketing and operations efforts are working? (MI-S)",
    ...answerNotAtAllRarely(),
    "Verify heading text: Your top priority.",
  ],
  expectedRenderedState: "Teaser screen (second time); none of GF-F1/GF-F2/GF-F3 question texts present after GF-S lowered.",
  finalFocus: "Document body on teaser step (second time)",
  leavesStateForNext: "Teaser visible after stale removal; focus on document body.",
  pass: "All three GF-F follow-up question texts are absent after GF-S is lowered; teaser reached again.",
  fail: "Any GF-F1, GF-F2, or GF-F3 question text appears after GF-S is lowered to Not at all / rarely.",
});

add({
  title: "Assessment teaser to lead gate",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 26 final state",
  startFocus: "Document body on teaser step (after stale removal)",
  steps: [
    "Press Tab. Verify focus: Back button.",
    "Press Tab. Verify focus: Unlock Full Results button.",
    "Press Enter.",
  ],
  expectedRenderedState: "Lead gate heading: Unlock your full assessment results; all gate fields empty.",
  finalFocus: "Document body on lead gate",
  leavesStateForNext: "Lead gate visible; all fields empty; SMS consent unchecked; focus on document body.",
  pass: "Lead gate form is visible with empty fields and SMS consent checkbox unchecked.",
  fail: "Lead gate not displayed or any field is prefilled.",
});

add({
  title: "Lead gate invalid submit",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 27 final state",
  startFocus: "Document body on lead gate",
  steps: [
    "Press Tab. Verify focus: #gate-first-name.",
    "Type one space character.",
    "Press Tab. Verify focus: #gate-last-name.",
    "Type Testowner.",
    "Press Tab. Verify focus: #gate-business.",
    "Type Owner QA Fake HVAC Co.",
    "Press Tab. Verify focus: #gate-email.",
    "Type owner-qa-fake@example.invalid.",
    "Press Tab. Verify focus: #gate-phone.",
    "Type 5550100199.",
    "Press Tab. Verify focus: SMS consent checkbox (unchecked).",
    "Press Tab. Verify focus: See My Full Results button.",
    "Press Enter.",
  ],
  expectedRenderedState: "Alert role=alert with text: First name is required.",
  finalFocus: "See My Full Results button",
  leavesStateForNext: "Validation alert visible; SMS consent unchecked; focus on See My Full Results button.",
  pass: "Alert displays exactly First name is required. and focus remains on See My Full Results button.",
  fail: "Alert text differs, alert missing, or focus is not on See My Full Results button.",
});

add({
  title: "Lead gate SMS consent toggle",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 28 final state",
  startFocus: "See My Full Results button",
  steps: [
    "Press Shift+Tab. Verify focus: SMS consent checkbox.",
    "Verify checkbox is unchecked.",
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
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 29 final state",
  startFocus: "SMS consent checkbox (unchecked)",
  steps: [
    "Press Shift+Tab. Verify focus: #gate-phone.",
    "Press Shift+Tab. Verify focus: #gate-email.",
    "Press Shift+Tab. Verify focus: #gate-business.",
    "Press Shift+Tab. Verify focus: #gate-last-name.",
    "Press Shift+Tab. Verify focus: #gate-first-name.",
    "Press Command+A. Press Backspace.",
    "Type Alex.",
    "Press Tab. Verify focus: #gate-last-name (value Testowner).",
    "Press Tab. Verify focus: #gate-business (value Owner QA Fake HVAC Co).",
    "Press Tab. Verify focus: #gate-email (value owner-qa-fake@example.invalid).",
    "Press Tab. Verify focus: #gate-phone (value 5550100199).",
    "Press Tab. Verify focus: SMS consent checkbox (leave unchecked).",
    "Press Tab. Verify focus: See My Full Results button.",
    "Press Enter.",
  ],
  expectedRenderedState: "Results heading: Your priority areas; Download Assessment Report button visible.",
  finalFocus: "Document body on results page",
  leavesStateForNext: "Results page rendered; SMS consent was not checked; focus on document body.",
  pass: "Your priority areas heading and Download Assessment Report button are visible after submission with SMS consent unchecked.",
  fail: "Results page not shown or submission error alert appears.",
});

add({
  title: "Report download first attempt — 503 alert",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 30 final state",
  startFocus: "Document body on results page",
  steps: [
    "Press Tab. Verify focus: Book a Meeting link.",
    "Press Tab. Verify focus: Book a Meeting button.",
    "Press Tab. Verify focus: Download Assessment Report button.",
    "Press Enter.",
    "Read role=alert region text.",
  ],
  expectedRenderedState: "Alert text: Report temporarily unavailable. Please try again in a moment.; Your priority areas still visible; Try downloading report again button visible.",
  finalFocus: "Download Assessment Report button",
  leavesStateForNext: "503 alert visible; results page rendered; focus on Download Assessment Report button.",
  pass: "Alert text matches exactly; results remain visible; Try downloading report again button is present.",
  fail: "Alert text differs, results disappear, or retry button missing.",
});

add({
  title: "Report download retry success",
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 31 final state",
  startFocus: "Download Assessment Report button",
  steps: [
    "Press Tab. Verify focus: Try downloading report again button.",
    "Press Enter.",
  ],
  expectedRenderedState: "Chrome opens a new tab with PDF viewer (blob: URL); original tab still shows Your priority areas.",
  finalFocus: "PDF viewer tab (new tab)",
  leavesStateForNext: "PDF tab active; results tab remains open in background.",
  pass: "New PDF tab opens and results tab still shows Your priority areas.",
  fail: "No PDF tab opens or results tab is closed.",
});

add({
  title: "Return from PDF viewer — results tab active",
  viewport: DESKTOP,
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
  viewport: DESKTOP,
  startUrl: null,
  startState: "Check 33 final state",
  startFocus: "Document body on results page",
  steps: [
    "Press Tab. Verify focus: Book a Meeting link.",
    "Press Tab. Verify focus: Book a Meeting button.",
    "Press Tab. Verify focus: Download Assessment Report button.",
    "Press Enter.",
  ],
  expectedRenderedState: "Chrome opens PDF in new tab immediately with no 503 alert.",
  finalFocus: "PDF viewer tab (new tab)",
  leavesStateForNext: "Second PDF download succeeded.",
  pass: "Second download opens PDF without 503 alert or fail-once message.",
  fail: "503 alert reappears or download fails.",
});

const focusData = JSON.parse(readFileSync(FOCUS, "utf8"));

const procedure = {
  procedureId: "A11Y-090-owner-procedure-v4",
  totalChecks: checks.length,
  browser: "Google Chrome on macOS only",
  executableCheckoutSha: EXECUTABLE_SHA,
  chromeViewportSetup: {
    desktop: "Command+Option+I → click device toolbar → Responsive → width 1280 height 900 → close DevTools for checks unless inspecting focus",
    mobile: "Command+Option+I → device toolbar → Responsive → width 375 height 800",
    switchDesktopToMobile: "Set Responsive to 375×800",
    switchMobileToDesktop: "Set Responsive to 1280×900",
  },
  standardHeaderFrom624Voice: HEADER_FROM_624.map((s) => s.replace("Press Tab. Verify focus: ", "")),
  choiceControlModel: CHOICE_MODEL,
  safeFixtureData: {
    firstName: "Alex",
    lastName: "Testowner",
    businessName: "Owner QA Fake HVAC Co",
    email: "owner-qa-fake@example.invalid",
    phone: "5550100199",
    trade: "HVAC",
    fleetSize: "3-7",
    monthlyCalls: "450",
    noRealPii: true,
  },
  reportErrorFixture: {
    autoEnabledBy: "scripts/phase2/docker/safe-preview-entrypoint.sh sets PHASE2_SAFE_PREVIEW=1 and PHASE2_OWNER_QA_REPORT_FAIL_ONCE=1",
    chrisSetsNoEnv: true,
  },
  preparationCommand: "bun run scripts/phase2/prepare-safe-preview-deps.ts",
  startupCommand: "bun run scripts/phase2/start-safe-assessment-preview.ts",
  checks,
  attestation: {
    operator: "",
    executedAtIso: "",
    testedSha: EXECUTABLE_SHA,
    confirmedPhysicalKeyboardOnly: "",
    confirmedNoProductionCredentials: "",
    confirmedNoLiveExternalSideEffects: "",
    perCheckResults: checks.map((c) => ({ id: c.id, title: c.title, result: "", notes: "" })),
    finalConclusion: "",
  },
};

writeFileSync(OUT, JSON.stringify(procedure, null, 2));
console.log(`Wrote ${checks.length} checks to ${OUT}`);

