# PHASE 2 — OWNER KEYBOARD QA HANDOFF (A11Y-090 v5)

## SHA TABLE

| Field | Value |
|---|---|
| Previous executable preview SHA | `c8e92da4674b3077d4dc598c6c154f75b1658d52` |
| New final executable preview SHA | `3109ad77d25a864b5a38cb248b14421b554d54ef` |
| Supersedes (prior closeout executable) | `e17a72b99f8dc37930fe381bd2293af15a551720`, `8750f90bdc29864ea69fd0b8323ed5b6066688c5` |
| Full evidence-only HEAD built on final executable SHA | `59e7a13a7c62d6c61ef6ce7d6c96b0355313db5f` |
| Actual current PR #97 HEAD | `59e7a13a7c62d6c61ef6ce7d6c96b0355313db5f` |
| Evidence-only HEAD and PR HEAD same commit? | **Yes** |
| Historical/superseded SHA (prior f3b09ac round; not Chris checkout chain) | `491e4adbcc3df96cc524e95c7232c5d95473c6d7` |

## CHECKOUT

```bash
git checkout 3109ad77d25a864b5a38cb248b14421b554d54ef
```

## PREREQUISITES

- macOS with Google Chrome
- Bun installed
- Docker Desktop running
- Physical keyboard only
- Fake data only (Section Fake Data)
- Do not set PHASE2_OWNER_QA_REPORT_FAIL_ONCE or PHASE2_SAFE_PREVIEW manually

## SECRET-SAFE PREPARATION

```bash
bun run scripts/phase2/prepare-safe-preview-deps.ts
```

Allowed prep hosts (exact): registry.npmjs.org, registry.yarnpkg.com, bun.sh, auth.docker.io, registry-1.docker.io, production.cloudflare.docker.com, deb.debian.org, security.debian.org, ftp.debian.org, localhost, 127.0.0.1.

**Stop if you see:** ERROR: preparation egress policy failed; ERROR: bun.lock changed; ERROR: frozen lockfile install failed; ERROR: Docker is unavailable; ERROR: Docker image build failed.

## PREVIEW START

```bash
bun run scripts/phase2/start-safe-assessment-preview.ts
```

**URL:** http://127.0.0.1:3000

**Stop if you see:** ERROR: Safe preview cannot start without secret-safe preparation; ERROR: iptables unavailable; ERROR: cannot configure iptables.

## VIEWPORT SETUP

### Chrome on macOS — DevTools stays open for entire walkthrough

1. Open Google Chrome.
2. Press **Command+Option+I** to open DevTools.
3. Dock DevTools to the **right** side of the window (View → Dock side → Right) so the page preview remains fully visible on the left.
4. Press **Command+Shift+M** to enable the device toolbar.
5. Select **Responsive**.
6. For desktop checks: enter width **1280** and height **900**. Confirm the toolbar displays **1280 × 900**.
7. For mobile checks (Checks 3–5): enter width **375** and height **800**. Confirm **375 × 800**.
8. **Keep DevTools open and the device toolbar active for every check.** Closing DevTools or disabling the device toolbar invalidates the viewport — restart that check group from Check 1 or Check 3.

**Switch desktop → mobile (before Check 3):** With DevTools still open, set Responsive to **375 × 800** and verify dimensions.

**Switch mobile → desktop (before Check 6):** With DevTools still open, set Responsive to **1280 × 900** and verify dimensions.

## FAKE DATA

| Field | Value |
|---|---|
| First name | Alex |
| Last name | Testowner |
| Business | Owner QA Fake HVAC Co |
| Email | owner-qa-fake@example.invalid |
| Phone | 5550100199 |

## CONTROL MODELS (verified by automated supplements)

### BP1/BP2 (X-SAFE-PREVIEW-FOCUS-04)
- BP1 Trade select: native SELECT; ArrowDown changes option; Tab moves to Continue; Enter advances to BP2 with focus on document body.
- BP2 Fleet size select: native SELECT; Shift+Tab from body reaches select; ArrowDown changes option; Tab to Back then Continue; Enter advances to respond review with focus on Continue button.

### Screening choices (X-SAFE-PREVIEW-FOCUS-02)
- BUTTON with aria-pressed; Tab between choices; Space selects; Tab to Not sure, Back, Continue; Enter advances.

## Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05)

From 624 Voice header link:
1. Tab → What We Do header link.
2. Tab → How We Work header link.
3. Tab → Live Demo header link.
4. Tab → Free Assessment header link.
5. Tab → About header link.
6. Tab → Book Your AI Growth Systems Consultation header link.

## KEYBOARD CHECKS

**Total checks: 34**

### Check 1 — Desktop header — five Tabs from 624 Voice to About

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** http://127.0.0.1:3000/
- **Starting focused element:** Document body before reset Tab
- **Literal bounded key sequence:**
  1. Press Command+L, type the check URL, press Enter.
  2. Press Tab once.
  3. Verify focused element: 624 Voice header link.
  4. Press Tab. Verify focused element: What We Do header link.
  5. Press Tab. Verify focused element: How We Work header link.
  6. Press Tab. Verify focused element: Live Demo header link.
  7. Press Tab. Verify focused element: Free Assessment header link.
  8. Press Tab. Verify focused element: About header link.
- **Expected rendered state:** Home page rendered; desktop header visible.
- **Final focused element:** About header link
- **State deliberately left for next check:** Focus on About header link.
- **PASS:** After reset Tab (624 Voice) and exactly five additional Tab presses, focus is the About header link.
- **FAIL:** About is not focused or a header link is skipped.

### Check 2 — Desktop header — sixth Tab reaches Book consultation

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 1 final state
- **Starting focused element:** About header link
- **Literal bounded key sequence:**
  1. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
- **Expected rendered state:** Home page rendered.
- **Final focused element:** Book Your AI Growth Systems Consultation header link
- **State deliberately left for next check:** Focus on Book Your AI Growth Systems Consultation header link.
- **PASS:** One Tab from About focuses Book Your AI Growth Systems Consultation header link.
- **FAIL:** Book Your AI Growth Systems Consultation header link is not focused.

