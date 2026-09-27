---
id: RM-201
title: "Bar, Scatter and Candlestick on shared shell hooks; DensityScatter axes on the shared primitives"
status: done
priority: P2
effort: L (4 days)
wave: 6
depends_on: [RM-182, RM-185, RM-188]
blocks: []
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/charts/time-series-chart-shell.tsx (scale, axis, navigator and phase hooks extracted)
  - packages/charts/src/charts/use-chart-phase-orchestrator.ts (called by Bar, Scatter and Candlestick)
  - packages/charts/src/charts/bar-chart.tsx (local `isPostOverlayComponent` without ChartBrush :604-617 goes; hit-test `groupGap` reads the `Bar` prop, :1386 / :1433; own reveal timer :1331-1349 goes)
  - packages/charts/src/charts/scatter-chart-shell.tsx, use-scatter-chart-interaction.ts, use-chart-interaction.ts (one interaction hook)
  - packages/charts/src/charts/candlestick-chart.tsx (local `isDefsComponent` :248-261 and reveal timer go)
  - packages/charts/src/charts/density-scatter/density-scatter-chart.tsx (axes on the shared x / y axis primitives)
  - .changeset/*.md (minor — internal)
source: docs/review/2026-09-25-charts-unification-review.md F08, F22; ADR 0042 (optional convergence)
---

# RM-201 Bar, Scatter and Candlestick on shared shell hooks; DensityScatter axes on the shared primitives

## Finding

- Only Line, Area and Composed use `TimeSeriesChartInner`, the only caller of `useChartPhaseOrchestrator`. Bar (2136 LOC), Scatter and Candlestick each build their own scales, domains and reveal timers (F08).
- Bar's local `isPostOverlayComponent` omits ChartBrush; Bar's hit-testing hard-codes `groupGap` 4 although `<Bar>` exposes it; `use-scatter-chart-interaction.ts` is a near-copy of `use-chart-interaction.ts`; Candlestick keeps its own `isDefsComponent` (F08).
- DensityScatter's axes are private (F22, F24).

## Change

- Extract the shell's scale, axis, navigator and phase logic into hooks; Bar, Scatter and Candlestick call them. One interaction hook. DensityScatter draws its axes with the shared primitives.

## Acceptance

- Visual baselines unchanged.
- The tree-shake byte budget holds (`check-chart-treeshake.mjs`).
- Charts tests unchanged and green.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm build && node packages/cli/scripts/check-chart-treeshake.mjs`, `pnpm test:stories` on the four families, Chromium light and dark at 380 / 600 / 900 px.

## Outcome

Done 2026-09-27 on `charts/rm-201-shell-hooks` (branched from d21be4dc).

What moved:

- New `charts/cartesian-shell-hooks.ts`, extracted from `time-series-chart-shell.tsx`: `useContainerRevealGate` (the reveal gate with its opt-in viewport ref), `useChartEnterReveal` (the enter reveal timer: `revealEpoch` + `isLoaded`, held and replayed by the gate), `useChartPhaseReport`, `useDateBisector`, `useValueAxisConfigs` (the `YAxis domain`/`scale` requests plus the facet domain) and `useValueAxisWarnings`.
- Callers: the time-series shell (Line, Area, Composed) uses the gate, phase report, bisector, value-axis configs and warnings; Bar uses the gate, enter reveal, phase report, value-axis configs and warnings; Scatter uses the enter reveal, phase report, bisector, value-axis configs and warnings; Candlestick uses the enter reveal and bisector.
- One interaction hook: Scatter now calls `useChartInteraction`; `use-scatter-chart-interaction.ts` (209 LOC) and its only helper `scatter-svg.ts` (22 LOC) are deleted.
- One child classifier: `isPostOverlayComponent` now lives in `chart-defs.ts` (added, `getChartChildComponentName` untouched); the shell, Bar and Scatter import it. Bar's local copy and Candlestick's local `isDefsComponent` are deleted (Candlestick uses `isChartDefsComponent`).

Intended fixes (tests in `bar-chart-shell-hooks.test.tsx`, both verified as real differences on d21be4dc first, both mutation-checked):

- (a) Bar's post-overlay classification includes `ChartBrush`. Removing it from the shared classifier fails 2 tests.
- (b) Bar hit-testing reads each `<Bar groupGap>` (default 4). With `groupGap={12}` the tooltip anchors sat 2.67 px off the painted bars; restoring the hard-coded 4 fails 2 tests.

LOC (package source, tests excluded): 447 removed, 270 added. bar-chart 2195 → 2173, time-series-chart-shell 1888 → 1850, scatter-chart-shell 474 → 457, candlestick-chart 617 → 590 (216 removed, 112 added across the four); `use-scatter-chart-interaction.ts` (209) and `scatter-svg.ts` (22) deleted; `cartesian-shell-hooks.ts` +144, `chart-defs.ts` +14. Plus a 144-line test.

Proof:

- Markup: 173 stories per theme across Bar, Scatter, Candlestick, DensityScatter, Line, Area, Composed, LiveLine, Waterfall and templates-dashboard, light and dark, serialised after settling, base vs head. Identical: Bar 41/41, Scatter 23/23, Candlestick 8/8, Composed 9/9, Waterfall 17/17, templates-dashboard 1/1, DensityScatter 16/16 (after masking its "bin + upload N ms" timing readout), Area 14/15, Line 36/38, LiveLine 1/5 — the same in both themes. Every remaining difference also differs between two runs of the unchanged base: the Loading stories differ only in the moving loading-shimmer clip rect, and LiveLine streams on the wall clock.
- Screenshots: 42 before, 42 after (Bar, Scatter, Candlestick, Line, Area, Composed, Waterfall Default story × light/dark × 380/600/900), all byte-identical.
- Public API: `dist/index.d.ts` and `dist/test/index.d.ts` byte-identical at base and head.

Deliberately left:

- Scale building stays per family. Bar's band scales, Scatter's padded time/linear x and signed y domain, and Candlestick's slot-padded x and low/high price domain are different maths from the shell's (zero-based y, composed-bar inset, forecast horizon); sharing them would change what is drawn.
- Bar, Scatter and Candlestick do not run `useChartPhaseOrchestrator`: its loading → exit → grid-tween → reveal sequence starts from `isLoaded = true` and ignores a signature change mid-reveal, so adopting it would change the first frames and the replay behaviour. They share the simpler `useChartEnterReveal` instead.
- Navigator: already shared before this item (Candlestick mounts `TimeSeriesNavigatorHost`; Bar uses `useCategoryWindow`/`CategoryNavigatorStrip`), so nothing moved.
- DensityScatter axes: not moved. Its axes are HTML labels over a pan/zoom view with its own 1-2-5 tick stepping; the shared `XAxis`/`YAxis`/`AxisTitle` read the cartesian chart context and draw different markup and tick sets, so any move is a visible change. Needs its own item with a design decision.
- Scatter's touch path now behaves like Line's (no `preventDefault()` on React's passive touch listeners, a tap commits the readout synchronously, the readout re-anchors when the scale changes under a hovering pointer, and `touchcancel` clears it). None of this changes settled markup.
