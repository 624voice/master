#!/usr/bin/env bash
# Compare test failures at true pre-polish baseline vs runtime commit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/review-artifacts/phase2/website-polish/test-failure-baseline.json"
PRE_POLISH_SHA="${TEST_PRE_POLISH_BASELINE_SHA:-4d5491e757e8485c49d193417e96aef1b8a8c2ce}"
RUNTIME_SHA="${TEST_RUNTIME_SHA:-d0f528cf25d5382a5e1182bb122a6a98c94e541e}"
PR_HEAD_SHA="$(git -C "$ROOT" rev-parse HEAD)"
WT_BASE="/tmp/phase2-test-baseline-pre-polish"
WT_RUNTIME="/tmp/phase2-test-baseline-runtime"

run_bun_test() {
  local cwd="$1"
  shift
  local log
  log="$(mktemp)"
  (cd "$cwd" && bun test "$@" >"$log" 2>&1) || true
  local exit=$?
  python3 - "$exit" "$log" <<'PY'
import json, sys
exit_code, path = int(sys.argv[1]), sys.argv[2]
text = open(path, encoding="utf-8", errors="replace").read()
print(json.dumps({"exitCode": exit_code, "output": text[-12000:]}))
PY
  rm -f "$log"
}

setup_worktree() {
  local wt="$1" sha="$2"
  git worktree remove -f "$wt" 2>/dev/null || true
  git worktree add -f "$wt" "$sha" >/dev/null
  (cd "$wt" && bun install --frozen-lockfile >/dev/null 2>&1) || (cd "$wt" && bun install >/dev/null 2>&1)
}

setup_worktree "$WT_BASE" "$PRE_POLISH_SHA"
setup_worktree "$WT_RUNTIME" "$RUNTIME_SHA"

# Preserve VM env for full-suite parity (includes stale BROWSER_JOURNEY_BASE_URL when set).
FULL_SUITE_ENV="inherit"

ISOLATED_CASES=(
  "./scripts/phase2/assessmentKeyboardModel.test.ts"
  "./scripts/phase2/bp1Bp2KeyboardModel.test.ts"
  "./src/server/sms/sendState.duplication.test.ts"
  "./src/server/assessment/rateLimitSource.test.ts"
  "./src/server/assessment/assessmentJourneyPipeline.test.ts"
)

python3 - "$OUT" "$PRE_POLISH_SHA" "$RUNTIME_SHA" "$PR_HEAD_SHA" "$WT_BASE" "$WT_RUNTIME" "$ROOT" <<'PY'
import json, subprocess, sys, os

out_path, pre_sha, runtime_sha, pr_head, wt_base, wt_runtime, root = sys.argv[1:8]
cases = [
  "./scripts/phase2/assessmentKeyboardModel.test.ts",
  "./scripts/phase2/bp1Bp2KeyboardModel.test.ts",
  "./src/server/sms/sendState.duplication.test.ts",
  "./src/server/assessment/rateLimitSource.test.ts",
  "./src/server/assessment/assessmentJourneyPipeline.test.ts",
  "./src/browser-journey/assessment.browserJourney.test.ts",
]

def run(cwd, args, env=None):
    merged = os.environ.copy()
    if env:
        merged.update(env)
    p = subprocess.run(["bun", "test", *args], cwd=cwd, capture_output=True, text=True, env=merged)
    return {"exitCode": p.returncode, "command": f"bun test {' '.join(args)}", "output": (p.stdout + p.stderr)[-12000:]}

record = {
  "prePolishBaselineSha": pre_sha,
  "prePolishBaselineParentOf": "3bfa6021a99d8bbec0a7b7ad323170b1d6e518cf",
  "runtimeSha": runtime_sha,
  "prHeadSha": pr_head,
  "notes": {
    "prePolishRationale": "Parent of polish commit 3bfa602 (Phase 2 final website design polish); predates polish runtime file changes.",
    "fullSuiteEnv": "Inherited process environment (includes BROWSER_JOURNEY_BASE_URL when set on VM).",
  },
  "isolatedRuns": [],
  "fullSuite": {},
}

for case in cases:
    record["isolatedRuns"].append({
        "file": case,
        "prePolish": run(wt_base, [case]),
        "runtime": run(wt_runtime, [case]),
        "prHead": run(root, [case]) if pr_head != runtime_sha else None,
    })

# Rate limit: explicit Redis-unconfigured env for S-RT-03 / S-IDEM-12 isolation
redis_env = {
    "UPSTASH_REDIS_REST_URL": "",
    "UPSTASH_REDIS_REST_TOKEN": "",
}
for key in list(redis_env.keys()):
    pass
redis_unset = {k: "" for k in ("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN")}
def run_no_redis(cwd, case):
    env = os.environ.copy()
    env.pop("UPSTASH_REDIS_REST_URL", None)
    env.pop("UPSTASH_REDIS_REST_TOKEN", None)
    p = subprocess.run(["bun", "test", case], cwd=cwd, capture_output=True, text=True, env=env)
    return {"exitCode": p.returncode, "command": f"env -u UPSTASH_REDIS_REST_URL -u UPSTASH_REDIS_REST_TOKEN bun test {case}", "output": (p.stdout + p.stderr)[-8000:]}

record["rateLimitRedisUnset"] = {
    "file": "./src/server/assessment/rateLimitSource.test.ts",
    "prePolish": run_no_redis(wt_base, "./src/server/assessment/rateLimitSource.test.ts"),
    "runtime": run_no_redis(wt_runtime, "./src/server/assessment/rateLimitSource.test.ts"),
}

print("Running full suite at pre-polish baseline (long)...", flush=True)
record["fullSuite"]["prePolish"] = run(wt_base, [])
print("Running full suite at runtime commit (long)...", flush=True)
record["fullSuite"]["runtime"] = run(wt_runtime, [])
if pr_head != runtime_sha:
    print("Running full suite at PR HEAD (long)...", flush=True)
    record["fullSuite"]["prHead"] = run(root, [])

with open(out_path, "w") as f:
    json.dump(record, f, indent=2)
print(f"Wrote {out_path}")
PY

git worktree remove -f "$WT_BASE" >/dev/null || true
git worktree remove -f "$WT_RUNTIME" >/dev/null || true