### Check 3 — Mobile nav — Enter opens menu

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 375 CSS px, height 800 CSS px. Verify displayed dimensions read 375 × 800 before starting.
- **Starting URL or preceding-check state:** http://127.0.0.1:3000/
- **Starting focused element:** Document body before reset Tab
- **Literal bounded key sequence:**
  1. Press Command+L, type the check URL, press Enter.
  2. Press Tab once.
  3. Verify focused element: 624 Voice header link.
  4. Press Tab. Verify focused element: Mobile navigation menu summary control.
  5. Press Enter.
- **Expected rendered state:** Mobile navigation panel visible below header.
- **Final focused element:** Mobile navigation menu summary control
- **State deliberately left for next check:** Mobile menu open; focus on summary control.
- **PASS:** Menu panel is visible and summary retains focus after Enter.
- **FAIL:** Menu panel does not open or Enter navigates away.

### Check 4 — Mobile nav links in order after menu open

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 375 CSS px, height 800 CSS px. Verify displayed dimensions read 375 × 800 before starting.
- **Starting URL or preceding-check state:** Check 3 final state
- **Starting focused element:** Mobile navigation menu summary control (menu open)
- **Literal bounded key sequence:**
  1. Press Tab. Verify focused element: What We Do mobile nav link.
  2. Press Tab. Verify focused element: How We Work mobile nav link.
  3. Press Tab. Verify focused element: Live Demo mobile nav link.
  4. Press Tab. Verify focused element: Free Assessment mobile nav link.
  5. Press Tab. Verify focused element: About mobile nav link.
  6. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation mobile nav link.
- **Expected rendered state:** Mobile navigation panel open.
- **Final focused element:** Book Your AI Growth Systems Consultation mobile nav link
- **State deliberately left for next check:** Mobile menu open; focus on Book mobile nav link.
- **PASS:** All six mobile nav links receive focus in listed order with one Tab each.
- **FAIL:** Any listed mobile nav link is skipped or not focusable.

### Check 5 — Mobile nav — Escape closes menu

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 375 CSS px, height 800 CSS px. Verify displayed dimensions read 375 × 800 before starting.
- **Starting URL or preceding-check state:** Check 4 final state
- **Starting focused element:** Book Your AI Growth Systems Consultation mobile nav link
- **Literal bounded key sequence:**
  1. Press Escape.
- **Expected rendered state:** Mobile navigation panel closed.
- **Final focused element:** Mobile navigation menu summary control
- **State deliberately left for next check:** Mobile menu closed; focus on summary control.
- **PASS:** Menu closes and focus remains on the summary control.
- **FAIL:** Menu stays open or focus is lost outside the header.

### Check 6 — Home keyboard reachability

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** http://127.0.0.1:3000/
- **Starting focused element:** Document body before reset Tab
- **Literal bounded key sequence:**
  1. Press Command+L, type the check URL, press Enter.
  2. Press Tab once.
  3. Verify focused element: 624 Voice header link.
  4. Press Tab. Verify focused element: What We Do header link.
  5. Press Tab. Verify focused element: How We Work header link.
  6. Press Tab. Verify focused element: Live Demo header link.
  7. Press Tab. Verify focused element: Free Assessment header link.
  8. Press Tab. Verify focused element: About header link.
  9. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  10. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation hero link.
  11. Press Tab. Verify focused element: Get Your Free Assessment link.
  12. Press Tab. Verify focused element: See the System Work link.
- **Expected rendered state:** Home page hero and links rendered.
- **Final focused element:** See the System Work link
- **State deliberately left for next check:** Focus on See the System Work link.
- **PASS:** Each listed key press moves focus to the named element; final focus is See the System Work link.
- **FAIL:** Any named element is missing, out of order, or not focusable.

### Check 7 — Home focus visible

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 6 final state
- **Starting focused element:** See the System Work link
- **Literal bounded key sequence:**
  1. Observe the focused link for a visible focus indicator (ring or outline).
- **Expected rendered state:** See the System Work link remains focused.
- **Final focused element:** See the System Work link with visible focus indicator
- **State deliberately left for next check:** Focus on See the System Work link.
- **PASS:** Focus indicator is visibly distinct on See the System Work link.
- **FAIL:** No visible focus indicator on the focused link.

### Check 8 — /what-we-do keyboard reachability

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** http://127.0.0.1:3000/what-we-do
- **Starting focused element:** Document body before reset Tab
- **Literal bounded key sequence:**
  1. Press Command+L, type the check URL, press Enter.
  2. Press Tab once.
  3. Verify focused element: 624 Voice header link.
  4. Press Tab. Verify focused element: What We Do header link.
  5. Press Tab. Verify focused element: How We Work header link.
  6. Press Tab. Verify focused element: Live Demo header link.
  7. Press Tab. Verify focused element: Free Assessment header link.
  8. Press Tab. Verify focused element: About header link.
  9. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  10. Press Tab. Verify focused element: See How the Journey Fits Together link.
- **Expected rendered state:** What We Do page rendered.
- **Final focused element:** See How the Journey Fits Together link
- **State deliberately left for next check:** Focus on See How the Journey Fits Together link.
- **PASS:** Each listed key press moves focus to the named element; final focus is See How the Journey Fits Together link.
- **FAIL:** Any named element is missing, out of order, or not focusable.

### Check 9 — /what-we-do focus visible

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 8 final state
- **Starting focused element:** See How the Journey Fits Together link
- **Literal bounded key sequence:**
  1. Observe visible focus indicator on See How the Journey Fits Together link.
- **Expected rendered state:** What We Do page rendered.
- **Final focused element:** See How the Journey Fits Together link with visible focus indicator
- **State deliberately left for next check:** Focus on See How the Journey Fits Together link.
- **PASS:** Focus indicator visible on See How the Journey Fits Together link.
- **FAIL:** No visible focus indicator on the focused link.

