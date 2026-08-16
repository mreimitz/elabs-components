---
TYPE: issue
TITLE: "[ui] Card: optional side/bottom detail panel (fixed + hover-reveal at fixed footprint)"
LABELS: type:feature, severity:P2, area:ui, needs-triage
WP: DP-01
---

## Summary

Add an optional **detail panel** to `@qlik-coe-emea/qlabs-components-ui` `Card`. When `detail` is provided, the card shows a
side or bottom panel; `detailReveal` chooses always-on (`fixed`) vs reveal-on-hover/focus (`hover`,
content shrinks within a constant footprint). When `detail` is absent, `Card` renders exactly as today.

## Source

[`../../README.md`](../../README.md) (design, API table, a11y, the fixed-footprint mechanism +
trade-off). Decisions: enhance `Card` directly; hover = fixed footprint, content shrinks.

## Severity & impact

**P2.** Additive enhancement to a core primitive; default leaves every existing `Card` unchanged.

## Proposed solution

In `packages/ui/src/components/card/card.tsx`:

- **Props (all optional)** on `CardProps`:
  - `detail?: ReactNode` — panel content. **Undefined → render today's single `<div>` card** (no grid,
    no panel, no behavior change).
  - `detailPlacement?: "side" | "bottom"` (default `"side"`).
  - `detailReveal?: "fixed" | "hover"` (default `"fixed"` — the accessible default; `hover` opt-in).
  - `detailSize?: string` (default `"16rem"` side / `"auto"` bottom) → drives a `--card-detail-size`
    CSS var on the grid track (token-backed spacing; no raw values).
- **Structure when `detail` is set:** root becomes a CSS grid with two regions —
  `main` (`min-w-0 min-h-0 overflow-hidden`, wraps `children`) and an `aside` detail region (its own
  padding + a hairline divider: `border-l` for side, `border-t` for bottom). Keep `CardHeader/Content/
Footer` usable inside `main` unchanged.
- **Sizing / reveal (extend `cardVariants` with `detailPlacement` + `detailReveal` axes):**
  - `fixed` → `grid-template-columns: minmax(0,1fr) var(--card-detail-size)` (side) /
    `grid-template-rows: minmax(0,1fr) var(--card-detail-size)` (bottom).
  - `hover` → panel track is `0` at rest, animates to `var(--card-detail-size)` on **`hover:` _and_
    `focus-within:`**; `main` is `overflow-hidden` so it yields the space. Outer size constant.
- **Motion (follow the existing `interactive` variant precedent):** tokened
  `transition-[grid-template-columns,grid-template-rows] duration-base ease-standard`; add a
  `motion-reduce:` neutralizer so the reveal **snaps** (no animation) under `prefers-reduced-motion`.
  Document the layout-animation trade-off (prefer `fixed` in very dense grids) in JSDoc.
- **A11y:** reveal on hover **and** `focus-within`; detail stays in the DOM when hidden (clipped, not
  `display:none`) so AT reaches it; JSDoc warns that `hover` is for **supplementary** detail only
  (essential → `fixed`); never strand focus on a hidden control.

## Affected files

- [ ] `packages/ui/src/components/card/card.tsx` (props + `cva` axes + grid regions + motion)
- [ ] `packages/ui/src/components/card/index.ts` (export any new types if added)
- [ ] (none elsewhere — `CardHeader/Content/Footer` unchanged)

## Acceptance criteria

- [ ] `<Card>` with **no `detail`** renders the identical DOM/classes as today (no grid, no panel).
- [ ] `detail` set + `fixed`: panel always visible on the chosen edge (`side`/`bottom`) at `detailSize`.
- [ ] `detail` set + `hover`: panel hidden at rest; revealed on **hover and keyboard focus-within**; the
      main content shrinks while the **outer card size stays constant** (no surrounding reflow).
- [ ] Motion is tokened and **snaps under `prefers-reduced-motion`**; panel + divider meet AA in all six
      themes; no raw hex/arbitrary colors.
- [ ] New props exported on `CardProps`; `forwardRef` + `className` + `...props` + `interactive` intact.

## Test to add

Smoke/interaction tests: (a) empty `detail` ⇒ no panel region in the DOM (the backwards-compat
guarantee); (b) `fixed` ⇒ panel present; (c) `hover` ⇒ panel revealed on `focus-within` (keyboard path),
content region keeps `overflow-hidden`. (Render assertions; jsdom can't measure pixels — visual footprint
is confirmed in the story six-theme pass, issue-02.)

## Risks / ripple effects

- **Layout-animated reveal** isn't the GPU-only path — acceptable for a card hover; note the dense-grid
  caveat. **Card is a heavily-used primitive** — the empty-`detail` no-op path must be exact (lock it
  with the backwards-compat test) so nothing regresses.
- Don't reintroduce behavior that `Collapsible`/`HoverCard`/`Reveal` already cover — this is the inline,
  footprint-stable case only.

## References

- `packages/ui/src/components/card/card.tsx` (current `cardVariants` + `interactive` motion pattern);
  `docs/MOTION_GUIDELINES.md`; `.claude/rules/component-api.md`, `accessibility.md`, `styling-and-tokens.md`,
  `quality-gates.md`. Consumer: chart-components `CH-01 issue-07` (`ChartFrame`).
