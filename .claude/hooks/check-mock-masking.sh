#!/usr/bin/env bash
# check-mock-masking.sh — PostToolUse(Write|Edit)
# -----------------------------------------------------------------------------
# WARN-ONLY (always exit 0). When a *.test.* / *.stories.* file is written, flags
# the "mock-masking" smell: the file MOCKS a @elabs-ai/components-* component (vi.mock("@elabs-ai/components-..."))
# AND asserts accessibility attributes (aria-*, toHaveAttribute('aria...'),
# getByRole(..., { name }) ). A mock stand-in (e.g. a plain <textarea> that happens
# to honor aria-label) can PASS the a11y assertion while the REAL component fails
# it — masking a P0 a11y bug (the #34/#46 lesson). Advisory only: legitimate mocks
# exist; this just prompts a real-surface a11y check. Quiet on the happy path.
set -u

input="$(cat 2>/dev/null || true)"

file_path=""
if command -v jq >/dev/null 2>&1; then
  file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
fi
if [ -z "$file_path" ]; then
  file_path="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
fi

[ -z "$file_path" ] && exit 0
[ -f "$file_path" ] || exit 0

# Only test/story files.
case "$file_path" in
  *.test.ts|*.test.tsx|*.test.js|*.test.jsx|*.stories.ts|*.stories.tsx|*.stories.js|*.stories.jsx) ;;
  *) exit 0 ;;
esac

# 1. mocks a @elabs-ai/components-* module (vi.mock / jest.mock / vi.doMock)
grep -Eq '(vi|jest)\.(do)?[mM]ock\([[:space:]]*["'"'"']@elabs-ai/components-' "$file_path" 2>/dev/null || exit 0

# 2. asserts a11y attributes on the stand-in
if grep -Eq "aria-|toHaveAttribute\([[:space:]]*['\"]aria|getByRole\([^)]*name" "$file_path" 2>/dev/null; then
  cat >&2 <<MSG
⚠ mock-masking check ($(basename "$file_path")): this file mocks a @elabs-ai/components-* component
AND asserts a11y attributes (aria-* / toHaveAttribute('aria…') / getByRole(…, { name })).
A mock stand-in can PASS the a11y assertion while the REAL component fails it (the #34/#46
trap: a <textarea> that honors aria-label masked a Monaco a11y bug). Verify accessibility
against the REAL rendered surface (a Storybook story / test-storybook / the real screen),
not the mock — see .claude/rules/quality-gates.md "Reporting completion honestly". (Advisory.)
MSG
fi
exit 0