### Check 10 — /how-we-work keyboard reachability

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** http://127.0.0.1:3000/how-we-work
- **Starting focused element:** Document body before reset Tab
- **Literal bounded key sequence:**
  1. Press Command+L, type the check URL, press Enter.
  2. Press Tab once.
  3. Verify focused element: 624 Voice header link.
  4. Press Tab. Verify focused element: What We Do header link.
  5. Press Tab. Verify focused element: How We Work header link.
  6. Press Tab. Verify focused element: Live Demo header link.
  7. Press Tab. Verify focused element: Free Assessment header link.
  8. Press Tab. Verify focused element: About header link.
  9. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  10. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation page CTA link.
  11. Press Tab. Verify focused element: Get Your Free Assessment link.
- **Expected rendered state:** How We Work page rendered.
- **Final focused element:** Get Your Free Assessment link
- **State deliberately left for next check:** Focus on Get Your Free Assessment link.
- **PASS:** Each listed key press moves focus to the named element; final focus is Get Your Free Assessment link.
- **FAIL:** Any named element is missing, out of order, or not focusable.

### Check 11 — /how-we-work focus visible

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 10 final state
- **Starting focused element:** Get Your Free Assessment link
- **Literal bounded key sequence:**
  1. Observe visible focus indicator on Get Your Free Assessment link.
- **Expected rendered state:** How We Work page rendered.
- **Final focused element:** Get Your Free Assessment link with visible focus indicator
- **State deliberately left for next check:** Focus on Get Your Free Assessment link.
- **PASS:** Focus indicator visible on Get Your Free Assessment link.
- **FAIL:** No visible focus indicator on the focused link.

### Check 12 — /demo keyboard reachability

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** http://127.0.0.1:3000/demo
- **Starting focused element:** Document body before reset Tab
- **Literal bounded key sequence:**
  1. Press Command+L, type the check URL, press Enter.
  2. Press Tab once.
  3. Verify focused element: 624 Voice header link.
  4. Press Tab. Verify focused element: What We Do header link.
  5. Press Tab. Verify focused element: How We Work header link.
  6. Press Tab. Verify focused element: Live Demo header link.
  7. Press Tab. Verify focused element: Free Assessment header link.
  8. Press Tab. Verify focused element: About header link.
  9. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  10. Press Tab. Verify focused element: Start your demo with Jessica button.
  11. Press Tab. Verify focused element: Start live demo with Jessica button.
- **Expected rendered state:** Live Demo page rendered.
- **Final focused element:** Start live demo with Jessica button
- **State deliberately left for next check:** Focus on Start live demo with Jessica button.
- **PASS:** Each listed key press moves focus to the named element; final focus is Start live demo with Jessica button.
- **FAIL:** Any named element is missing, out of order, or not focusable.

### Check 13 — /demo focus visible

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 12 final state
- **Starting focused element:** Start live demo with Jessica button
- **Literal bounded key sequence:**
  1. Observe visible focus indicator on Start live demo with Jessica button.
- **Expected rendered state:** Live Demo page rendered.
- **Final focused element:** Start live demo with Jessica button with visible focus indicator
- **State deliberately left for next check:** Focus on Start live demo with Jessica button.
- **PASS:** Focus indicator visible on Start live demo with Jessica button.
- **FAIL:** No visible focus indicator on the focused button.

### Check 14 — /about keyboard reachability

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** http://127.0.0.1:3000/about
- **Starting focused element:** Document body before reset Tab
- **Literal bounded key sequence:**
  1. Press Command+L, type the check URL, press Enter.
  2. Press Tab once.
  3. Verify focused element: 624 Voice header link.
  4. Press Tab. Verify focused element: What We Do header link.
  5. Press Tab. Verify focused element: How We Work header link.
  6. Press Tab. Verify focused element: Live Demo header link.
  7. Press Tab. Verify focused element: Free Assessment header link.
  8. Press Tab. Verify focused element: About header link.
  9. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  10. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation page CTA link.
  11. Press Tab. Verify focused element: Get Your Free Assessment link.
- **Expected rendered state:** About page rendered.
- **Final focused element:** Get Your Free Assessment link
- **State deliberately left for next check:** Focus on Get Your Free Assessment link.
- **PASS:** Each listed key press moves focus to the named element; final focus is Get Your Free Assessment link.
- **FAIL:** Any named element is missing, out of order, or not focusable.

### Check 15 — /about focus visible

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 14 final state
- **Starting focused element:** Get Your Free Assessment link
- **Literal bounded key sequence:**
  1. Observe visible focus indicator on Get Your Free Assessment link.
- **Expected rendered state:** About page rendered.
- **Final focused element:** Get Your Free Assessment link with visible focus indicator
- **State deliberately left for next check:** Focus on Get Your Free Assessment link.
- **PASS:** Focus indicator visible on Get Your Free Assessment link.
- **FAIL:** No visible focus indicator on the focused link.

### Check 16 — /contact keyboard reachability

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** http://127.0.0.1:3000/contact
- **Starting focused element:** Document body before reset Tab
- **Literal bounded key sequence:**
  1. Press Command+L, type the check URL, press Enter.
  2. Press Tab once.
  3. Verify focused element: 624 Voice header link.
  4. Press Tab. Verify focused element: What We Do header link.
  5. Press Tab. Verify focused element: How We Work header link.
  6. Press Tab. Verify focused element: Live Demo header link.
  7. Press Tab. Verify focused element: Free Assessment header link.
  8. Press Tab. Verify focused element: About header link.
  9. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  10. Press Tab. Verify focused element: First name field.
  11. Press Tab. Verify focused element: Last name field.
  12. Press Tab. Verify focused element: Business name field.
  13. Press Tab. Verify focused element: Trade select.
- **Expected rendered state:** Contact form rendered.
- **Final focused element:** Trade select
- **State deliberately left for next check:** Focus on Trade select.
- **PASS:** Each listed key press moves focus to the named element; final focus is Trade select.
- **FAIL:** Any named element is missing, out of order, or not focusable.

