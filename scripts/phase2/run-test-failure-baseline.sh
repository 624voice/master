#!/usr/bin/env bash
set -euo pipefail
BASE_SHA="${TEST_BASELINE_SHA:-4d5491e757e8485c49d193417e96aef1b8a8c2ce}"
WT="/tmp/phase2-polish-test-baseline"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/review-artifacts/phase2/website-polish/test-failure-baseline.json"

git worktree remove -f "$WT" 2>/dev/null || true
git worktree add -f "$WT" "$BASE_SHA" >/dev/null
(cd "$WT" && bun install --frozen-lockfile >/dev/null 2>&1) || (cd "$WT" && bun install >/dev/null 2>&1)

TESTS=(
  "./src/browser-journey/assessment.browserJourney.test.ts"
  "./scripts/phase2/assessmentKeyboardModel.test.ts"
  "./scripts/phase2/bp1Bp2KeyboardModel.test.ts"
  "./src/server/sms/sendState.duplication.test.ts"
  "./src/server/assessment/rateLimitSource.test.ts"
  "./src/server/assessment/assessmentJourneyPipeline.test.ts"
)

python3 - "$OUT" "$BASE_SHA" "$(git -C "$ROOT" rev-parse HEAD)" "$WT" "$ROOT" "${TESTS[@]}" <<'PY'
import json, subprocess, sys
out, base_sha, head_sha, wt, root, *tests = sys.argv[1:]
runs = []
for t in tests:
    def run(cwd):
        p = subprocess.run(["bun", "test", t], cwd=cwd, capture_output=True, text=True)
        return {"exit": p.returncode, "tail": (p.stdout + p.stderr)[-2000:]}
    runs.append({"file": t, "baseline": run(wt), "head": run(root)})
open(out, "w").write(json.dumps({"baselineSha": base_sha, "headSha": head_sha, "runs": runs}, indent=2))
PY

git worktree remove -f "$WT" >/dev/null
echo "Wrote $OUT"
