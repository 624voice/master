# PRD 1 — Home-Services ROI Calculator

**Goal:** An interactive, trade-specific calculator that shows a home-services owner the estimated annual ROI of the 624 Voice platform ($1,500/mo), broken down across five value drivers and three scenarios, with a downloadable PDF.

**Priority:** Build first. Self-contained front end, no third-party accounts.

> **This PRD is built from the real model in `624 ROI Calculators Home Services final (1).xlsx`.** All formulas below were verified to reproduce the spreadsheet's outputs exactly for all five trades. The numbers are final, not placeholders — Cursor should implement them as given.

---

## 1. What changed from the original one-page design guide

The original guide described a single "trucks → calls → one ROI number" flow. The spreadsheet is the actual product model and supersedes it:

- **Five trades**, each with its own assumptions: Plumbers, Electricians, HVAC, Roofers, Pest Control.
- **Three scenarios** shown side by side: Conservative, Moderate, Aggressive.
- **Five value drivers** summed into the total, not one.
- Fixed platform price **$1,500/mo ($18,000/yr)** baked into ROI.
- The "how many trucks" question is the primary input. Monthly calls are estimated as **trucks × callsPerTruckPerMonth** (trade-specific rate).

## 2. User flow

1. **Select trade (dropdown) — FIRST.** A `<select>` with Plumbers / Electricians / HVAC / Roofers / Pest Control. Nothing else appears until a trade is chosen.
2. **"How many trucks do you have?" (number input) — SECOND.** The owner types their truck count.
3. **Show calculated calls — THIRD.** Display transparent math: `{trucks} × {callsPerTruckPerMonth} = {estimatedCalls}` calls/month.
4. **Verify — FOURTH.** *"Is that about how many calls you take?"* — pre-filled editable input; user confirms or enters their actual monthly call volume.
5. **Show results:** three scenario columns (Conservative / Moderate / Aggressive), each with Net Annual ROI, ROI multiple, and payback period, plus the five-driver breakdown.
6. **Show assumptions + audit** (the "no double-counting" logic) so it's transparent.
7. **Download PDF** of the full result (gated behind lead capture).

Keep it fast and on one screen. No login for the on-screen result.

## 3. Calls per truck per month (per trade)

Monthly calls are estimated as `trucks × callsPerTruckPerMonth`:

| Trade | Calls per truck per month |
|-------|---------------------------|
| Plumbers | 60 |
| HVAC | 70 |
| Electricians | 30 |
| Pest Control | 35 |
| Roofers | 20 |

Cap truck input at 50. The estimated total pre-fills the verify step and stays overridable.

## 4. The five value drivers (formulas)

Let `calls` = confirmed monthly inbound calls. Scenario index picks Conservative/Moderate/Aggressive values. All annual figures are monthly × 12.

1. **Missed-Call Recovery** — 24/7 answering
   `jobsRecovered/mo = calls × missedCallRate × recoveredBookingRate[s]`
   `annual = jobsRecovered/mo × avgJobValue × 12`
2. **No-Show Reduction** — SMS confirmations/reminders
   `apptsSaved/mo = calls × (1 − missedCallRate) × baseBookingConv × noShowRate × noShowReduction[s]`
   `annual = apptsSaved/mo × avgJobValue × 12`
3. **Outbound SMS Campaigns** — seasonal/maintenance/review
   `jobs/mo = campaignJobs[s]` (flat per scenario)
   `annual = jobs/mo × avgJobValue × 12`
4. **Job-Closer Upsells** — post-job follow-up
   `upsellJobs/mo = calls × (1 − missedCallRate) × baseBookingConv × upsellRate[s]`
   `annual = upsellJobs/mo × avgUpsellValue × 12`
5. **Time Savings** — admin automation (cost reduction, not revenue)
   `annual = adminHoursSaved[s] × hourlyRate × 12`

**Totals:**
```
totalAnnualBenefit = d1 + d2 + d3 + d4 + d5
netAnnualROI       = totalAnnualBenefit − 18000
roiMultiple        = netAnnualROI / 18000            // e.g. 23.0 → show "23x"
paybackMonths      = 18000 / totalAnnualBenefit × 12  // e.g. 0.5 months
```

## 5. Assumptions config — implement verbatim

Put this in one typed module (`roiModel.ts`). Values verified against the spreadsheet.

