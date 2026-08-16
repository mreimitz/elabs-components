# story-pattern · the locked Storybook pattern for the charts

A real sample story — [`area-chart.stories.tsx`](./area-chart.stories.tsx) — that locks the convention
for the 14 vendored charts (CH-01 issue-04). Copy its shape for every chart.

## How to derive all 14 (fast)

Each bklit chart ships an **example** at `packages/ui/registry/examples/<chart>.tsx` with real sample
data + the exact composition. The story is that example, re-dressed:

1. Title group `Charts/<Name>`, `tags: ["autodocs"]`, `component: <Chart>`.
2. Import from **`@qlik-coe-emea/qlabs-components-charts`** (after vendoring, CH-01 issue-02).
3. Port the example's `chartData` + composition into the **Default** story.
4. Wrap in a **sized parent** (charts need height) — the shared decorator.
5. Add the chart's **key states** as separate stories: a many-series variant (exercises the
   `--chart-1..N` palette), plus loading/empty where the chart supports them.
6. No raw hex, no inline colors — the chart reads `--chart-*` tokens (CH-01 issue-03).

## What stories do (and don't) prove

- **Author-time (this file):** the API usage, the composition, the data shape, the states.
- **Run-time (execution step, not authoring):** six-theme rendering + axe a11y via
  `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook` and previewing with `globals=theme:<slug>` for
  `qlik-bright · qlik-dark · light · dark · blueprint · high-contrast`. This is where the
  **six-theme AA** of the data palette is verified + tuned (CH-01 issue-04). Stories only run once the
  charts are vendored into `@qlik-coe-emea/qlabs-components-charts` and Storybook is up.

## `ChartFrame` gets its own stories

The expand / flip-to-table / download chrome lives in the **`ChartFrame`** wrapper (CH-01 issue-07), not
in each chart. Give it dedicated stories for its states — **closed**, **expanded** (the `sidebar-02`-style
modal: chart left, detail panel right), and **table-flipped** — verified across the six themes. Per-chart
stories stay focused on the chart itself; show `ChartFrame` once wrapping a representative chart.

See `.claude/rules/storybook-mcp.md` + `.claude/rules/quality-gates.md` for the house story rules.
