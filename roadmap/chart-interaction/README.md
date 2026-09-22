# Roadmap track — Chart analytics, navigator, selection (`charts`)

Source review: `docs/review/2026-09-22-chart-analytics-navigator-selection-plan.md`.
Decision (ADR 0040; track closed 2026-09-23 — outcome in the source review's §Outcome): close three gaps against the associative BI suite, the analytics-pane BI suite and the report-builder BI suite — **statistical reference lines and trend/window/forecast overlays**, a **mini-chart scroll navigator**, and **axis-range / rectangle / lasso selection** — by extending the seams the package already has (`annotations[]`, `xDomain`, `selectionStates`, `onDatapointClick`, `ChartDatapointLayer`) rather than adding a parallel system. Analytics are transforms that feed existing marks; the navigator owns one window model that the time-series shell already understands; selection gestures emit a `SelectionIntent` the parked dashboard core can consume unchanged. Items follow the `roadmap/README.md` format (frontmatter + Finding / Change / Acceptance / Test-gate / Orchestrator notes). Status values: `planned`, `in-progress`, `done`, `dropped` — update the frontmatter and the table together.

Orchestration: `ORCHESTRATOR-PROMPT.md` in this folder is the kickoff prompt. Every item becomes a GitHub issue before work starts; the orchestrator closes issues only on merged, gate-green, **browser-verified** evidence (Chromium, light + dark, 380 / 600 / 900 px, keyboard path exercised). **RM-136 is the decision item — the maintainer confirms ADR 0040 before wave 0 fans out.**

## Items

| ID     | Title                                                                                                                                                       | Wave | Priority | Effort | Depends on | Agent / model                       | Status |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------- | ------ | ---------- | ----------------------------------- | ------ |
| RM-136 | ADR 0040: analytics value union + `analytics[]`, navigator window model, `SelectionIntent` output, confirm modes, keyboard contract                         | 0    | P0       | S      | —          | brand-ui-component-builder / opus   | done   |
| RM-137 | `analytics/` stats core: reference computations, regression models + loess, window reduce, quantile / std-dev / CI, Holt-Winters — pure, golden-tested      | 0    | P0       | M      | 136        | brand-ui-component-builder / opus   | done   |
| RM-138 | `analytics[]` computed lines and bands on every annotation-bearing container + scatter + distribution; `ChartSpec.analytics`; A2UI catalog                  | 1    | P0       | M      | 137        | brand-ui-component-builder / sonnet | done   |
| RM-139 | Trend, window, forecast and error-bar overlays as derived series with legend entry, tooltip row and a11y summary                                            | 1    | P0       | M–L    | 137, 138   | brand-ui-component-builder / opus   | done   |
| RM-140 | `ChartNavigator`: overview strip, time + index window, condensed min/max shadow, wheel / touch, multi-thumb keyboard, `minSpan`, `align`                    | 1    | P0       | L      | 136        | brand-ui-component-builder / opus   | done   |
| RM-141 | Overflow scrolling on category families: `scrollbar` + `maxVisibleItems` on Bar / Composed / Heatmap, both orientations, auto-navigator on long series      | 2    | P1       | M      | 140        | brand-ui-component-builder / sonnet | done   |
| RM-142 | Gesture engine `selection/`: pointer state machine (pointer / range / rect / lasso), containment + overlap hit-testing, visible-only rule, modifiers, touch | 1    | P0       | M–L    | 136        | brand-ui-component-builder / opus   | done   |
| RM-143 | Axis range selection: x and y, editable range bubbles, measure → dimension resolution, multi-thumb keyboard                                                 | 2    | P0       | M      | 142        | brand-ui-component-builder / sonnet | done   |
| RM-144 | Area + lasso selection: rectangle and polygon on points and marks, snap-to-close, keyboard rectangle, canvas-layer parity                                   | 2    | P0       | M      | 142        | brand-ui-component-builder / sonnet | done   |
| RM-145 | Selection chrome + intent: `ChartSelectionToolbar`, `selectionConfirm`, `onSelectionIntent`, provisional paint, linked-charts story on a local driver       | 3    | P0       | M      | 143, 144   | brand-ui-component-builder / opus   | done   |
| RM-146 | Closure: `charts.md` rules, CLI manifest + guidance, A2UI schema regen, `analytics-dashboard` registry block, home chart pages, CHANGELOG, browser sweep    | 3    | P1       | S–M    | all        | brand-ui-docs-writer / sonnet       | done   |

Agent names are the `.claude/agents/brand-ui-*.md` definitions; `model` in each file overrides the agent's default for that item.

## Waves

```
wave 0  ┬ RM-136 ADR 0040 (opus)  ← maintainer confirms the ADR first
        └ RM-137 stats core (opus)        ─ pure TypeScript, no React; starts the day 136 is confirmed
              ▼ merge, full gates once
wave 1  ┬ RM-138 analytics[] lines + bands (sonnet)  ┐
        ├ RM-139 trend / window / forecast (opus)    │ 4 in parallel, disjoint write sets:
        ├ RM-140 ChartNavigator (opus)               │ analytics/ · navigator/ · selection/
        └ RM-142 gesture engine (opus)               ┘
              ▼ merge, full gates, review lane (new furniture: computed lines, strip, provisional paint)
wave 2  ┬ RM-141 overflow scrolling (sonnet)   ← after 140
        ├ RM-143 axis range selection (sonnet) ┐ after 142; 143 and 144 share selection/ but
        └ RM-144 area + lasso (sonnet)         ┘ write different gesture files
              ▼ merge, full gates, review lane at 380 / 600 / 900 with keyboard
wave 3  ┬ RM-145 selection chrome + intent (opus)
        └ RM-146 closure (docs-writer) last
```

Critical path: RM-136 → RM-137 → RM-139 → RM-146 and RM-136 → RM-142 → RM-143 / 144 → RM-145 → RM-146 (≈ 14–16 agent-days). RM-138 is the item to demo first — an average line and a percentile band on the existing River recipes makes the difference visible on the site in a day.

## Definition of done for the track

- Every new prop is in the CLI manifest (`brand-ui docs <component>` shows it) and `pnpm audit --strict` passes on the stories.
- `analytics[]`, `scrollbar`, `selectionConfirm` and `onSelectionIntent` appear in `ChartSpec` / the A2UI charts catalog, and `catalog.generated.ts` is regenerated.
- Keyboard: every gesture has a documented keyboard path, exercised in a play function.
- Themes: verified in the default theme and every shipped brand theme family — no theme-specific code in the library (a theme may only flip defaults through tokens or the frame).
- Real-runtime proof: the orchestrator quotes Storybook interaction-test output and screenshots from Chromium for each item, never only unit tests.
