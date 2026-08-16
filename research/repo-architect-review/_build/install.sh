#!/usr/bin/env bash
# Install the repo-architect-review build into place.
# Copies the staged artifacts from research/repo-architect-review/_build/ into
# .claude/ and docs/ADR/. Idempotent (cp overwrites). Non-destructive otherwise.
#
#   bash research/repo-architect-review/_build/install.sh
#
# After running, apply the discovery wiring in _build/WIRING.md (small edits to
# CLAUDE.md / AGENTS.md / package.json / .gitignore), then commit.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"            # …/research/repo-architect-review/_build
ROOT="$(cd "$SRC/../../.." && pwd)"             # repo root
echo "repo root: $ROOT"

mkdir -p "$ROOT/.claude/rules" "$ROOT/.claude/scripts" "$ROOT/.claude/agents" \
         "$ROOT/.claude/commands" "$ROOT/docs/ADR"

cp -v "$SRC/claude/rules/architecture-review.md"        "$ROOT/.claude/rules/"
cp -v "$SRC/claude/scripts/arch-evidence-pack.mjs"      "$ROOT/.claude/scripts/"
cp -v "$SRC/claude/agents/repo-architect-"*.md          "$ROOT/.claude/agents/"
cp -v "$SRC/claude/commands/repo-architect-review.md"   "$ROOT/.claude/commands/"
cp -v "$SRC/docs-adr/0009-repo-architecture-review.md"  "$ROOT/docs/ADR/"

chmod +x "$ROOT/.claude/scripts/arch-evidence-pack.mjs" || true

echo
echo "✓ installed. Next:"
echo "  1) apply the snippets in $SRC/WIRING.md (CLAUDE.md / AGENTS.md / package.json / .gitignore)"
echo "  2) sanity-check:  node .claude/scripts/arch-evidence-pack.mjs --depth quick"
echo "  3) first real run (in Claude Code):  /repo-architect-review"
