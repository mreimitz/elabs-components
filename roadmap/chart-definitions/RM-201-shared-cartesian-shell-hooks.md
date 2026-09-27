---
id: RM-201
title: "Bar, Scatter and Candlestick on shared reveal, phase, bisector and value-axis hooks; one interaction hook and one child classifier"
status: done
priority: P2
effort: L (4 days)
wave: 6
depends_on: [RM-182, RM-185, RM-188]
blocks: []
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/charts/cartesian-shell-hooks.ts (new; reveal gate, enter reveal, phase report, bisector, value-axis configs and warnings, extracted from the time-series shell)
  - packages/charts/src/charts/time-series-chart-shell.tsx (calls the extracted hooks; its `isPostOverlayComponent` moved to chart-defs.ts)
  - packages/charts/src/charts/chart-defs.ts (shared `isPostOverlayComponent` added)
  - packages/charts/src/charts/bar-chart.tsx (local `isPostOverlayComponent` without ChartBrush goes; hit-test `groupGap` reads the `Bar` prop; own reveal timer and phase effect go)
  - packages/charts/src/charts/scatter-chart-shell.tsx (shared hooks and `useChartInteraction`; use-scatter-chart-interaction.ts and scatter-svg.ts deleted)
  - packages/charts/src/charts/candlestick-chart.tsx (local `isDefsComponent` and reveal timer go)
  - .changeset/cartesian-shell-hooks.md (patch)
source: docs/review/2026-09-25-charts-unification-review.md F08, F22; ADR 0042 (optional convergence)
---

# RM-201 Bar, Scatter and Candlestick on shared reveal, phase, bisector and value-axis hooks; one interaction hook and one child classifier

## Finding

- Only Line, Area and Composed use `TimeSeriesChartInner`, the only caller of `useChartPhaseOrchestrator`. Bar (2136 LOC), Scatter and Candlestick each build their own scales, domains and reveal timers (F08).
- Bar's local `isPostOverlayComponent` omits ChartBrush; Bar's hit-testing hard-codes `groupGap` 4 although `<Bar>` exposes it; `use-scatter-chart-interaction.ts` is a near-copy of `use-chart-interaction.ts`; Candlestick keeps its own `isDefsComponent` (F08).
- DensityScatter's axes are private (F22, F24).

## Change

- Extract the time-series shell's reveal gate, enter reveal timer, phase report, date bisector and value-axis request/warning logic into `cartesian-shell-hooks.ts`; the shell (Line, Area, Composed), Bar, Scatter and Candlestick call them.
- Scatter uses the shared `useChartInteraction`; its near-copy hook is deleted.
- One post-overlay child classifier in `chart-defs.ts` for the shell, Bar and Scatter; Candlestick uses the shared defs classifier.
- Scale building, the navigator, `useChartPhaseOrchestrator` adoption and DensityScatter's axes are out of scope (see Outcome).

## Acceptance

