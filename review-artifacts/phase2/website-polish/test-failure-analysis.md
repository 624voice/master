# Full suite failures — true pre-polish baseline vs runtime

**True pre-polish baseline:** `4d5491e757e8485c49d193417e96aef1b8a8c2ce` (parent of polish commit `3bfa602…`, predates website-polish runtime file changes).

**Runtime commit (application):** `d0f528cf25d5382a5e1182bb122a6a98c94e541e`

**Evidence / baseline JSON:** see [`test-failure-baseline.json`](test-failure-baseline.json) and pre-polish full log [`full-suite-pre-polish-baseline.log`](full-suite-pre-polish-baseline.log).

## Baseline establishment (literal git)

```
git show --no-patch --format='%H%n%P%n%s' 3bfa6021a99d8bbec0a7b7ad323170b1d6e518cf
3bfa6021a99d8bbec0a7b7ad323170b1d6e518cf
4d5491e757e8485c49d193417e96aef1b8a8c2ce
Phase 2 final website design polish and copy corrections

git rev-parse 3bfa6021a99d8bbec0a7b7ad323170b1d6e518cf^
4d5491e757e8485c49d193417e96aef1b8a8c2ce

git show --no-patch --format='%H%n%P%n%s' 3bfa6021a99d8bbec0a7b7ad323170b1d6e518cf^
4d5491e757e8485c49d193417e96aef1b8a8c2ce
ec771024d7550fd34098d77c008419fc26d8af9d
Regenerate owner walkthrough for open QA preview URL
```

## Full suite summary

| Commit | Pass | Fail | Total | Command |
|--------|------|------|-------|---------|
| Pre-polish `4d5491e…` | 827 | 9 | 836 | `bun test` (inherited VM env) |
| Runtime `d0f528c…` / PR HEAD app | 837 | 10 | 847 | `bun test` (inherited VM env) |

The prior baseline JSON used **wrong test paths** and **wrong baseline SHA** (`3bfa602…`, the polish commit). Path-miss Bun messages (“filters did not match any test files”) were **not** valid reproductions and have been removed.

## Per-failure matrix (10 failures at final runtime)

| # | Test name | File | Command | Pre-polish `4d5491e…` | Final `d0f528c…` | Reproduced? | Classification |
|---|-----------|------|---------|----------------------|------------------|-------------|----------------|
| 1 | `Assessment browser journey X-JRN-DOM (fail-closed backend) > (unnamed)` | `src/browser-journey/assessment.browserJourney.test.ts` | `bun test` | fail (stale `BROWSER_JOURNEY_BASE_URL`) | fail (same) | yes | Environmental and equivalently reproduced |
| 2 | `Assessment browser journey X-JRN-DOM (safe backend) > (unnamed)` | same | `bun test` | fail | fail | yes | Environmental and equivalently reproduced |
| 3 | `X-SAFE-PREVIEW-FOCUS-04: BP1 and BP2…` | `scripts/phase2/bp1Bp2KeyboardModel.test.ts` | `bun test ./scripts/phase2/bp1Bp2KeyboardModel.test.ts` | pass (isolated + full suite) | fail isolated (label `"trucks"` vs expected `"vehicles"`) | no at baseline | **Introduced by polish** |
| 4 | `X-SAFE-PREVIEW-FOCUS-02: GF-S choice buttons…` | `scripts/phase2/assessmentKeyboardModel.test.ts` | `bun test ./scripts/phase2/assessmentKeyboardModel.test.ts` | fail | fail | yes | Pre-existing and reproduced |
| 5–7 | ROI duplication trio | `src/server/sms/sendState.duplication.test.ts` | isolated pass; `bun test` fail | fail full suite | fail full suite | yes | Order-dependent and reproduced |
| 8 | `S-RT-03: skips rate limit when Redis is not configured` | `src/server/assessment/rateLimitSource.test.ts` | `env -u UPSTASH_REDIS_* bun test ./src/server/assessment/rateLimitSource.test.ts` | fail | fail | yes | Pre-existing and reproduced |
| 9 | `S-IDEM-12: skips idempotency when Redis is not configured` | same | same | fail | fail | yes | Pre-existing and reproduced |
| 10 | `X-JRN-PIPE-02: corrected resubmission…` | `src/server/assessment/assessmentJourneyPipeline.test.ts` | `bun test` vs isolated file | fail full suite (`sink is not a function`) | fail full suite | yes | Order-dependent and reproduced |

**Polish regression (scoped):** `scripts/phase2/website-polish-regression.test.ts` — 11/11 pass in isolation at runtime commit.

No frozen production behavior was changed to green the suite.