### Check 17 — /contact focus visible

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 16 final state
- **Starting focused element:** Trade select
- **Literal bounded key sequence:**
  1. Observe visible focus indicator on Trade select.
- **Expected rendered state:** Contact form rendered.
- **Final focused element:** Trade select with visible focus indicator
- **State deliberately left for next check:** Focus on Trade select.
- **PASS:** Focus indicator visible on Trade select.
- **FAIL:** No visible focus indicator on Trade select.

### Check 18 — /services redirect

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** http://127.0.0.1:3000/services
- **Starting focused element:** Address bar
- **Literal bounded key sequence:**
  1. Press Command+L, type http://127.0.0.1:3000/services, press Enter.
  2. Press Command+L, read address bar URL.
- **Expected rendered state:** What We Do page content rendered.
- **Final focused element:** Address bar showing http://127.0.0.1:3000/what-we-do
- **State deliberately left for next check:** Browser at /what-we-do.
- **PASS:** Address bar reads http://127.0.0.1:3000/what-we-do after loading /services.
- **FAIL:** Address bar does not read http://127.0.0.1:3000/what-we-do.

### Check 19 — 404 keyboard reachability

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** http://127.0.0.1:3000/does-not-exist-404
- **Starting focused element:** Document body before reset Tab
- **Literal bounded key sequence:**
  1. Press Command+L, type the check URL, press Enter.
  2. Press Tab once.
  3. Verify focused element: 624 Voice header link.
  4. Press Tab. Verify focused element: What We Do header link.
  5. Press Tab. Verify focused element: How We Work header link.
  6. Press Tab. Verify focused element: Live Demo header link.
  7. Press Tab. Verify focused element: Free Assessment header link.
  8. Press Tab. Verify focused element: About header link.
  9. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  10. Press Tab. Verify focused element: Back to Home link.
- **Expected rendered state:** 404 page with Back to Home link rendered.
- **Final focused element:** Back to Home link
- **State deliberately left for next check:** Focus on Back to Home link.
- **PASS:** Each listed key press moves focus to the named element; final focus is Back to Home link.
- **FAIL:** Any named element is missing, out of order, or not focusable.

### Check 20 — 404 focus visible

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 19 final state
- **Starting focused element:** Back to Home link
- **Literal bounded key sequence:**
  1. Observe visible focus indicator on Back to Home link.
- **Expected rendered state:** 404 page rendered.
- **Final focused element:** Back to Home link with visible focus indicator
- **State deliberately left for next check:** Focus on Back to Home link.
- **PASS:** Focus indicator visible on Back to Home link.
- **FAIL:** No visible focus indicator on Back to Home link.

### Check 21 — Assessment BP1 — native SELECT trade HVAC and Continue

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** http://127.0.0.1:3000/assessment
- **Starting focused element:** Document body before reset Tab
- **Literal bounded key sequence:**
  1. Press Command+L, type the check URL, press Enter.
  2. Press Tab once.
  3. Verify focused element: 624 Voice header link.
  4. Press Tab. Verify focused element: What We Do header link.
  5. Press Tab. Verify focused element: How We Work header link.
  6. Press Tab. Verify focused element: Live Demo header link.
  7. Press Tab. Verify focused element: Free Assessment header link.
  8. Press Tab. Verify focused element: About header link.
  9. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  10. Press Tab. Verify focused element: Trade select (native SELECT; initial option Choose a trade…).
  11. Press ArrowDown. Verify selected option: Plumbers.
  12. Press ArrowDown. Verify selected option: Electricians.
  13. Press ArrowDown. Verify selected option: HVAC.
  14. Press Tab. Verify focused element: Continue button.
  15. Press Enter.
- **Expected rendered state:** BP2 fleet-size question rendered.
- **Final focused element:** Document body on BP2 step
- **State deliberately left for next check:** BP2 visible; trade=HVAC; focus on document body.
- **PASS:** BP2 fleet question displayed; trade select value is HVAC; after Continue focus is document body.
- **FAIL:** BP2 not shown, trade is not HVAC, or focus after Continue is not document body.

### Check 22 — Assessment BP2 — native SELECT fleet 3–7, return to BP1, forward to respond review

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 21 final state
- **Starting focused element:** Document body on BP2 step
- **Literal bounded key sequence:**
  1. Press Shift+Tab. Verify focused element: Back button.
  2. Press Shift+Tab. Verify focused element: Fleet size select (native SELECT).
  3. Press ArrowDown. Verify selected option: 1–2 vehicles.
  4. Press ArrowDown. Verify selected option: 3–7 vehicles.
  5. Press Tab. Verify focused element: Back button.
  6. Press Enter. Verify rendered screen: BP1 trade select visible.
  7. Press Tab. Verify focused element: Continue button.
  8. Press Enter. Verify rendered screen: BP2 fleet select visible.
  9. Press Shift+Tab. Verify focused element: Fleet size select.
  10. Press ArrowDown. Verify selected option: 1–2 vehicles.
  11. Press ArrowDown. Verify selected option: 3–7 vehicles.
  12. Press Tab. Verify focused element: Back button.
  13. Press Tab. Verify focused element: Continue button.
  14. Press Enter.
- **Expected rendered state:** Respond review screen with Monthly inbound calls field visible.
- **Final focused element:** Continue button on respond review screen
- **State deliberately left for next check:** Respond review visible; fleet=3–7; focus on Continue button.
- **PASS:** Back returns to BP1; forward path reaches respond review with focus on Continue button.
- **FAIL:** Back/Continue path does not reach respond review or fleet is not 3–7.

