#!/usr/bin/env bash
set -euo pipefail
cd /workspace
unset OPENAI_API_KEY
export $(grep -v '^#' .env | xargs)

mkdir -p /tmp/s2l-live-eval-runs

for run in 1 2 3 4 5; do
  echo "=== LIVE EVAL RUN $run ==="
  S2L_LIVE_EVAL=true bun test src/server/speed2Lead/eval/liveEval.test.ts 2>&1 | tee "/tmp/s2l-live-eval-runs/run-${run}.log"
  cp /tmp/s2l-live-eval-report.json "/tmp/s2l-live-eval-runs/report-${run}.json"
done

echo "All 5 runs complete."
