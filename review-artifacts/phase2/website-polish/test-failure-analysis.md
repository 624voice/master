# Full suite failures at HEAD `6db48386c056bee1dffbeb6b8bec27c578e6447a` (pre-final evidence commit)

Source log: `review-artifacts/phase2/website-polish/bun-test-full.log`  
Result: **837 pass, 10 fail, 847 total**

| # | Test name | Safe failure summary | Pre-polish baseline (`3bfa602…`) | Unrelated to polish? |
|---|-----------|-------------------|-----------------------------------|----------------------|
| 1–2 | `Assessment browser journey X-JRN-DOM (fail-closed backend)` / `(safe backend)` | Hard-coded preview URL `6abbd602…` unreachable / server did not start (~130s timeout) | Same failure pattern (see `test-failure-baseline.json`) | Yes — external Netlify URL + browser harness env |
| 3 | `BP1/BP2 keyboard model supplement > X-SAFE-PREVIEW-FOCUS-04` | Puppeteer focus capture against stale preview URL | N/A (script path) | Yes — QA preview URL dependency |
| 4 | `assessment keyboard model supplement > X-SAFE-PREVIEW-FOCUS-02` | Same class of browser preview dependency | N/A | Yes |
| 5–7 | `duplication-boundary replay…` ROI SMS tests | In-memory SMS store polluted when full suite runs (pass in isolation per stability artifacts) | Isolated file passes in historical verification JSON | Yes — test order pollution, not polish UI |
| 8 | `checkAssessmentSourceRateLimit supplemental > S-RT-03` | Expects skip when Redis unset; environment has Redis stub misaligned in full run | Supplemental expects env toggle | Yes — Redis env coupling |
| 9 | `checkAssessmentPhoneIdempotency supplemental > S-IDEM-12` | Same Redis supplemental mismatch | Same | Yes |
| 10 | `X-JRN-PIPE-02: corrected resubmission…` | `TypeError: sink is not a function` in `trackEvent` after analytics mock pollution from earlier tests | **Passes** when `assessmentJourneyPipeline.test.ts` run alone (baseline JSON) | Yes — analytics sink test pollution in full suite only |

**Polish regression:** `scripts/phase2/website-polish-regression.test.ts` — 11/11 pass when run directly.

**Frozen agent / production behavior:** no production code changed to green the suite.