### Check 23 — Assessment respond — enter 450 and Continue to GF-S

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 22 final state
- **Starting focused element:** Continue button on respond review screen
- **Literal bounded key sequence:**
  1. Press Shift+Tab. Verify focused element: Back button.
  2. Press Shift+Tab. Verify focused element: R3 Not sure checkbox.
  3. Press Shift+Tab. Verify focused element: Average job value field.
  4. Press Shift+Tab. Verify focused element: R2 Not sure checkbox.
  5. Press Shift+Tab. Verify focused element: Missed-call rate field.
  6. Press Shift+Tab. Verify focused element: R1 Not sure checkbox.
  7. Press Shift+Tab. Verify focused element: Monthly inbound calls field.
  8. Press Command+A. Press Backspace.
  9. Type 450.
  10. Press Tab. Verify focused element: R1 Not sure checkbox.
  11. Press Tab. Verify focused element: Missed-call rate field.
  12. Press Tab. Verify focused element: R2 Not sure checkbox.
  13. Press Tab. Verify focused element: Average job value field.
  14. Press Tab. Verify focused element: R3 Not sure checkbox.
  15. Press Tab. Verify focused element: Back button.
  16. Press Tab. Verify focused element: Continue button.
  17. Press Enter.
- **Expected rendered state:** GF-S question visible: How consistently do new customers find your business when they need your services?
- **Final focused element:** Document body on GF-S step
- **State deliberately left for next check:** GF-S visible; Monthly inbound calls value 450; focus on document body.
- **PASS:** GF-S screening question displayed and Monthly inbound calls field value is 450; after Continue focus is document body.
- **FAIL:** GF-S question not shown, R1 is not 450, or focus after Continue is not document body.

### Check 24 — Assessment GF-S and GF follow-ups through CV-S

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 23 final state
- **Starting focused element:** Document body on GF-S step
- **Literal bounded key sequence:**
  1. Screening choice answers are BUTTON elements with aria-pressed (not native radio). From document body on a screening question: seven Tab presses reach the header links listed in Section 9, then Tab moves among choice buttons; Space selects the focused button.
  2. Use Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05).
  3. Press Tab. Verify focused element: What We Do header link.
  4. Press Tab. Verify focused element: How We Work header link.
  5. Press Tab. Verify focused element: Live Demo header link.
  6. Press Tab. Verify focused element: Free Assessment header link.
  7. Press Tab. Verify focused element: About header link.
  8. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  9. Press Tab. Verify focused element: Not at all / rarely button.
  10. Press Tab. Verify focused element: Somewhat / occasionally button.
  11. Press Tab. Verify focused element: Mostly / often button.
  12. Press Tab. Verify focused element: Consistently / always button.
  13. Press Space. Verify selected answer: Consistently / always (aria-pressed true on focused button).
  14. Press Tab. Verify focused element: Not sure button.
  15. Press Tab. Verify focused element: Back button.
  16. Press Tab. Verify focused element: Continue button.
  17. Press Enter.
  18. Verify rendered question: Do you track where new leads come from (calls, web, referrals, ads)?
  19. Use Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05).
  20. Press Tab. Verify focused element: What We Do header link.
  21. Press Tab. Verify focused element: How We Work header link.
  22. Press Tab. Verify focused element: Live Demo header link.
  23. Press Tab. Verify focused element: Free Assessment header link.
  24. Press Tab. Verify focused element: About header link.
  25. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  26. Press Tab. Verify focused element: Not at all / rarely button.
  27. Press Tab. Verify focused element: Somewhat / occasionally button.
  28. Press Tab. Verify focused element: Mostly / often button.
  29. Press Space. Verify selected answer: Mostly / often (aria-pressed true on focused button).
  30. Press Tab. Verify focused element: Not sure button.
  31. Press Tab. Verify focused element: Back button.
  32. Press Tab. Verify focused element: Continue button.
  33. Press Enter.
  34. Verify rendered question: Is your Google Business Profile complete, current, and actively managed?
  35. Use Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05).
  36. Press Tab. Verify focused element: What We Do header link.
  37. Press Tab. Verify focused element: How We Work header link.
  38. Press Tab. Verify focused element: Live Demo header link.
  39. Press Tab. Verify focused element: Free Assessment header link.
  40. Press Tab. Verify focused element: About header link.
  41. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  42. Press Tab. Verify focused element: Not at all / rarely button.
  43. Press Space. Verify selected answer: Not at all / rarely (aria-pressed true on focused button).
  44. Press Tab. Verify focused element: Not sure button.
  45. Press Tab. Verify focused element: Back button.
  46. Press Tab. Verify focused element: Continue button.
  47. Press Enter.
  48. Verify rendered question: Do you have a simple way for prospects to request service online or after hours?
  49. Use Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05).
  50. Press Tab. Verify focused element: What We Do header link.
  51. Press Tab. Verify focused element: How We Work header link.
  52. Press Tab. Verify focused element: Live Demo header link.
  53. Press Tab. Verify focused element: Free Assessment header link.
  54. Press Tab. Verify focused element: About header link.
  55. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  56. Press Tab. Verify focused element: Not at all / rarely button.
  57. Press Space. Verify selected answer: Not at all / rarely (aria-pressed true on focused button).
  58. Press Tab. Verify focused element: Not sure button.
  59. Press Tab. Verify focused element: Back button.
  60. Press Tab. Verify focused element: Continue button.
  61. Press Enter.
  62. Verify rendered question: How consistently do inbound leads convert into booked jobs or appointments?
- **Expected rendered state:** CV-S screening question visible.
- **Final focused element:** Document body on CV-S step
- **State deliberately left for next check:** CV-S question visible; GF follow-ups completed.
- **PASS:** GF-F1, GF-F2, GF-F3 answered and CV-S question is displayed.
- **FAIL:** Any GF follow-up question text missing or CV-S not reached.

