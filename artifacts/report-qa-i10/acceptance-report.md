# Instruction #10 — Final Acceptance Report

## Evidence blockers resolved

### BLOCKER 1 — Gold reference PDF
- **Path:** `design-reference-v3/ROI-Doc-Gold-Standard-Final.pdf` (rendered from authoritative v3 HTML `design-reference/Revenue Report.dc.html`)
- **Validation:** Page 4 contains `04` and `90-Day Results Guarantee`; does NOT contain `Even the conservative model puts` or section `06`
- **Note:** Committed `design-reference-v3/gold-standard.pdf` remains the i7-era production artifact and is NOT used for comparison

### BLOCKER 2 — All four AE values

| Page | Before (i9 HTML) | After (i10 HTML) | After (i10 PDF) |
|-----:|-----------------:|-----------------:|----------------:|
| 1 | 538,103 | 483,670 | 495,372 |
| 2 | 418,229 | 418,229 | 359,817 |
| 3 | 575,643 | 575,643 | 522,511 |
| 4 | 1,283,840 | 525,824 | 505,785 |

Page 4 AE improved 59% (HTML) after CTA height/padding, checkmark, and guarantee spacing fixes.

### BLOCKER 3 — Netlify gates
See `netlify-gates.json`. True-cold first request on fresh deploy URL:
- Renderer cold TTFB 9.06 s, `chromiumPrepMs` 4653 — **PASS** (≤ 20 s)
- Warm renderer handler 2.44 s — **PASS** (≤ 3 s)
- Independent cold `GET /report/$token` TTFB 3.09 s — **PASS** (≤ 20 s)
- Unzipped function bundle 78.12 MB — **PASS** (≤ 150 MB)
- puppeteer/chromium absent from `dist/client` — **PASS**
- PDF 174,173 bytes, 4 pages

## Visual fixes (Page 1 / Page 4 only)

1. **Page 4 CTA height** — padding 30px×40px, internal spacing matched to gold HTML; simple green ✓ checkmarks (no circle)
2. **Page 4 guarantee spacing** — explicit flex layout with `margin-top: auto` on guarantee; padding 16px×28px
3. **Page 1 calibration** — hero/stack/driver row spacing increased per A1 continuation
4. **Pages 2 & 3** — unchanged (HTML AE identical to i9)

## Guarantee punctuation (verify only)
- Canonical: `go-live - or` (hyphen-minus) in `src/lib/report/reportCopy.ts`
- Gold PDF: em dash — documented divergence, no copy change

## Runtime path parity
See `runtime-path-parity.md`.

## Tests
501/501 pass.
