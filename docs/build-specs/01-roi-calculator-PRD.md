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

## 7. PDF export

- Branded one-page (or two-page) PDF: trade, truck count + calls used, the three-scenario summary, the driver breakdown, and the assumptions/audit.
- Prefer server-side generation via a TanStack Start **server function** for consistent output; client-side `jsPDF` acceptable for v1 (flag the dependency).
- Filename: `624-voice-roi-{trade}.pdf`.
- **Optional lead capture:** gate the PDF behind name/email via flag `REQUIRE_EMAIL_FOR_PDF` (default off), POSTing to the PRD 3 lead store. Never gate the on-screen result.

## 8. Technical notes

- Route: `src/routes/roi-calculator.tsx`.
- Extract `computeRoi(trade, calls, scenarioIndex)` and `computeAllScenarios(trade, calls)` as pure functions with unit tests — this is the credibility-critical code.
- Trade dropdown is populated from `TRADES`. Truck input drives `estimateMonthlyCalls(trade, truckCount)`.
- All numbers come from `roiModel.ts`; never hardcode in JSX so screen + PDF always agree.
- Guard inputs (blank/0/huge trucks; unknown trade). Cap trucks at 50.
- Style with brand tokens (see 00-README).

## 9. Acceptance criteria

- [ ] Step 1 is a **trade dropdown** (Plumbers / Electricians / HVAC / Roofers / Pest Control); nothing else shows until a trade is picked.
- [ ] Step 2 is a **"How many trucks do you have?" number input**, mapped to that trade's monthly calls via §3.
- [ ] Confirmation step echoes the mapped monthly call number and lets the user override it with an exact figure.
- [ ] Results show all three scenarios with Net Annual ROI, ROI multiple, and payback period.
- [ ] Five-driver breakdown and the assumptions/audit are visible.
- [ ] Unit tests assert the §5 sanity-check figures for all five trades.
- [ ] PDF export contains trade, inputs, three-scenario results, breakdown, and assumptions.
- [ ] Edge cases handled without errors; styling matches brand and works on mobile.

## 10. Open questions for Chris (small now)

1. Show all three scenarios at once (recommended) or let the user toggle one?
2. Gate the PDF behind email, or leave open for v1?
3. Any disclaimer text you want on-screen/in the PDF (e.g. "estimates based on industry averages")?
