# interactive-detail-panel · an inline detail panel for `Card`

A small design pack for a **general `Card` feature**: an optional **detail panel** that appears on the
**side or bottom** of any card. Empty detail → it's exactly today's `Card` (zero change). Put content in
the detail slot and the card reveals the panel — either **always** (fixed) or **on hover/focus** (the
main content shrinks within a fixed footprint to unveil it).

> Generalizes the "main + detail" idea from the charts `ChartFrame` expand modal (see
> [`../chart-components/`](../chart-components/)) down to the `Card` primitive — so **any** card (KPI
> tile, content card, chart card) can carry an inline detail. Deliberately its own (small) package;
> it does **not** belong in chart-components.
>
> **This package also carries one co-located decision** (by request): **Lucide as the default icon
> library** — see ["Also in this package"](#also-in-this-package-lucide-as-the-default-icon-library) +
> [`issue-03`](./working-packages/DP-01-interactive-detail-panel/issue-03-lucide-default-icons.md).
>
> **Backlog:** [`working-packages/DP-01-interactive-detail-panel/`](./working-packages/DP-01-interactive-detail-panel/).

## The concept (confirmed)

```
detail empty           detail set, reveal="fixed"        detail set, reveal="hover"
┌────────────────┐     ┌───────────────┬──────────┐     ┌────────────────┐      hover ┌──────────┬─────┐
│                │     │               │          │     │                │  ───────►  │ content  │ det │
│   card content │     │  card content │  detail  │     │   card content │   (content │ (shrunk) │ ail │
│                │     │               │  panel   │     │                │    shrinks)└──────────┴─────┘
└────────────────┘     └───────────────┴──────────┘     └────────────────┘             same outer size
   = normal Card           panel always visible            panel hidden until hover/focus
```

- **Empty = normal card.** When no `detail` is provided, `Card` renders byte-for-byte as it does today
  (a single bordered `<div>`). The feature is invisible until used — nothing existing changes.
- **Placement: `side` | `bottom`.** Side = detail to the right (a vertical panel); bottom = detail
  below (a horizontal strip). The main content keeps its own padding; the detail panel is its own padded
  region with a hairline divider (`border-l` for side, `border-t` for bottom).
- **Reveal: `fixed` | `hover`.**
  - **fixed** — the panel is always shown alongside the content.
  - **hover** — the panel is hidden until the card is **hovered _or_ focused**; revealing it **shrinks
    the main content within the same outer footprint** (the card does not grow, surrounding layout never
    reflows).

## Two decisions taken (so the build doesn't re-litigate them)

1. **Enhance `Card` directly** — the capability lives on `@qlik-coe-emea/qlabs-components-ui` `Card` (new optional props +
   internal regions), not a separate primitive or a parallel `DetailCard`. `ChartFrame` (charts) reuses
   this Card capability rather than carrying its own. _(Per your choice; aligns with "a general feature
   of a card.")_
2. **Hover = fixed footprint, content shrinks** — on hover/focus the outer card size is constant; the
   main region yields space to the panel. No reflow of the surrounding grid. _(Per your choice.)_

## Proposed API (additive to the existing `Card`)

Grounded on the current `packages/ui/src/components/card/card.tsx` (`cva` `cardVariants` with an
`interactive` variant; `CardHeader/Content/Footer` stay unchanged). New **optional** props:

| Prop              | Type                 | Default                              | Behavior                                                                                  |
| ----------------- | -------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `detail`          | `ReactNode`          | `undefined`                          | Panel content. **Undefined → normal card** (no panel, no grid, no behavior change).       |
| `detailPlacement` | `"side" \| "bottom"` | `"side"`                             | Which edge the panel sits on.                                                             |
| `detailReveal`    | `"fixed" \| "hover"` | `"fixed"`                            | Always-shown vs. reveal-on-hover/focus. Default is the accessible one; `hover` is opt-in. |
| `detailSize`      | `string` (CSS track) | `"16rem"` (side) / `"auto"` (bottom) | Panel track size (e.g. `"240px"`, `"40%"`).                                               |

`detailPlacement`/`detailReveal` become `cva` variants; `detailSize` drives the grid track via a CSS var
(no inline raw color, token-backed spacing). `interactive` keeps working alongside.

Example:

```tsx
// supplementary detail, revealed on hover (content shrinks, card stays same size)
<Card detail={<Sparkline …/>} detailPlacement="side" detailReveal="hover">
  <CardHeader><CardTitle>MRR</CardTitle></CardHeader>
  <CardContent>€48.2k</CardContent>
</Card>

// essential detail, always shown at the bottom
<Card detail={<RecentActivity …/>} detailPlacement="bottom" detailReveal="fixed">
  …
</Card>
```

## How "fixed footprint, content shrinks" works (and the honest trade-off)

When `detail` is set the card root becomes a **CSS grid** with two regions (main + panel). Sizing:

- **fixed:** `grid-template-columns: minmax(0,1fr) var(--card-detail-size)` (side) / rows (bottom).
- **hover:** the panel track animates `0` → `var(--card-detail-size)` on `:hover`/`:focus-within`; the
  main region is `min-w-0 overflow-hidden` so it gives up the space cleanly. Outer size is unchanged.

**Trade-off (called out, not hidden):** a true "content shrinks within a fixed footprint" reveal must
animate a **layout size** (the grid track), which is _not_ the GPU-only `transform`/`opacity` path the
[motion guidelines](../../docs/MOTION_GUIDELINES.md) prefer. For a single card hover this is fine; in a
**very dense grid of many cards**, prefer `reveal="fixed"` (no animation) or accept a slightly heavier
hover. The transition is **tokened** (`duration-base ease-standard`) and **snaps instantly under
`prefers-reduced-motion`** (`motion-reduce:` neutralizer), following the existing `interactive`-variant
pattern in `cardVariants`.

## Accessibility (the part hover-reveal usually gets wrong)

- **Reveal on hover _and_ focus-within** — keyboard users tabbing into the card (or its detail) must get
  the same reveal as mouse hover. `hover`-only is not acceptable.
- **Keyboard + touch parity** — touch devices have no hover. The detail content stays **in the DOM**
  (visually clipped, not `display:none`) so assistive tech can always reach it; for touch-first surfaces
  recommend `reveal="fixed"` (or an explicit disclosure toggle, future option).
- **Don't hide essential information behind hover.** `reveal="hover"` is for **supplementary** detail;
  anything a user must see uses `reveal="fixed"`. (Document this in the prop JSDoc.)
- **Focus is never hidden** — revealing/​hiding must not strand focus on an invisible control; interactive
  detail content is reachable and visible while focused.

## Quality bar (same gates as every brand-ui component)

- Semantic tokens only; **theme-safe across all six themes** (qlik-bright, qlik-dark, light, dark,
  blueprint, high-contrast) — observed, not inferred (story screenshots per theme).
- `forwardRef` + `className` + `...props` preserved; new props exported on `CardProps`.
- Tokened motion + `motion-reduce:` neutralizer; AA contrast on the panel + divider in every theme.
- Stories cover: empty (= normal card), side×fixed, side×hover, bottom×fixed, bottom×hover, interactive
  - detail; pass interaction + axe. Smoke tests for the empty→normal-card guarantee and the reveal.

## Relationship to the rest of the program

- **Charts (`ChartFrame`, chart-components/CH-01 issue-07)** is the natural first consumer: a chart KPI
  card with an inline detail panel is exactly this feature. Kept **independent** — neither package blocks
  the other; CH-01 can adopt `Card`'s detail once it lands.
- **Not** `Collapsible`/`HoverCard`/`Reveal` — those exist but solve different problems (vertical
  show/hide, floating popover, entrance animation). This is an **inline, footprint-stable side/bottom
  panel on the card surface**; the build should reference them only to avoid duplication.

## Also in this package: Lucide as the default icon library

A second, independent decision co-located in DP-01 (per request): **`lucide-react` is brand-ui's default
icon library.** Grounded reality — Lucide is **already** the de-facto default (a dependency in
`@qlik-coe-emea/qlabs-components-ui`, `@qlik-coe-emea/qlabs-components-ai`, `@qlik-coe-emea/qlabs-components-icons`, `@qlik-coe-emea/qlabs-components-editor` + both apps; **74 files import it**), so this
**formalizes + cleans up** rather than adopts:

- **The boundary:** **Lucide = general UI/utility icons** (default, reach for it first);
  **`@qlik-coe-emea/qlabs-components-icons` = brand / product-vocabulary icons + `BrandLogo`**; **no third icon library**.
- **Fix the drift:** one `lucide-react` version everywhere (today `@qlik-coe-emea/qlabs-components-ai` is on `^0.577.0` vs
  `^0.469.0` elsewhere).
- **Fix the emphasis:** the `@qlik-coe-emea/qlabs-components-icons` barrel comment currently calls Lucide an "optional fallback" —
  reword to "default for generic UI icons."
- **Enforce, don't remind:** a `.claude/rules/icons.md` + an import-allowlist & version-drift **gate**
  (only `lucide-react` + `@qlik-coe-emea/qlabs-components-icons` allowed) — ties into the self-maintaining-repo gates (WP-10).
- **The plugin sets it for end-users:** the vibe-coder plugin scaffolds Lucide as the default + encodes
  the boundary (greenfield + brownfield).

Full detail: [`issue-03-lucide-default-icons.md`](./working-packages/DP-01-interactive-detail-panel/issue-03-lucide-default-icons.md).

---

_Net-new is small: optional `Card` props + two internal regions, plus the Lucide decision-of-record +
docs/version/gate, plus stories/tests. Design-only — another agent implements from
[`DP-01`](./working-packages/DP-01-interactive-detail-panel/)._
