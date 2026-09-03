---
id: RM-010
title: One model-selection component family — ModelPicker (inline) and ModelSelector (dialog) share internals and a sidebar home
status: planned
priority: P2
effort: M (1 day)
depends_on: [RM-006]
blocks: []
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §3.2
---

# RM-010 Model picker consolidation

## Finding

Three model-selection surfaces:

- `Core/ModelPicker` (`packages/ui/src/components/model-picker/model-picker.tsx`): popover + Command, "sized to sit in a composer footer". Docblock says it is "the inline sibling of `@elabs-ai/components-ai`'s `ModelSelector`, the same `Command` internals in a modal `Dialog`".
- `AI/ModelSelector` (`packages/ai/src/model-selector.tsx`): the dialog version. Its story is titled `AI/ModelSelectorLogo` and documents only the logo sub-part, so the selector itself has no sidebar entry.
- The static Globe pill inside `Composer` (removed by RM-006).

Two implementations of "the same Command internals" in two packages will drift.

## Change

Decide between:

- **A. Merge.** `ModelPicker` gains `presentation?: "popover" | "dialog"`; `ModelSelector` becomes a thin re-export (`export const ModelSelector = (p) => <ModelPicker presentation="dialog" {...p} />`) kept for one deprecation cycle. `ModelSelectorLogo` moves to `ui` beside it, or stays in `ai` if it depends on models.dev fetching that `ui` should not own (it does: remote logo origin, CSP note). Check `packages/ai/src/model-selector.tsx` for what beyond the logo needs `ai`.
- **B. Keep two, share one.** Extract the grouped searchable list (`Command` + groups + search + selected state) into `packages/ui/src/components/model-picker/model-list.tsx`; both components render it. No public API change.

Recommendation: B, because the logo and models.dev fetching justify `ai` owning the dialog variant, and B has no deprecation.

Either way:

1. `AI/ModelSelector` gets its own story (`model-selector.stories.tsx`, `component: ModelSelector`) with a `play` test that opens the dialog and picks a model; `ModelSelectorLogo` becomes a story inside it, not a separate title.
2. Both docs descriptions carry the rule from RM-009: inline pill → ModelPicker; palette → ModelSelector.
3. `Composer`'s `WithModelPicker` story (RM-006) uses `ModelPicker`; `ChatShell`'s header story uses `ModelSelector` so both are shown in context.

## Acceptance

- One implementation of the grouped list; `grep -rn "CommandGroup" packages/ui/src/components/model-picker packages/ai/src/model-selector.tsx` finds it in one file.
- Sidebar: `Core/ModelPicker` and `AI/ModelSelector`; no `ModelSelectorLogo` top-level entry.

## Test / gate

Existing `model-picker` and `model-selector` tests; new `play` test; `pnpm ai:types-only`.
