#!/bin/bash
# Run this once on your Mac to clone the repo and open the handoff folder for Claude Cowork.
set -euo pipefail

REPO_URL="https://github.com/624voice/master.git"
BRANCH="cursor/llm-orchestrator-537c"
TARGET="${HOME}/624voice-master"

echo "→ Cloning or updating 624voice/master..."
if [ -d "$TARGET/.git" ]; then
  git -C "$TARGET" fetch origin
  git -C "$TARGET" checkout "$BRANCH"
  git -C "$TARGET" pull origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$TARGET"
fi

HANDOFF="$TARGET/docs/claude-handoff"
echo ""
echo "✓ Ready: $HANDOFF"
echo ""
ls "$HANDOFF"
echo ""
echo "Opening folder in Finder..."
open "$HANDOFF"
echo ""
echo "Next in Claude Cowork:"
echo "  1. Choose \"Connect a folder now\""
echo "  2. Select: $HANDOFF"
echo "     (or select the whole repo: $TARGET)"
echo ""
echo "Start Claude with: 00-START-HERE.md or CLAUDE-MASTER-CONTEXT.md"
