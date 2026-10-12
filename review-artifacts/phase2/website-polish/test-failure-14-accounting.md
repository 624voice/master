# Fourteen-failure accounting

> **Limitation:** The original **890 pass / 14 fail / 904 total** full-suite log was **not preserved**. Historical accounting for the eight resolved failures is **reconstructed** from identified commits, test files, focused runs, and retained artifacts; it is **not** a verbatim recovery of the missing run.

**Machine-readable table (all 14 rows, per-row evidence sources):** [`test-failure-14-accounting.json`](test-failure-14-accounting.json)

**Verified successor snapshot:** `c6ae9b4ba2b1735bd5849c1e88a18b16c8ec3b01` → **898 / 6 / 904** (committed `bun-test-full.log` via `git show c6ae9b4:…`).

**Current full suite:** **899 / 6 / 905** — [`bun-test-full.log`](bun-test-full.log) (+1 pass: `deployVersion.test.ts` minimal health after security corrective).

**Baseline for remaining six:** `4d5491e757e8485c49d193417e96aef1b8a8c2ce` — [`bun-test-baseline-4d5491e.log`](bun-test-baseline-4d5491e.log), [`six-failure-baseline-evidence.json`](six-failure-baseline-evidence.json).

**Focused reruns (corrected rows):** [`test-failure-corrected-reruns.log`](test-failure-corrected-reruns.log).