```ts
export const SCENARIOS = ['Conservative', 'Moderate', 'Aggressive'] as const;

// Shared across all trades (index 0/1/2 = Cons/Mod/Agg)
export const SHARED = {
  recoveredBookingRate: [0.15, 0.25, 0.35],
  noShowReduction:      [0.25, 0.40, 0.55],
  upsellRate:           [0.05, 0.10, 0.15],
  adminHoursSaved:      [10, 20, 30],
  hourlyRate: 75,
  annualInvestment: 18000, // $1,500/mo
};

// Order this object so it also drives the trade dropdown
export const TRADES = {
  Plumbers:     { label: 'Plumbers',     callsPerTruckPerMonth: 60,  avgJobValue: 350,  ... },
  Electricians: { label: 'Electricians', callsPerTruckPerMonth: 30,  avgJobValue: 450,  ... },
  HVAC:         { label: 'HVAC',         callsPerTruckPerMonth: 70,  avgJobValue: 550,  ... },
  Roofers:      { label: 'Roofers',      callsPerTruckPerMonth: 20,  avgJobValue: 3500, ... },
  PestControl:  { label: 'Pest Control', callsPerTruckPerMonth: 35,  avgJobValue: 220,  ... },
} as const;

export function estimateMonthlyCalls(trade: TradeKey, truckCount: number): number {
  return truckCount * TRADES[trade].callsPerTruckPerMonth;
}
```

**Unit tests:** assert `estimateMonthlyCalls` for each trade (e.g. Plumbers 5 trucks → 300, HVAC 10 trucks → 700) and structural ROI properties.

## 6. Results display

- Three columns (Conservative / Moderate / Aggressive) with the improvement labels: ~10–20% / ~20–35% / ~35–50%+.
- Per column: **Net Annual ROI**, **ROI multiple** (e.g. "23x"), **Payback period** (months).
- Expandable **driver breakdown** (the five sections, each showing jobs/appts per month + annual revenue).
- **Assumptions & audit** section, including the "no double-counting" notes so the numbers are defensible:
  - Driver 1 applies only to currently-unanswered calls.
  - Drivers 2 & 4 share the baseline answered-job pool but measure different outcomes (saved no-shows vs. higher ticket).
  - Driver 3 is independent new demand.
  - Driver 5 is time value, not revenue.
- Format currency cleanly; these numbers are large, so round to whole dollars and note that figures are estimates.

## 7. PDF export and lead capture

- Branded one-page (or two-page) PDF: trade, truck count, call estimate formula, calls used, three-scenario summary, driver breakdown, and assumptions/audit.
- Server-side generation via TanStack Start **server function** (`pdf-lib`).
- Filename: `624-voice-roi-{trade}.pdf`.
- **Lead capture required for PDF download** (`REQUIRE_LEAD_FOR_PDF: true` in `src/config/features.ts`):
  - Name
  - Business name
  - Email
  - Phone number
- Validated client- and server-side before PDF generation.
- **Never gate the on-screen ROI result** — only the PDF download.
- **Book a Meeting** secondary CTA links to `/contact` (`BOOK_MEETING_URL`).

## 8. Technical notes

- Route: `src/routes/roi-calculator.tsx`.
- Extract `computeRoi(trade, calls, scenarioIndex)` and `computeAllScenarios(trade, calls)` as pure functions with unit tests — this is the credibility-critical code.
- Trade dropdown is populated from `TRADES`. Truck input drives `estimateMonthlyCalls(trade, truckCount)`.
- All numbers come from `roiModel.ts`; never hardcode in JSX so screen + PDF always agree.
- Guard inputs (blank/0/huge trucks; unknown trade). Cap trucks at 50.
- Style with brand tokens (see 00-README).

## 9. Acceptance criteria

- [x] Step 1 is a **trade dropdown**; nothing else shows until a trade is picked.
- [x] Step 2 is **"How many trucks do you have?"** number input (cap 50).
- [x] Step 3 shows **trucks × callsPerTruckPerMonth = estimated calls**.
- [x] Step 4 lets the user **verify or override** monthly calls before calculating.
- [x] Results show all three scenarios with Net Annual ROI, ROI multiple, and payback period.
- [x] Five-driver breakdown and assumptions/audit are visible.
- [x] Unit tests assert `estimateMonthlyCalls` per trade and structural ROI properties.
- [x] PDF export requires lead form (name, business, email, phone); contains trade, inputs, results, breakdown, assumptions.
- [x] Book a Meeting button present alongside PDF download.
- [x] Edge cases handled; styling matches brand; works on mobile.

## 10. Resolved decisions

1. **Scenarios:** show all three at once (three columns).
2. **PDF gate:** required — name, business name, email, phone.
3. **Disclaimer:** "Estimates based on industry averages. Your results may vary."
4. **Call volume model:** calls-per-truck (§3), not truck-band lookup.
