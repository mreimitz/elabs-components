---
id: RM-015
title: Rename AI/Context to TokenUsage
status: planned
priority: P3
effort: S (half day)
depends_on: []
blocks: []
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §3.7
---

# RM-015 Rename AI/Context

## Finding

`AI/Context` (`packages/ai/src/context.tsx`: `Context`, `ContextTrigger`, `ContextContent`, `ContextInputUsage`, `ContextOutputUsage`, `ContextReasoningUsage`, `ContextCacheUsage`) is a context-window usage ring. `AI/ContextPanel` (`context-panel.tsx`) is the chat workspace's right rail. Unrelated components, adjacent names, adjacent sidebar entries. "Context" is the AI Elements upstream name; nothing here depends on keeping it.

## Change

1. Rename the family to `TokenUsage*` (`TokenUsage`, `TokenUsageTrigger`, `TokenUsageContent`, `TokenUsageInput`, `TokenUsageOutput`, `TokenUsageReasoning`, `TokenUsageCache`). File `token-usage.tsx`; story `AI/TokenUsage`.
2. Keep `Context*` as deprecated aliases for one release per `docs/DEPRECATION.md` (`export const Context = TokenUsage` with a `@deprecated` JSDoc so the CLI's docs output shows it), then remove.
3. Update `ATTRIBUTION.md` / provenance comments (the file is derived from AI Elements; `pnpm attribution:provenance:check` must still pass with the new file name).
4. Grep consumers: `grep -rn "\bContext\(Trigger\|Content\|InputUsage\)" packages registry apps --include=*.tsx`.
5. Manifest, inventory, llms regenerated.

## Acceptance

- Sidebar shows `AI/TokenUsage` and `AI/ContextPanel`; no `AI/Context`.
- `brand-ui info Context` prints the deprecation pointer.

## Test / gate

`pnpm attribution:provenance:check`, `pnpm agent-docs:check`, existing `context.test.tsx` renamed and passing.
