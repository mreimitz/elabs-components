---
id: RM-011
title: ChangeReview renders its hunks through DiffView
status: planned
priority: P2
effort: M (1 day)
depends_on: []
blocks: []
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §3.4
---

# RM-011 ChangeReview renders through DiffView

## Finding

`docs/decisions/2026-09-01-brainless-adoption-architecture.md` §3 binds `DiffView` (`packages/ai/src/diff-view.tsx`) and `ChangeReview` (`packages/ui/src/components/change-review/change-review.tsx`) together as a seam. In source, `change-review.tsx` imports only Button, Badge, StatePanel, StatusIcon and lucide; it draws its own `+`/`-` hunk lines. DiffView draws its own too. Two hand-written line renderers for the same rows, in two packages, with two sets of tokens to keep in sync.

Complication: `ChangeReview` lives in `ui`; `DiffView` lives in `ai` because it uses `highlightCode` (Shiki) and `ui` must not depend on Shiki. `ui` cannot import `ai` (one-way graph).

## Change

Pick one:

- **A. Move ChangeReview to `ai`.** It is an AI-edit trust gate; the story already lives under `AI/ChangeReview`. `ui` keeps a deprecated re-export for one cycle (`docs/DEPRECATION.md`), then drops it. Then `ChangeReview` renders each hunk with `<DiffView lines={hunk.lines} />` and keeps only the accept/reject chrome. Check who imports it from `ui`: `grep -rn "ChangeReview" packages registry apps --include=*.tsx -l`.
- **B. Split DiffView.** A Shiki-free `DiffLines` primitive in `ui` (rows, gutters, +/- tokens, no syntax colour) that both `DiffView` (adds Shiki spans) and `ChangeReview` render. Keeps ChangeReview in `ui`.

Recommendation: A. The decision doc already calls the pair a seam, ChangeReview is titled under AI, and B adds a third component to explain.

Whichever: the ChangeReview `play` tests (accept one, reject one, accept all, keyboard) must pass unchanged, and a three-theme visual sweep of `AI/ChangeReview` must show identical hunk colours to `AI/DiffView`.

## Acceptance

- `change-review.tsx` contains no line-rendering markup of its own; hunk rows come from DiffView (or DiffLines).
- One place defines the add/remove/context row tokens.
- Import graph check (`pnpm` gate that enforces one-way deps) passes.

## Test / gate

Existing ChangeReview and DiffView tests; visual sweep; deprecation entry if A.
