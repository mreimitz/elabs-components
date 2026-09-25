---
id: RM-192
title: "Rename on axis parts: `numTicks` → `tickCount` (old-wins until 6.0), `orientation` → `position`"
status: planned
priority: P1
effort: S–M (1.5 days)
wave: 4
depends_on: [RM-182, RM-188, RM-190]
blocks: [RM-197, RM-205]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/x-axis.tsx (`numTicks` :135, `orientation` :163), y-axis.tsx (`numTicks` :48, `orientation` :41)
  - packages/charts/src/charts/bar-value-axis.tsx (`numTicks` :13; gains `tickCount`), live-x-axis.tsx (`numTicks` :31; gains `tickCount`)
  - packages/charts/src/charts/tick-targets.ts (`resolveAxisTickTarget` keeps old-wins, :70-86)
  - packages/charts/src/multiples/facet-scope.tsx (reads both `orientation` and `position` until 6.0, :73)
  - packages/charts/src/auto-chart/auto-chart.tsx (passes `position`, :577 / :583)
  - packages/charts/src/definitions/parts/ (alias rows 6–11 on the XAxis, YAxis, BarValueAxis and LiveXAxis part definitions)
  - packages/charts/src/charts/axes.stories.tsx (autodocs notes)
  - packages/charts/src/charts/x-axis.test.tsx, y-axis.test.tsx (per-alias tests)
  - .changeset/*.md (minor — `### Deprecated`: axis `numTicks`, `orientation`)
source: docs/review/2026-09-25-charts-unification-review.md F24; ADR 0042 Appendix A.2 (rows 6–11; blocker B3)
---

# RM-192 Rename on axis parts: `numTicks` → `tickCount` (old-wins until 6.0), `orientation` → `position`

## Finding

- XAxis and YAxis accept both `numTicks` and `tickCount`; `numTicks` also lives on BarValueAxis and LiveXAxis. Today an explicit, finite `numTicks` wins over `tickCount` (`tick-targets.ts:70-86`), and `tickCount` is typed `number | "auto"`, wider than `numTicks` (F24).
- The axis side is `orientation` on XAxis and YAxis but `position` on BarValueAxis, LiveYAxis, `AxisSpec` and Dumbbell's value-axis config; `orientation` also means bar direction on BarChart (F24).
- These props live on child primitives, so the rows sit on part definitions (blocker B3). Grid's `numTicksRows` / `numTicksColumns` are not renamed (ADR A.9).

## Change

Ship ADR 0042 Appendix A.2 exactly:

| #   | Component    | Old           | New         | Transform  | Precedence |
| --- | ------------ | ------------- | ----------- | ---------- | ---------- |
| 6   | XAxis        | `numTicks`    | `tickCount` | `identity` | old-wins   |
| 7   | YAxis        | `numTicks`    | `tickCount` | `identity` | old-wins   |
| 8   | BarValueAxis | `numTicks`    | `tickCount` | `identity` | old-wins   |
| 9   | LiveXAxis    | `numTicks`    | `tickCount` | `identity` | old-wins   |
| 10  | XAxis        | `orientation` | `position`  | `identity` | new-wins   |
| 11  | YAxis        | `orientation` | `position`  | `identity` | new-wins   |

- On BarValueAxis and LiveXAxis, `tickCount="auto"` means the part's current default; an unset prop renders unchanged.
- `multiples/facet-scope.tsx:73` reads a YAxis child's props before any alias runs, so it reads both names until 6.0. AutoChart passes `position`.
- The `data-orientation` DOM attribute is not a prop and stays (`axis-title.tsx` reads it).

## Acceptance

- Per-alias test: the old name renders identically to the new one (DOM equal), warns once in dev and never in production, and the test double stays silent under the default `deprecatedProps: "ignore"`.
- Both names given → the row's precedence decides (test).
- `pnpm check --rule charts-deprecated-usage` green: no internal caller, story, doc or template uses an old name.
- Each renamed prop carries `@deprecated` TSDoc naming the replacement, an autodocs note, and a `### Deprecated` bullet in the changeset (`docs/DEPRECATION.md` in full).
- `numTicks` and `tickCount` both given: `numTicks` wins, exactly as `resolveAxisTickTarget` does today (test).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-deprecated-usage,charts-group-drift,chart-default-prose`, `pnpm gen && pnpm gen:check` (the codemod map gains the rows), Storybook autodocs notes checked in Chromium.
