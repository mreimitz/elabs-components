# Loading & streaming states

Not-ready UI is **prop-driven only** (`docs/DECISIONS.md` §D5): a component never fetches or
reads `use()`/Suspense.

## Two signals (orthogonal)

| Signal                  | Means               | Renders                               |
| ----------------------- | ------------------- | ------------------------------------- |
| `loading?: boolean`     | no content yet      | layout-shaped skeleton                |
| `isStreaming?: boolean` | still arriving (AI) | build up; hide transient parse errors |

- From empty, both: skeleton until the first token, then build up.
- **Errors fire ONLY on terminal, settled failures** — never while `loading`/`isStreaming` or on
  incomplete input.

## Aliases (keep; never a fourth name)

- `loading` (DataTable = reference impl, Gantt) and `isStreaming` (reasoning/plan/terminal/
  jsx-preview) — canonical.
- `status="loading"|"ready"` — charts only; never `status` elsewhere for loading.
- `StatePanel kind="empty|error|loading"` — a message panel, not a skeleton (mirror layout →
  `Skeleton`; message → `StatePanel`).

## Slot exposure (in order)

1. **Internal prop** (fixed layout) — own skeleton, MUST mirror the real DOM (no layout shift).
2. **Compound `XSkeleton` part** (consumer-owned layout; e.g. `JSXPreviewSkeleton`) — the
   provider's `status`/`loading` picks it.
3. **`loadingSlot?: ReactNode`** — last resort.

## Primitives (never duplicate)

`Skeleton`/`Spinner`/`StatePanel`: `packages/ui/src/components/{skeleton,spinner,state-panel}/`;
`Shimmer`: `packages/ai/src/shimmer.tsx`; chart skeletons:
`packages/charts/src/charts/{generate-chart-skeleton-data.ts,area-chart-loading.tsx}`.

- Box/block/row → `Skeleton` (`aria-hidden`; size via `className`); never hand-roll
  `animate-pulse bg-muted` boxes.
- Region "loading…" message → `StatePanel kind="loading"`; inline → `Spinner` (`role="status"`).
- Streaming text cue → `Shimmer` (not a skeleton). Charts → chart skeleton utilities, never boxes.
- **a11y:** skeletons `aria-hidden` (no per-box `role="status"`); one
  `role="status" aria-live="polite"` per region (`StatePanel`/`Spinner` have it); terminal
  errors `role="alert"`.
- **CLS:** reserve the final box (`AspectRatio`, row height, line size); never collapse-then-expand.
- **Motion:** `animate-pulse` ok; `Shimmer` gates on `useReducedMotion`; a new animated
  placeholder gets `motion-reduce:` (`docs/MOTION_GUIDELINES.md`).

## Gate

`pnpm loading-states:check` (`scripts/check-loading-states.mjs`; self-test
`pnpm loading-states:check:test`): a manifest-listed component with boolean `loading`/`isStreaming`
or chart `status: ChartStatus` needs a story (co-located, or the shared file a child is exercised
from) at the not-ready value (arg/JSX prop) or a `*Loading`/`*Streaming` export.
`scripts/loading-states-baseline.json` ratchets down only (`--update`); a new prop ships its story.

History and measurements: docs/rules-history/loading-states.md
