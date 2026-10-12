# Guarantee inventory (`SHOW_VOICE_AI_GUARANTEE` default false)

Raw search output: `review-artifacts/phase2/website-polish/guarantee-inventory.raw.txt`

## Public marketing render sites (guarded)

| File | Guard |
|------|--------|
| `src/routes/index.tsx` | `{FEATURE_FLAGS.SHOW_VOICE_AI_GUARANTEE ? (` … guarantee sections |
| `src/routes/demo.tsx` | same pattern — 90-Day / Results Guarantee block |
| `src/routes/contact.tsx` | same pattern |

Default: `src/config/features.ts` → `SHOW_VOICE_AI_GUARANTEE: false`.

## Non-marketing guarantee text (not gated by marketing flag)

Report/PDF and agent copy retain guarantee strings for when reports or demo profiles include guarantee fields — not shown on public pages while the flag is false. Examples: `src/lib/report/reportCopy.ts`, PDF styles, demo no-response campaign when profile field set.

## Rendered proof (protected preview, flag false)

Automated check at final deploy: authenticated `GET /` and `/demo` responses contain **no** `90-Day Results Guarantee` or `recover at least our service investment` strings (see `guarantee-rendered-check.json` in this directory after evidence commit).
