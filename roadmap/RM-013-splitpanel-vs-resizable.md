---
id: RM-013
title: SplitPanel and Resizable — one story about split panes
status: planned
priority: P3
effort: S (half day)
depends_on: []
blocks: []
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §3.7
---

# RM-013 SplitPanel vs Resizable

## Finding

`Layout/SplitPanel` (`packages/ui/src/components/split-panel/split-panel.tsx`) imports only `cva` and `cn`: a fixed two-pane layout with the per-pane tone system (plain / card / muted). `Layout/Resizable` (`packages/ui/src/components/resizable/resizable.tsx`) is the `react-resizable-panels` primitive set. They are independent implementations and neither story has a docs description, so the sidebar offers two split panes with no rule.

## Change

Either:

- **A. Unify.** `SplitPanel` gains `resizable?: boolean` (default false). When true it renders `ResizablePanelGroup` / `ResizablePanel` / `ResizableHandle` under the hood and keeps its tone classes on each pane. `Resizable` stays exported as the primitive for n-pane layouts.
- **B. Document only.** Both descriptions: "Fixed proportions with surface tones → SplitPanel. User-draggable → Resizable (panel group primitive)."

Recommendation: A, because the tone system is the branded part and a draggable pane without it will be built by hand the first time someone needs both.

Add descriptions to both stories in either case (RM-016 covers the wording).

## Acceptance

- A: a `Resizable` story of `SplitPanel` exists with a `play` test dragging the handle and asserting pane width changed; tones still apply.
- Both docs pages name the other.

## Test / gate

Existing split-panel tests; new play test if A.
