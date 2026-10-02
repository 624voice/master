# Full suite failures — true pre-polish baseline vs final cleanup

**True pre-polish baseline:** `4d5491e757e8485c49d193417e96aef1b8a8c2ce`  
**Application runtime commit:** `d0f528cf25d5382a5e1182bb122a6a98c94e541e`  
**Final cleanup:** `bp1Bp2KeyboardModel.test.ts` derives fleet labels from `FLEET_SIZE_LABELS` (`validateLead.ts`).

## Full suite summary (after keyboard test fix)

| Commit / tree | Pass | Fail | Total |
|---------------|------|------|-------|
| Pre-polish `4d5491e…` | 827 | 9 | 836 |
| Final (post-fix) | **838** | **9** | 847 |

Log: [`bun-test-full.log`](bun-test-full.log). Pre-polish log: [`full-suite-pre-polish-baseline.log`](full-suite-pre-polish-baseline.log).

**Resolved:** `X-SAFE-PREVIEW-FOCUS-04` (stale `"vehicles"` expectations → canonical `"trucks"` labels via `FLEET_SIZE_LABELS`).

## Remaining 9 failures (all reproduced at true pre-polish baseline)

| # | Test | File | Classification |
|---|------|------|----------------|
| 1–2 | X-JRN-DOM (fail-closed / safe) `(unnamed)` | `src/browser-journey/assessment.browserJourney.test.ts` | Environmental and equivalently reproduced |
| 3 | X-SAFE-PREVIEW-FOCUS-02 | `scripts/phase2/assessmentKeyboardModel.test.ts` | Pre-existing and reproduced |
| 4–6 | ROI duplication trio | `src/server/sms/sendState.duplication.test.ts` | Order-dependent and reproduced |
| 7–8 | S-RT-03, S-IDEM-12 | `src/server/assessment/rateLimitSource.test.ts` | Pre-existing and reproduced |
| 9 | X-JRN-PIPE-02 | `src/server/assessment/assessmentJourneyPipeline.test.ts` | Order-dependent and reproduced |

Polish regression: `scripts/phase2/website-polish-regression.test.ts` — 11/11 pass.