### Check 25 — Assessment CV-S through MI-S to teaser

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 24 final state
- **Starting focused element:** Document body on CV-S step
- **Literal bounded key sequence:**
  1. Screening choice answers are BUTTON elements with aria-pressed (not native radio). From document body on a screening question: seven Tab presses reach the header links listed in Section 9, then Tab moves among choice buttons; Space selects the focused button.
  2. Use Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05).
  3. Press Tab. Verify focused element: What We Do header link.
  4. Press Tab. Verify focused element: How We Work header link.
  5. Press Tab. Verify focused element: Live Demo header link.
  6. Press Tab. Verify focused element: Free Assessment header link.
  7. Press Tab. Verify focused element: About header link.
  8. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  9. Press Tab. Verify focused element: Not at all / rarely button.
  10. Press Space. Verify selected answer: Not at all / rarely (aria-pressed true on focused button).
  11. Press Tab. Verify focused element: Not sure button.
  12. Press Tab. Verify focused element: Back button.
  13. Press Tab. Verify focused element: Continue button.
  14. Press Enter.
  15. Verify rendered question: How consistently do you stay in touch with past customers to earn repeat business?
  16. Use Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05).
  17. Press Tab. Verify focused element: What We Do header link.
  18. Press Tab. Verify focused element: How We Work header link.
  19. Press Tab. Verify focused element: Live Demo header link.
  20. Press Tab. Verify focused element: Free Assessment header link.
  21. Press Tab. Verify focused element: About header link.
  22. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  23. Press Tab. Verify focused element: Not at all / rarely button.
  24. Press Space. Verify selected answer: Not at all / rarely (aria-pressed true on focused button).
  25. Press Tab. Verify focused element: Not sure button.
  26. Press Tab. Verify focused element: Back button.
  27. Press Tab. Verify focused element: Continue button.
  28. Press Enter.
  29. Verify rendered question: How much manual admin work still falls on your team for scheduling and follow-up?
  30. Use Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05).
  31. Press Tab. Verify focused element: What We Do header link.
  32. Press Tab. Verify focused element: How We Work header link.
  33. Press Tab. Verify focused element: Live Demo header link.
  34. Press Tab. Verify focused element: Free Assessment header link.
  35. Press Tab. Verify focused element: About header link.
  36. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  37. Press Tab. Verify focused element: Not at all / rarely button.
  38. Press Space. Verify selected answer: Not at all / rarely (aria-pressed true on focused button).
  39. Press Tab. Verify focused element: Not sure button.
  40. Press Tab. Verify focused element: Back button.
  41. Press Tab. Verify focused element: Continue button.
  42. Press Enter.
  43. Verify rendered question: How clearly can you see which marketing and operations efforts are working?
  44. Use Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05).
  45. Press Tab. Verify focused element: What We Do header link.
  46. Press Tab. Verify focused element: How We Work header link.
  47. Press Tab. Verify focused element: Live Demo header link.
  48. Press Tab. Verify focused element: Free Assessment header link.
  49. Press Tab. Verify focused element: About header link.
  50. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  51. Press Tab. Verify focused element: Not at all / rarely button.
  52. Press Space. Verify selected answer: Not at all / rarely (aria-pressed true on focused button).
  53. Press Tab. Verify focused element: Not sure button.
  54. Press Tab. Verify focused element: Back button.
  55. Press Tab. Verify focused element: Continue button.
  56. Press Enter.
  57. Verify heading text: Your top priority.
  58. Verify button label: Unlock Full Results.
- **Expected rendered state:** Teaser screen with Unlock Full Results button.
- **Final focused element:** Document body on teaser step
- **State deliberately left for next check:** Teaser visible; focus on document body.
- **PASS:** Teaser shows Your top priority heading and Unlock Full Results button.
- **FAIL:** Teaser heading or Unlock Full Results button is missing.

