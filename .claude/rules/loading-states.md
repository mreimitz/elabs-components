# Loading, streaming & placeholder states (one vocabulary, two signals)

The cross-cutting convention for **"not-ready" UI** across every `@qlik-coe-emea/qlabs-components-*` package.
brand-ui is a **presentation layer** (D5 — `docs/DECISIONS.md` §D5): it does NOT own
model calls, transport, or React Suspense. Loading is **prop-driven only** — a parent
that knows the data state passes a prop; a component never starts a fetch or reads
`use()`/Suspense to discover it is loading.

The failure this rule fixes: the not-ready signal was named 3+ ways (`loading`,
`isStreaming`, `status="loading"`, `kind="loading"`) and several surfaces had **no**
placeholder at all (error boxes flashed on incomplete input, images popped in with CLS).
This rule makes the vocabulary authoritative.

## The two signals (orthogonal — a component may support one or both)

| Signal                      | Means                                            | Renders                                                                                                                     |
| --------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **`loading?: boolean`**     | "no renderable content yet" (fetch-then-show)    | a **layout-shaped skeleton** that mirrors the real layout (skeleton rows, aspect boxes, blocks)                             |
| **`isStreaming?: boolean`** | "partial content is arriving incrementally" (AI) | render **progressively / build up**, **suppress transient parse/validation errors**, optional subtle in-progress affordance |

They are **orthogonal**, not a state machine. `loading` is the binary "do I have ANY
content to show"; `isStreaming` is "is the content I'm showing still growing". A streaming
AI surface is typically `loading=false, isStreaming=true` (it already has partial content).
A table waiting on its first page is `loading=true`. A component that streams from empty
may briefly be both — render the skeleton (`loading`) until the first token, then build up
(`isStreaming`).

### When each applies

- **`loading`** — anything fetch-then-show: tables, image grids/tiles, cards, KPIs, charts
  before data, any panel whose content arrives in one settled chunk. Canonical.
- **`isStreaming`** — AI/agent output that grows token-by-token: reasoning, plans,
  terminals, streamed markdown, JSX previews. Canonical.

### Error rule (the flash bug, generalized)

**Error slots fire ONLY on terminal, settled failures — never while `loading`,
`isStreaming`, or for syntactically incomplete input.** A half-arrived tag, a partial
JSON chunk, or a row that hasn't loaded is **not** an error. Suppress parse/validation
errors while not-ready; surface them only once the input is settled AND actually invalid.

## Reconciliation with shipped vocabulary (NO breaking renames)

The two signals above are canonical for **new** work and for the named fixes below. Existing
divergent names are **documented aliases** — kept, not migrated, to avoid a breaking sweep:

