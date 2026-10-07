#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/review-artifacts/phase2/website-polish"
mkdir -p "$OUT"
cd "$ROOT"
bun test 2>&1 | sed -E 's/(Bearer |Basic |password=|token=|secret=)[^ ]+/REDACTED/g' | tee "$OUT/bun-test-full.log"
bun run build 2>&1 | sed -E 's/(Bearer |Basic |password=|token=|secret=)[^ ]+/REDACTED/g' | tee "$OUT/bun-build.log"
tail -5 "$OUT/bun-test-full.log"
