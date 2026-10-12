/**
 * Content builders for Phase 2 owner walkthrough v5 markdown.
 * All focus steps are literal — no shorthand.
 */

export const DESKTOP_VP =
  "Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.";
export const MOBILE_VP =
  "Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 375 CSS px, height 800 CSS px. Verify displayed dimensions read 375 × 800 before starting.";

export const VIEWPORT_SETUP = `### Chrome on macOS — DevTools stays open for entire walkthrough

1. Open Google Chrome.
2. Press **Command+Option+I** to open DevTools.
3. Dock DevTools to the **right** side of the window (View → Dock side → Right) so the page preview remains fully visible on the left.
4. Press **Command+Shift+M** to enable the device toolbar.
5. Select **Responsive**.
6. For desktop checks: enter width **1280** and height **900**. Confirm the toolbar displays **1280 × 900**.
7. For mobile checks (Checks 3–5): enter width **375** and height **800**. Confirm **375 × 800**.
8. **Keep DevTools open and the device toolbar active for every check.** Closing DevTools or disabling the device toolbar invalidates the viewport — restart that check group from Check 1 or Check 3.

**Switch desktop → mobile (before Check 3):** With DevTools still open, set Responsive to **375 × 800** and verify dimensions.

**Switch mobile → desktop (before Check 6):** With DevTools still open, set Responsive to **1280 × 900** and verify dimensions.`;

export const SHARED_HEADER_REF =
  "Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05)";

export const HEADER_STEPS_FROM_624 = [
  "Press Tab. Verify focused element: What We Do header link.",
  "Press Tab. Verify focused element: How We Work header link.",
  "Press Tab. Verify focused element: Live Demo header link.",
  "Press Tab. Verify focused element: Free Assessment header link.",
  "Press Tab. Verify focused element: About header link.",
  "Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.",
];

export const RESET_STEPS = [
  "Press Command+L, type the check URL, press Enter.",
  "Press Tab once.",
  "Verify focused element: 624 Voice header link.",
];

export const CHOICE_BUTTON_MODEL =
  "Screening choice answers are BUTTON elements with aria-pressed (not native radio). From document body on a screening question: seven Tab presses reach the header links listed in Section 9, then Tab moves among choice buttons; Space selects the focused button.";

const TAB_TO_624_FROM_BODY =
  "Press Tab. Verify focused element: 624 Voice header link.";

export function answerNotAtAllRarelySteps(): string[] {
  return [
    TAB_TO_624_FROM_BODY,
    ...HEADER_STEPS_FROM_624,
    "Press Tab. Verify focused element: Not at all / rarely button.",
    "Press Space. Verify selected answer: Not at all / rarely (aria-pressed true on focused button).",
    "Press Tab. Verify focused element: Not sure button.",
    "Press Tab. Verify focused element: Back button.",
    "Press Tab. Verify focused element: Continue button.",
    "Press Enter.",
  ];
}

export function answerMostlyOftenSteps(): string[] {
  return [
    TAB_TO_624_FROM_BODY,
    ...HEADER_STEPS_FROM_624,
    "Press Tab. Verify focused element: Not at all / rarely button.",
    "Press Tab. Verify focused element: Somewhat / occasionally button.",
    "Press Tab. Verify focused element: Mostly / often button.",
    "Press Space. Verify selected answer: Mostly / often (aria-pressed true on focused button).",
    "Press Tab. Verify focused element: Not sure button.",
    "Press Tab. Verify focused element: Back button.",
    "Press Tab. Verify focused element: Continue button.",
    "Press Enter.",
  ];
}

export function answerConsistentlyAlwaysSteps(): string[] {
  return [
    TAB_TO_624_FROM_BODY,
    ...HEADER_STEPS_FROM_624,
    "Press Tab. Verify focused element: Not at all / rarely button.",
    "Press Tab. Verify focused element: Somewhat / occasionally button.",
    "Press Tab. Verify focused element: Mostly / often button.",
    "Press Tab. Verify focused element: Consistently / always button.",
    "Press Space. Verify selected answer: Consistently / always (aria-pressed true on focused button).",
    "Press Tab. Verify focused element: Not sure button.",
    "Press Tab. Verify focused element: Back button.",
    "Press Tab. Verify focused element: Continue button.",
    "Press Enter.",
  ];
}

export type WalkthroughCheck = {
  id: number;
  title: string;
  viewport: string;
  startUrl: string | null;
  startState: string;
  startFocus: string;
  steps: string[];
  expectedRenderedState: string;
  finalFocus: string;
  leavesStateForNext: string;
  pass: string;
  fail: string;
};

export function formatCheck(c: WalkthroughCheck): string {
  const stepLines = c.steps.map((s, i) => `  ${i + 1}. ${s}`);
  const lines = [
    `### Check ${c.id} — ${c.title}`,
    "",
    `- **Viewport:** ${c.viewport}`,
    `- **Starting URL or preceding-check state:** ${c.startUrl ?? c.startState}`,
    `- **Starting focused element:** ${c.startFocus}`,
    "- **Literal bounded key sequence:**",
    ...stepLines,
    `- **Expected rendered state:** ${c.expectedRenderedState}`,
    `- **Final focused element:** ${c.finalFocus}`,
    `- **State deliberately left for next check:** ${c.leavesStateForNext}`,
    `- **PASS:** ${c.pass}`,
    `- **FAIL:** ${c.fail}`,
    "",
  ];
  return lines.join("\n");
}