| Shipped today                                                | Status                      | Rule                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loading: boolean` (DataTable, Gantt)                        | **Canonical** — keep        | already conformant; the reference implementation for skeleton-rows + overlay-spinner.                                                                                                                                                                                                                                                   |
| `isStreaming: boolean` (reasoning/plan/terminal/jsx-preview) | **Canonical** — keep        | already conformant.                                                                                                                                                                                                                                                                                                                     |
| `status="loading"\|"ready"` (area/line chart)                | **Documented alias** — keep | a **richer per-chart variant** of `loading` (charts also model `"ready"`/error spans). NOT migrated. New chart code MAY use it; do NOT add `status` outside charts to mean "loading".                                                                                                                                                   |
| `StatePanel kind="empty"\|"error"\|"loading"`                | **Different role** — keep   | `StatePanel` is the centered **message panel** (icon + title + action), NOT a layout-shaped skeleton. `kind="loading"` is the spinner-message; use it for a whole-region "loading…" panel, use a **Skeleton** for a layout-shaped one. Both are valid; pick by whether you mirror the layout (Skeleton) or show a message (StatePanel). |

**Do not** introduce a fourth name. If a component needs a not-ready prop, it is `loading`
and/or `isStreaming` (or, inside `@qlik-coe-emea/qlabs-components-charts` only, the existing `status` triple).

## Standard "not-ready" slot anatomy

Pick the exposure by component shape (in order of preference):

1. **Internal (prop-driven), for fixed-layout components** — `loading`/`isStreaming` is a
   prop; the component renders its own skeleton internally because it knows its layout (the
   skeleton MUST mirror the real DOM so there is no layout shift). This is the default for
   tables, KPIs, charts, image tiles. Example: `DataTable loading` renders skeleton `<tr>`s.
2. **Compound sub-part, for composable/slotted components** — expose a named placeholder
   part (`XSkeleton`) the consumer places, when the layout is consumer-owned and the
   component can't know its shape (e.g. `JSXPreviewSkeleton`, alongside `JSXPreviewContent`
   and `JSXPreviewError`). The provider's `status`/`loading` decides which part renders.
3. **Caller-supplied node, only when 1 and 2 don't fit** — a `loadingSlot?: ReactNode`
   prop. Last resort; prefer a real skeleton shape over an opaque slot.

### Which primitive for which shape

- **Box / block / row** → `Skeleton` (`@qlik-coe-emea/qlabs-components-ui`) — `animate-pulse rounded-md bg-muted`,
  already `aria-hidden`. Compose width/height: `<Skeleton className="h-4 w-32" />`. Build
  rows, aspect boxes (`<AspectRatio><Skeleton className="size-full" /></AspectRatio>`),
  content blocks from it. **This is the canonical skeleton primitive — do not hand-roll
  `animate-pulse bg-muted` boxes.**
- **Whole-region "loading…" message** (not layout-shaped) → `StatePanel kind="loading"`
  (`@qlik-coe-emea/qlabs-components-ui`) or, inline, `Spinner` (`@qlik-coe-emea/qlabs-components-ui`, `role="status"`).
- **Streaming TEXT affordance** (a shimmering "Thinking…" line) → `Shimmer` (`@qlik-coe-emea/qlabs-components-ai`,
  motion-aware, text-only). Use as the optional in-progress cue for `isStreaming`, NOT as a
  skeleton.
- **Charts** → the chart skeleton utilities (`generate-chart-skeleton-data.ts`,
  `area-chart-loading.tsx` in `@qlik-coe-emea/qlabs-components-charts`); don't rebuild chart skeletons from boxes.

### a11y

- **Layout-shaped skeletons are decorative**: `aria-hidden="true"` (the `Skeleton` primitive
  already sets it). Do NOT give every skeleton box `role="status"` — that floods AT.
- **Announce the state once at the region**: wrap the not-ready region (or place a sibling)
  with a single `role="status" aria-live="polite"` carrying a short label ("Loading…",
  "Generating…"). One live region per region, not per box. `StatePanel kind="loading"` and
  `Spinner` already provide this.
- **Errors** (terminal only) → `role="alert"`.

### CLS / space reservation

- **Reserve the final space.** A skeleton must occupy the same box the real content will —
  reserve image/media boxes with `AspectRatio`, give skeleton rows the row height, size
  skeleton text to the line. Never collapse-then-expand. This is the whole point of a
  _layout-shaped_ skeleton vs a generic spinner.

### Motion-reduce

- Skeleton pulse and shimmer sweeps must respect reduced motion. `Skeleton`'s `animate-pulse`
  is acceptable (opacity only); JS-driven sweeps (`Shimmer`) already gate on `useReducedMotion`.
  Any new animated placeholder gets a `motion-reduce:` neutralizer (see `MOTION_GUIDELINES.md`).

## Primitives (the toolbox — reuse, don't duplicate)

- `Skeleton` — `packages/ui/src/components/skeleton/skeleton.tsx`
- `Spinner` — `packages/ui/src/components/spinner/spinner.tsx`
- `StatePanel` (`kind="empty|error|loading"`) — `packages/ui/src/components/state-panel/state-panel.tsx`
- `Shimmer` (streaming text) — `packages/ai/src/shimmer.tsx`
- Chart skeletons — `packages/charts/src/charts/generate-chart-skeleton-data.ts`,
  `packages/charts/src/charts/area-chart-loading.tsx`

## Enforce / verify

A component that exposes a not-ready prop must SHOW its not-ready state in Storybook, or the
convention is unverifiable. **Gate (`pnpm loading-states:check` — `scripts/check-loading-states.mjs`,
self-tested via `pnpm loading-states:check:test`, wired in CI, #267):** any manifest-listed
component whose public props include a boolean `loading` / `isStreaming`, or the chart-scoped
`status: ChartStatus` alias, must have a story (co-located, or the shared story file a
sub-/child component is exercised from) exercising that state — a story arg/JSX prop defaulting
the signal to its not-ready value, or a named `*Loading`/`*Streaming` export. Pre-existing gaps
are a ratchet baseline (`scripts/loading-states-baseline.json`) — a new `loading`/`isStreaming`/
chart-`status` prop must ship its story; it cannot be silently added to the baseline (ratchets
down only, via `--update`). See @.claude/rules/quality-gates.md ("Enforcement over reminders") —
a convention ships with its teeth.