### Check 26 — Assessment stale-answer removal — full backtrack and forward

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 25 final state
- **Starting focused element:** Document body on teaser step (first pass)
- **Literal bounded key sequence:**
  1. Press Tab. Verify focused element: Back button.
  2. Press Enter. Verify rendered question: How clearly can you see which marketing and operations efforts are working?
  3. Press Tab. Verify focused element: Back button.
  4. Press Enter. Verify rendered question: How much manual admin work still falls on your team for scheduling and follow-up?
  5. Press Tab. Verify focused element: Back button.
  6. Press Enter. Verify rendered question: How consistently do you stay in touch with past customers to earn repeat business?
  7. Press Tab. Verify focused element: Back button.
  8. Press Enter. Verify rendered question: How consistently do inbound leads convert into booked jobs or appointments?
  9. Press Tab. Verify focused element: Back button.
  10. Press Enter. Verify rendered question: Do you have a simple way for prospects to request service online or after hours?
  11. Press Tab. Verify focused element: Back button.
  12. Press Enter. Verify rendered question: Is your Google Business Profile complete, current, and actively managed?
  13. Press Tab. Verify focused element: Back button.
  14. Press Enter. Verify rendered question: Do you track where new leads come from (calls, web, referrals, ads)?
  15. Press Tab. Verify focused element: Back button.
  16. Press Enter. Verify rendered question: How consistently do new customers find your business when they need your services?
  17. Use Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05).
  18. Press Tab. Verify focused element: What We Do header link.
  19. Press Tab. Verify focused element: How We Work header link.
  20. Press Tab. Verify focused element: Live Demo header link.
  21. Press Tab. Verify focused element: Free Assessment header link.
  22. Press Tab. Verify focused element: About header link.
  23. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  24. Press Tab. Verify focused element: Not at all / rarely button.
  25. Press Space. Verify selected answer: Not at all / rarely (aria-pressed true on focused button).
  26. Press Tab. Verify focused element: Not sure button.
  27. Press Tab. Verify focused element: Back button.
  28. Press Tab. Verify focused element: Continue button.
  29. Press Enter.
  30. Verify page does NOT contain question: Do you track where new leads come from (calls, web, referrals, ads)?
  31. Verify page does NOT contain question: Is your Google Business Profile complete, current, and actively managed?
  32. Verify page does NOT contain question: Do you have a simple way for prospects to request service online or after hours?
  33. Use Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05).
  34. Press Tab. Verify focused element: What We Do header link.
  35. Press Tab. Verify focused element: How We Work header link.
  36. Press Tab. Verify focused element: Live Demo header link.
  37. Press Tab. Verify focused element: Free Assessment header link.
  38. Press Tab. Verify focused element: About header link.
  39. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  40. Press Tab. Verify focused element: Not at all / rarely button.
  41. Press Space. Verify selected answer: Not at all / rarely (aria-pressed true on focused button).
  42. Press Tab. Verify focused element: Not sure button.
  43. Press Tab. Verify focused element: Back button.
  44. Press Tab. Verify focused element: Continue button.
  45. Press Enter.
  46. Verify rendered question: How consistently do you stay in touch with past customers to earn repeat business?
  47. Use Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05).
  48. Press Tab. Verify focused element: What We Do header link.
  49. Press Tab. Verify focused element: How We Work header link.
  50. Press Tab. Verify focused element: Live Demo header link.
  51. Press Tab. Verify focused element: Free Assessment header link.
  52. Press Tab. Verify focused element: About header link.
  53. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  54. Press Tab. Verify focused element: Not at all / rarely button.
  55. Press Space. Verify selected answer: Not at all / rarely (aria-pressed true on focused button).
  56. Press Tab. Verify focused element: Not sure button.
  57. Press Tab. Verify focused element: Back button.
  58. Press Tab. Verify focused element: Continue button.
  59. Press Enter.
  60. Verify rendered question: How much manual admin work still falls on your team for scheduling and follow-up?
  61. Use Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05).
  62. Press Tab. Verify focused element: What We Do header link.
  63. Press Tab. Verify focused element: How We Work header link.
  64. Press Tab. Verify focused element: Live Demo header link.
  65. Press Tab. Verify focused element: Free Assessment header link.
  66. Press Tab. Verify focused element: About header link.
  67. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  68. Press Tab. Verify focused element: Not at all / rarely button.
  69. Press Space. Verify selected answer: Not at all / rarely (aria-pressed true on focused button).
  70. Press Tab. Verify focused element: Not sure button.
  71. Press Tab. Verify focused element: Back button.
  72. Press Tab. Verify focused element: Continue button.
  73. Press Enter.
  74. Verify rendered question: How clearly can you see which marketing and operations efforts are working?
  75. Use Section 9 — Standard Desktop Header Sequence (proven identical on /, /what-we-do, /how-we-work, /demo, /about, /contact, /does-not-exist-404, /assessment by X-SAFE-PREVIEW-FOCUS-05).
  76. Press Tab. Verify focused element: What We Do header link.
  77. Press Tab. Verify focused element: How We Work header link.
  78. Press Tab. Verify focused element: Live Demo header link.
  79. Press Tab. Verify focused element: Free Assessment header link.
  80. Press Tab. Verify focused element: About header link.
  81. Press Tab. Verify focused element: Book Your AI Growth Systems Consultation header link.
  82. Press Tab. Verify focused element: Not at all / rarely button.
  83. Press Space. Verify selected answer: Not at all / rarely (aria-pressed true on focused button).
  84. Press Tab. Verify focused element: Not sure button.
  85. Press Tab. Verify focused element: Back button.
  86. Press Tab. Verify focused element: Continue button.
  87. Press Enter.
  88. Verify heading text: Your top priority.
- **Expected rendered state:** Teaser screen (second time); none of the three GF-F follow-up question texts present after GF-S lowered.
- **Final focused element:** Document body on teaser step (second time)
- **State deliberately left for next check:** Teaser visible after stale removal; focus on document body.
- **PASS:** All three GF-F follow-up question texts are absent after GF-S is lowered; teaser reached again.
- **FAIL:** Any GF-F1, GF-F2, or GF-F3 question text appears after GF-S is lowered to Not at all / rarely.

### Check 27 — Assessment teaser to lead gate

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 26 final state
- **Starting focused element:** Document body on teaser step (after stale removal)
- **Literal bounded key sequence:**
  1. Press Tab. Verify focused element: Back button.
  2. Press Tab. Verify focused element: Unlock Full Results button.
  3. Press Enter.
- **Expected rendered state:** Lead gate heading Unlock your full assessment results; all gate fields empty.
- **Final focused element:** Document body on lead gate
- **State deliberately left for next check:** Lead gate visible; all fields empty; SMS consent unchecked; focus on document body.
- **PASS:** Lead gate form visible with empty fields and SMS consent checkbox unchecked.
- **FAIL:** Lead gate not displayed or any field is prefilled.

### Check 28 — Lead gate invalid submit

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 27 final state
- **Starting focused element:** Document body on lead gate
- **Literal bounded key sequence:**
  1. Press Tab. Verify focused element: First name field.
  2. Type one space character.
  3. Press Tab. Verify focused element: Last name field. Type Testowner.
  4. Press Tab. Verify focused element: Business name field. Type Owner QA Fake HVAC Co.
  5. Press Tab. Verify focused element: Email field. Type owner-qa-fake@example.invalid.
  6. Press Tab. Verify focused element: Phone field. Type 5550100199.
  7. Press Tab. Verify focused element: SMS consent checkbox (unchecked).
  8. Press Tab. Verify focused element: See My Full Results button.
  9. Press Enter.
- **Expected rendered state:** Alert with text: First name is required.
- **Final focused element:** See My Full Results button
- **State deliberately left for next check:** Validation alert visible; SMS consent unchecked; focus on See My Full Results button.
- **PASS:** Alert displays exactly First name is required. and focus remains on See My Full Results button.
- **FAIL:** Alert text differs, alert missing, or focus is not on See My Full Results button.

### Check 29 — Lead gate SMS consent toggle

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 28 final state
- **Starting focused element:** See My Full Results button
- **Literal bounded key sequence:**
  1. Press Shift+Tab. Verify focused element: SMS consent checkbox (unchecked).
  2. Press Space. Verify checkbox is checked.
  3. Press Space. Verify checkbox is unchecked.
- **Expected rendered state:** Lead gate form still visible.
- **Final focused element:** SMS consent checkbox (unchecked)
- **State deliberately left for next check:** SMS consent unchecked; focus on SMS consent checkbox.
- **PASS:** Checkbox toggles checked then returns unchecked; final focus on SMS consent checkbox.
- **FAIL:** Checkbox does not toggle or ends checked.

