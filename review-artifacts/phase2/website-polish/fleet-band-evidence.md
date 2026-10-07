# Fleet five-band evidence (Assessment + Contact)

Display labels (exact):

- `1–2 trucks` → stored value `1-2`
- `3–7 trucks` → stored value `3-7`
- `8–20 trucks` → stored value `8-20`
- `21–50 trucks` → stored value `21-50`
- `50+ trucks` → stored value `50+`

## Definitions and labels

- `src/lib/lead/validateLead.ts` — `FLEET_SIZE_RANGES`, `FLEET_SIZE_LABELS` (including `"50+": "50+ trucks"`).
- `src/components/assessment/AssessmentQuestion.tsx` — BP2 `<select>` maps `FLEET_SIZE_RANGES` / `FLEET_SIZE_LABELS`.
- `src/routes/contact.tsx` — fleet `<select>` uses `FLEET_SIZE_RANGES.map`.

## Validation

- `src/lib/lead/validateLead.ts` — contact `fleetSize` required when validating contact fields.

## Assessment scoring input mapping

- `src/lib/assessment/buildAnswersPayload.ts` — `BP2: fleetSize`, `fleetSize` in payload.
- `src/lib/assessment/runAssessment.ts` — `FLEET_SIZE_TO_TRUCKS["50+"]: 50` for truck count resolution.
- `src/components/assessment/RespondAssumptionsReview.tsx` — `FLEET_SIZE_TO_TRUCKS` for display truck count.

## Regression

- `scripts/phase2/website-polish-regression.test.ts` — `fleet five-band labels include 50+ trucks`.

Scoring mapping unchanged from pre-polish five-band model; polish pass only extended labels/options to include `50+`.
