# ADR 0011 — Chart series differentiated by SVG pattern under high decoration

- Status: Accepted
- Date: 2026-06-08

## Context

In the `blueprint` theme (and any region at `--decoration` 8–10) hue is deliberately
removed — the palette collapses to a near-white "drawn" monochrome on navy. Chart
series, which in chromatic themes are told apart by `--chart-1..5` color, became
indistinguishable: two sparklines render as identical faint white lines (#163), and
multi-series bar/area/pie fills wash together (#164, parent). The blueprint policy
already mandated the right encoding — _"Differentiate series by stroke/dash + marker
(or a hatch fill), never by hue"_ ([`.claude/rules/blueprint-decoration.md`](../../.claude/rules/blueprint-decoration.md)) —
but **no mechanism implemented it**: charts consumed a single color string per
series and there was no pattern channel.

A measured WCAG 1.4.11 (graphical objects, ≥3:1) failure on the affected surfaces;
the fix is a design-system feature, not a token bump, so it was routed through
`brand-ui-design-system-architect` before build.

## Decision

**Add a deterministic series→pattern channel — the pattern-domain analogue of the
`--chart-1..5` color ramp — applied automatically under high decoration, gated so
the five chromatic themes are byte-for-byte unchanged.**

- **A shared resolver** (`packages/charts/src/charts/series-pattern.tsx`):
  `seriesPattern(i)` (an 8-entry hatch/dot/grid ramp over orthogonal axes),
  `seriesDashArray(i)` and `seriesMarkerShape(i)` (for stroke series),
  `seriesPatternId(i, scope)` (stable, collision-free ids), `makeSeriesPattern(i,
id, color)` (a **raw `<pattern>`** — see below), and `isPaletteFill(fill)`.
- **The `isPaletteFill` rule (load-bearing correctness):** a series is auto-patterned
  ONLY when its fill is a brand palette token (`var(--chart-*)` or the
  `chartCssVars.linePrimary/secondary` default) AND decoration is high. An author's
  explicit literal/`url()` always wins — automatic patterning never overrides a
  chosen color.
- **Detection** (`use-high-decoration.ts`): `useHighDecoration()` reads the
  registered `@property --decoration` off the chart container via `getComputedStyle`
  (≥8 = high). It works with **no `ThemeProvider`/`DecorationProvider`** (a bare
  `<BarChart>` under `data-theme="blueprint"` is covered), is SSR-safe (ref null →
  `false` → color; `useLayoutEffect` flips pre-paint so there's no color flash), and
  re-reads on `data-theme`/`data-decoration` changes.
- **Per-series wiring:** Bar/Area/Pie inject a raw `<pattern>` def and set
  `fill="url(#…)"`; Line/Area also apply `seriesDashArray` + a `seriesMarkerShape`;
  Scatter differentiates by marker shape. The series **stroke stays a solid color**
  so tooltip dots/swatches (which read `lines[].stroke`) remain legible.
- **#163 closure:** the two sparklines are separate single-series charts, so a
  within-chart index can't separate them. `Line`/`Area` gain an optional
  `seriesIndex?` override (pattern/dash/marker only, not layout); the MetricCard
  `Sparkline` passes distinct indices.
- **Legend** swatches gain an optional `seriesIndex` → an SVG mini-swatch mirroring
  the pattern/dash; the color-dot path is unchanged for color-only legends.
- **No new tokens** — the pattern ink is the series' own resolved color (the
  near-white `--chart-N` under blueprint), so shape carries the differentiation and
  chromatic themes stay inert at decoration < 8.

## The CSS-can't-do-it exception (recorded deliberately)

The blueprint decoration system's guiding principle is _"the theme speaks the visual
language via CSS; components do nothing"_ ([`decoration.css`](../../packages/tokens/src/decoration.css)
supplies the grid, hatch, and drawn-not-filled controls with zero per-component
edits). **This feature is the one documented exception.** SVG `fill="url(#pattern)"`
on `<rect>`/`<path>` series elements cannot be set from CSS — a `<pattern>` def must
exist in the SVG and the element's `fill` attribute must reference it by id. That is
intrinsically JavaScript. So charts must participate via `useHighDecoration()`,
unlike every other blueprint surface. This is honest and unavoidable, not a design
miss.

## Alternatives considered

- **Widen the blueprint `--chart-1..5` lightness ramp (#163's filed proposal).**
  Rejected — single-channel, runs out of contrast headroom on the navy card
  (re-opens #144's dark end), contradicts the "never by hue/lightness-only" policy,
  and still leaves sparklines/bars with no secondary signal.
- **Per-series self-injection with `useId()` defs only / pure shell registry.**
  Rejected as pure forms; adopted a **hybrid** — a shared resolver + per-series raw
  `<pattern>` self-injection with deterministic ids (dedup, single detection point,
  and it accommodates the reality that bar/area/line series color is caller-supplied,
  not index-derived).
- **`useDecoration()` (React context) for detection.** Rejected — it throws outside
  a `ThemeProvider` and wouldn't see a raw `data-theme="blueprint"` / `data-decoration`
  region. `getComputedStyle` on the registered property covers all consumption modes.
- **A new pattern token in `themes.css`.** Rejected — inferable from `--foreground`/
  `--chart-N`; a new token must be set in all themes for zero benefit.

## Consequences

- Under blueprint / high decoration, every covered multi-series chart differentiates
  by pattern/dash/marker automatically, deterministically by index, with no
  per-chart hand-wiring. The five chromatic themes are unchanged (gated at
  decoration < 8).
- **Scope (MVP, this PR):** the mechanism + Bar, Area, Line (incl. sparkline/#163),
  Pie, Scatter, and both legends. **Deferred to a tracked follow-up:** Radar, Funnel,
  Candlestick, Sankey, Choropleth, and ComposedChart `SeriesBar` — they reuse the
  same resolver once wired. Filed at PR time.
- **Brush overlay not unified:** `chart-brush-selection-overlay.tsx` keeps its own
  preset→pattern mapping + portal `<defs>` (it works; unifying risked it). Full
  taxonomy unification is deferred.
- A `themes.css`-adjacent visual change → a three-theme `brand-ui-visual-ux-reviewer` sweep on
  a **real chart screen** is required before merge (Meta #161): blueprint shows
  patterns; the other two render identically to before.
- Revisit trigger: a future "pattern density vs information density" tuning pass
  (dense charts may need coarser patterns to avoid moiré — `blueprint-decoration.md`
  density budget), and the deferred chart types.