### Check 30 — Lead gate valid submission to results

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 29 final state
- **Starting focused element:** SMS consent checkbox (unchecked)
- **Literal bounded key sequence:**
  1. Press Shift+Tab. Verify focused element: Phone field.
  2. Press Shift+Tab. Verify focused element: Email field.
  3. Press Shift+Tab. Verify focused element: Business name field.
  4. Press Shift+Tab. Verify focused element: Last name field.
  5. Press Shift+Tab. Verify focused element: First name field.
  6. Press Command+A. Press Backspace.
  7. Type Alex.
  8. Press Tab. Verify focused element: Last name field (value Testowner).
  9. Press Tab. Verify focused element: Business name field (value Owner QA Fake HVAC Co).
  10. Press Tab. Verify focused element: Email field (value owner-qa-fake@example.invalid).
  11. Press Tab. Verify focused element: Phone field (value 5550100199).
  12. Press Tab. Verify focused element: SMS consent checkbox (leave unchecked).
  13. Press Tab. Verify focused element: See My Full Results button.
  14. Press Enter.
- **Expected rendered state:** Results heading Your priority areas; Download Assessment Report button visible.
- **Final focused element:** Document body on results page
- **State deliberately left for next check:** Results page rendered; SMS consent was not checked; focus on document body.
- **PASS:** Your priority areas heading and Download Assessment Report button visible after submission with SMS consent unchecked.
- **FAIL:** Results page not shown or submission error alert appears.

### Check 31 — Report download first attempt — 503 alert

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 30 final state
- **Starting focused element:** Document body on results page
- **Literal bounded key sequence:**
  1. Press Tab. Verify focused element: Book a Meeting link.
  2. Press Tab. Verify focused element: Book a Meeting button.
  3. Press Tab. Verify focused element: Download Assessment Report button.
  4. Press Enter.
  5. Read role=alert region text.
- **Expected rendered state:** Alert text: Report temporarily unavailable. Please try again in a moment.; Your priority areas still visible; Try downloading report again button visible.
- **Final focused element:** Download Assessment Report button
- **State deliberately left for next check:** 503 alert visible; results page rendered; focus on Download Assessment Report button.
- **PASS:** Alert text matches exactly; results remain visible; Try downloading report again button is present.
- **FAIL:** Alert text differs, results disappear, or retry button missing.

### Check 32 — Report download retry success

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 31 final state
- **Starting focused element:** Download Assessment Report button
- **Literal bounded key sequence:**
  1. Press Tab. Verify focused element: Try downloading report again button.
  2. Press Enter.
- **Expected rendered state:** Chrome opens a new tab with PDF viewer (blob: URL); original tab still shows Your priority areas.
- **Final focused element:** PDF viewer tab (new tab active)
- **State deliberately left for next check:** PDF tab active; results tab remains open in background.
- **PASS:** New PDF tab opens and results tab still shows Your priority areas.
- **FAIL:** No PDF tab opens or results tab is closed.

### Check 33 — Return from PDF viewer — results tab active

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 32 final state
- **Starting focused element:** PDF viewer tab
- **Literal bounded key sequence:**
  1. Press Command+W to close the PDF tab.
- **Expected rendered state:** Original results tab active with Your priority areas visible.
- **Final focused element:** Document body on results page
- **State deliberately left for next check:** Results page active; focus on document body; fail-once attempt consumed.
- **PASS:** PDF tab closes and results tab is active without using Tab on PDF-only controls.
- **FAIL:** Wrong tab closed or results page is not visible.

### Check 34 — Report download repeat access

- **Viewport:** Chrome DevTools open (Command+Option+I), device toolbar active (Command+Shift+M), Responsive mode, width 1280 CSS px, height 900 CSS px. Verify displayed dimensions read 1280 × 900 before starting.
- **Starting URL or preceding-check state:** Check 33 final state
- **Starting focused element:** Document body on results page
- **Literal bounded key sequence:**
  1. Press Tab. Verify focused element: Book a Meeting link.
  2. Press Tab. Verify focused element: Book a Meeting button.
  3. Press Tab. Verify focused element: Download Assessment Report button.
  4. Press Enter.
- **Expected rendered state:** Chrome opens PDF in new tab immediately with no 503 alert.
- **Final focused element:** PDF viewer tab (new tab active)
- **State deliberately left for next check:** Second PDF download succeeded.
- **PASS:** Second download opens PDF without 503 alert or fail-once message.
- **FAIL:** 503 alert reappears or download fails.


## SHUTDOWN

Press Ctrl+C in the preview terminal. Confirm the Docker container stops.

## OWNER ATTESTATION (blank)

| Field | Value |
|---|---|
| Tested SHA | 3109ad77d25a864b5a38cb248b14421b554d54ef |
| Operator | |
| Executed at (ISO) | |
| Confirmed physical keyboard only | |
| Confirmed no production credentials | |
| Confirmed no live external side effects | |
| Check 1 result | |
| Check 2 result | |
| Check 3 result | |
| Check 4 result | |
| Check 5 result | |
| Check 6 result | |
| Check 7 result | |
| Check 8 result | |
| Check 9 result | |
| Check 10 result | |
| Check 11 result | |
| Check 12 result | |
| Check 13 result | |
| Check 14 result | |
| Check 15 result | |
| Check 16 result | |
| Check 17 result | |
| Check 18 result | |
| Check 19 result | |
| Check 20 result | |
| Check 21 result | |
| Check 22 result | |
| Check 23 result | |
| Check 24 result | |
| Check 25 result | |
| Check 26 result | |
| Check 27 result | |
| Check 28 result | |
| Check 29 result | |
| Check 30 result | |
| Check 31 result | |
| Check 32 result | |
| Check 33 result | |
| Check 34 result | |
| Final conclusion | |

Private implementation remains in progress. Awaiting owner keyboard QA.