- Visual baselines unchanged.
- The tree-shake byte budget holds (`check-chart-treeshake.mjs`).
- Charts tests unchanged and green.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm build && node packages/cli/scripts/check-chart-treeshake.mjs`, `pnpm test:stories` on the four families, Chromium light and dark at 380 / 600 / 900 px.

## Outcome

Done 2026-09-27 on `charts/rm-201-shell-hooks` (branched from d21be4dc); review fixes 2026-09-28.

What moved:

- New `charts/cartesian-shell-hooks.ts`, extracted from `time-series-chart-shell.tsx`: `useContainerRevealGate` (the reveal gate with its opt-in viewport ref), `useChartEnterReveal` (the enter reveal timer: `revealEpoch` + `isLoaded`, held and replayed by the gate), `useChartPhaseReport`, `useDateBisector`, `useValueAxisConfigs` (the `YAxis domain`/`scale` requests plus the facet domain) and `useValueAxisWarnings`.
- Callers: the time-series shell (Line, Area, Composed) uses the gate, phase report, bisector, value-axis configs and warnings; Bar uses the gate, enter reveal, phase report, value-axis configs and warnings; Scatter uses the enter reveal, phase report, bisector, value-axis configs and warnings; Candlestick uses the enter reveal and bisector.
- One interaction hook: Scatter now calls `useChartInteraction`; `use-scatter-chart-interaction.ts` (209 LOC) and its only helper `scatter-svg.ts` (22 LOC) are deleted.
- One child classifier: `isPostOverlayComponent` now lives in `chart-defs.ts` (added, `getChartChildComponentName` untouched); the shell, Bar and Scatter import it. Bar's local copy and Candlestick's local `isDefsComponent` are deleted (Candlestick uses `isChartDefsComponent`).

Behaviour changes, each with a test and a mutation check (reverting the change fails the test):

1. Bar's post-overlay classification includes `ChartBrush` (`bar-chart-shell-hooks.test.tsx`). Verified as a real difference on d21be4dc. Removing it from the shared classifier fails 2 tests.
2. Bar hit-testing reads each `<Bar groupGap>` (default 4) (`bar-chart-shell-hooks.test.tsx`). With `groupGap={12}` the tooltip anchors sat 2.67 px off the painted bars on d21be4dc; restoring the hard-coded 4 fails 2 tests. It does not model the `comparison` column's `barCrossInset`, as before.
3. Bar's `onPhaseChange` reports `"loading"` once while `status="loading"`; d21be4dc reported it again when the enter timer ended (`bar-chart-reveal.test.tsx`). Restoring the old effect dependencies fails the test with `["loading","loading"]`.
4. Candlestick classifies `<defs>` children with the shared rule, so a raw `@visx/pattern` child such as `PatternCircles` (function name `Circles`) now goes into the svg-root `<defs>` instead of the plot group (`candlestick-chart.test.tsx`). Restoring the old local classifier fails the test.
5. Scatter's touch path is the line chart's (`scatter-chart.test.tsx`): a tap commits the readout synchronously, `preventDefault()` is not called, the readout re-anchors on new data under a resting pointer, and `touchcancel` clears it. Each of the four reverted in the shared hook fails the test.

None of these changes settled markup (see Proof).

LOC (package source, tests excluded): 447 removed, 272 added. bar-chart 2195 → 2175, time-series-chart-shell 1888 → 1850, scatter-chart-shell 474 → 457, candlestick-chart 617 → 590; `use-scatter-chart-interaction.ts` (209) and `scatter-svg.ts` (22) deleted; `cartesian-shell-hooks.ts` +144, `chart-defs.ts` +14. Tests: 253 lines added.

Proof (taken on the first round, before the review-fix tests and the comment edit, which change no source behaviour):

- Markup: 173 stories per theme across Bar, Scatter, Candlestick, DensityScatter, Line, Area, Composed, LiveLine, Waterfall and templates-dashboard, light and dark, serialised after settling, base vs head. Identical: Bar 41/41, Scatter 23/23, Candlestick 8/8, Composed 9/9, Waterfall 17/17, templates-dashboard 1/1, DensityScatter 16/16 (after masking its "bin + upload N ms" timing readout), Area 14/15, Line 36/38, LiveLine 1/5 — the same in both themes. Every remaining difference also differs between two runs of the unchanged base: the Loading stories differ only in the moving loading-shimmer clip rect, and LiveLine streams on the wall clock.
- Screenshots: 42 before, 42 after (Bar, Scatter, Candlestick, Line, Area, Composed, Waterfall Default story × light/dark × 380/600/900), all byte-identical.
- Public API: `dist/index.d.ts` and `dist/test/index.d.ts` byte-identical at base and head.

Not done:

- DensityScatter's axes are NOT on the shared x / y axis primitives. Its axes are HTML labels over a pan/zoom view with its own 1-2-5 tick stepping; the shared `XAxis`/`YAxis`/`AxisTitle` read the cartesian chart context and draw different markup and tick sets, so any move is a visible change. Tracked separately as a follow-up.
- No scale or navigator hooks were extracted. Bar's band scales, Scatter's padded time/linear x and signed y domain, and Candlestick's slot-padded x and low/high price domain are different maths from the shell's (zero-based y, composed-bar inset, forecast horizon); sharing them would change what is drawn. The navigator was already shared before this item (Candlestick mounts `TimeSeriesNavigatorHost`; Bar uses `useCategoryWindow`/`CategoryNavigatorStrip`).
- Bar, Scatter and Candlestick do not run `useChartPhaseOrchestrator`: its loading → exit → grid-tween → reveal sequence starts from `isLoaded = true` and ignores a signature change mid-reveal, so adopting it would change the first frames and the replay behaviour. They share the simpler `useChartEnterReveal` instead.
