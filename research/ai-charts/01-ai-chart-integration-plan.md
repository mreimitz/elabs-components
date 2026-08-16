# 01 · AutoChart integration plan

The design and build plan for a smart, data-driven chart used inside an AI chat UI.
Overview + rationale: [`README.md`](./README.md).

## 1. Problem & framing

Render `@qlik-coe-emea/qlabs-components-charts` charts inside an `@qlik-coe-emea/qlabs-components-ai` chat scenario, via a single _smart_
component that displays the **right** chart from context — not one component per chart
type.

The honest framing (see README "Opinion up front"):

- Charts-in-chat already works today by **app composition** — the app depends on both
  packages and `@qlik-coe-emea/qlabs-components-ai`'s `ToolOutput`/`Artifact` render any React node
  (`packages/ai/src/tool.tsx:132`). No package needs to import a sibling.
- The one-way dep rule restricts **package internals**, not the app; reuse still flows
  downward onto `@qlik-coe-emea/qlabs-components-ui`/`@qlik-coe-emea/qlabs-components-tokens` (the source of color consistency).
- The only net-new value is the **smart selector**, a _chart_ capability →
  `@qlik-coe-emea/qlabs-components-charts`.

This is **Build-with** (`docs/DECISIONS.md` §D1): the agent emits a typed, serializable
`ChartSpec`; the pre-built `AutoChart` renders it.

## 2. Scope — v1 = Core 7

`line`, `area`, `bar` (grouped + stacked, both orientations), `pie`/`donut`, `scatter`,
`radar`, `funnel`. Deferred (graceful `ChartFallback`): candlestick, sankey, choropleth,
live/streaming, composed, gauge, ring — each needs a non-tabular spec extension.

## 3. `AutoChart` + `ChartSpec` in `@qlik-coe-emea/qlabs-components-charts`

New folder `packages/charts/src/auto-chart/`:

| File                     | Purpose                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `chart-spec.ts`          | Serializable types: `ChartSpec`, `ChartType`, `ChartSeriesSpec`, `ValueFormat` (no functions).     |
| `infer-chart-type.ts`    | `inferChartType(spec)` + `isTemporalField`/`isNumericField`.                                       |
| `auto-chart.tsx`         | `AutoChart` (forwardRef, `cn`, `...props`), internal `renderChart`, `AutoLegend`, `ChartFallback`. |
| `index.ts`               | Folder barrel (own surface only).                                                                  |
| `auto-chart.stories.tsx` | `title: "Charts/AutoChart"`.                                                                       |
| `auto-chart.test.tsx`    | Smoke + heuristic units.                                                                           |

Barrel: add `export * from "./auto-chart";` to `packages/charts/src/index.ts` after the
`./charts` export (barrel add, **not** a subpath). Reuse `defaultScatterColors`
(`["var(--chart-1)" … "var(--chart-5)"]`, `packages/charts/src/charts/chart-context.tsx`)
for palette cycling.

### 3.1 `ChartSpec` (tabular-first — the shape an LLM emits)

```ts
export type ChartType = "line" | "area" | "bar" | "pie" | "scatter" | "radar" | "funnel";
export type ValueFormat = "number" | "compact" | "currency" | "percent";

export interface ChartSeriesSpec {
  key: string; // field in each row holding this series' value
  label?: string; // legend/tooltip label (default: key)
  color?: string; // honored only if a var(--chart-N) token; raw hex ignored
}

export interface ChartSpec {
  type?: ChartType; // optional — inferred when omitted; explicit wins
  data: Record<string, unknown>[]; // flat tabular rows
  x: string; // field for x / category / slice-label
  xType?: "time" | "category" | "number"; // hint → drives date coercion + inference
  series: Array<ChartSeriesSpec | string>; // string === { key }
  title?: string; // also feeds the chart's accessible name
  description?: string; // also feeds the chart's accessible description
  stacked?: boolean; // bar/area
  orientation?: "vertical" | "horizontal"; // bar/funnel
  donut?: boolean; // pie
  legend?: boolean; // default: series.length > 1
  valueFormat?: ValueFormat; // → Intl.NumberFormat internally
}
```

Part-to-whole (pie/funnel) reuse the same shape: `x` = slice label, single `series` =
the value. Radar pivots `series[]` into `metrics` + per-row `values`
(`RadarData`/`RadarMetric`, `packages/charts/src/charts/radar-context.tsx`).

### 3.2 `AutoChart` behaviour

- `const type = spec.type ?? inferChartType(spec)` — explicit type always wins.
- Normalize `series` (string → `{key}`); assign cycling palette colors by index.
- `renderChart(type, …)` switch builds the imperative compound tree per type, e.g.:

  ```tsx
  // line
  <LineChart data={spec.data} xDataKey={spec.x}>
    <Grid horizontal />
    {series.map((s) => <Line key={s.key} dataKey={s.key} stroke={s.color} />)}
    <XAxis /><YAxis /><ChartTooltip />
  </LineChart>

  // bar (grouped/stacked via props)
  <BarChart data={spec.data} xDataKey={spec.x} stacked={spec.stacked} orientation={spec.orientation}>
    <Grid horizontal />
    {series.map((s) => <Bar key={s.key} dataKey={s.key} fill={s.color} lineCap="round" />)}
    <BarXAxis /><ChartTooltip />
  </BarChart>

  // pie / donut — rows → PieData {label,value}
  <PieChart data={pieData} innerRadius={spec.donut ? 80 : 0}>
    {pieData.map((d, i) => <PieSlice key={d.label} index={i} />)}
    {spec.donut ? <PieCenter /> : null}
  </PieChart>
  ```

  Scatter/radar/funnel map their rows to the native container data shapes
  (`Scatter` series; `RadarData`+`metrics`; `FunnelStage[]`).

- **Colors:** cycle the token palette; honor `series[i].color` only when it's a
  `var(--chart-N)` token (raw hex/`url(`/`javascript:` ignored → palette fallback).
- **Dates:** coerce ISO strings → `Date` once, inside `AutoChart` (driven by
  `xType:"time"`), before handing to the time-series containers.
- **a11y:** thread `spec.title → accessibleLabel`, `spec.description → description`
  (charts carry these via `chart-a11y`).
- **Never throws:** empty/malformed data, empty series, unsupported/deferred type →
  `ChartFallback` (token-styled message). A throw inside a chat `ToolOutput` would break
  the conversation.
- **Stays bare** (no built-in `ChartFrame`) — the consumer wraps with
  `ChartFrame`/`Artifact` for expand/flip/download if wanted.

### 3.3 `inferChartType(spec)` (only when `type` omitted; conservative, ordered)

1. temporal `x` (`xType:"time"` or Date/parseable strings) → `line`
2. numeric `x` + single numeric series → `scatter`
3. single positive numeric series, categorical `x`, ≤ 8 rows → `pie`
4. default (categorical `x`, ≥ 1 numeric series) → `bar` (`stacked` decides stacking)

OHLC-key detection is wired but returns `line` in v1 (one-line edit when candlestick
lands — documents the deferral). Every branch returns a v1-supported type, so inference
never yields a fallback.

## 4. Using it in a chat (the "AI" part is just composition)

The app/demo imports both packages and drops `<AutoChart>` into a conversation:

```tsx
import {
  Conversation,
  Message,
  MessageContent,
  Tool,
  ToolHeader,
  ToolContent,
  ToolOutput,
} from "@qlik-coe-emea/qlabs-components-ai";
import { AutoChart, type ChartSpec } from "@qlik-coe-emea/qlabs-components-charts";

// toolPart.output is a ChartSpec the model produced
<ToolOutput output={<AutoChart spec={toolPart.output as ChartSpec} />} errorText={undefined} />;
```

Deliver this as a Storybook demo (`InChatConversation`) proving it across themes.

**Optional** — an `ai-chart` registry block mirroring
`registry/blocks/chart-frame-data/chart-frame-data-block.tsx`
(`dependencies: ["@qlik-coe-emea/qlabs-components-ai","@qlik-coe-emea/qlabs-components-charts"]`, `pnpm registry:validate`, delegated to
`brand-ui-registry-curator`). Discoverability polish, not required for the feature.

## 5. Process routing (structural / public-API change — gates BEFORE integration)

1. **`brand-ui-design-system-architect`** — bless `ChartSpec` + the new barrel export.
2. Build with `/new-component charts AutoChart` (or `brand-ui-component-builder`).
3. `/review-component` + **`brand-ui-accessibility-reviewer`** (title/description → a11y).
4. **`brand-ui-visual-ux-reviewer`** six-theme sweep — required: `AutoChart` spans many
   chart types; token usage ≠ proven theme-safety (observe, don't infer).
5. If the registry block is built: **`brand-ui-registry-curator`** + `pnpm registry:validate`.
6. **Discovery (hard gate):** `pnpm manifest`; update the charts entry in `CLAUDE.md`,
   `PROJECT.md`, `AGENTS.md`, `apps/docs/stories/Introduction.mdx`; add the
   `Charts/AutoChart` group to `apps/docs/.storybook/preview.tsx` `storySort`; update
   `skills/brand-ui/SKILL.md` + `skills/brand-ui-component/SKILL.md`.

## 6. Verification

- `pnpm --filter @qlik-coe-emea/qlabs-components-charts typecheck test lint`.
- **Unit** (`auto-chart.test.tsx`): renders each Core-7 type without throwing (mock
  ResizeObserver as in `packages/charts/src/charts/scatter-chart.test.tsx`);
  `inferChartType` cases; empty-data → fallback; unsupported type → fallback; explicit
  type overrides inference; `className`/ref forwarded.
- **Storybook** (`Charts/AutoChart`): `LineInferred`, `BarGrouped`, `BarStacked`,
  `Donut`, `Scatter`, `Radar`, `Funnel`, `UnsupportedFallback`, `EmptyData`,
  `InChatConversation`. With `pnpm storybook` up: `mcp__storybook__run-story-tests` on
  `charts-autochart--*` (interaction + axe) and `mcp__storybook__preview-stories` across
  all six theme slugs. Fallback: `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook`.
- Full-repo `pnpm typecheck && pnpm lint && pnpm test && pnpm build` before "done".

## 7. Out of scope

- Chart types beyond Core 7 → `ChartFallback` until added.
- Putting any chart code inside `@qlik-coe-emea/qlabs-components-ai` — unnecessary; the app composes the two
  packages and `@qlik-coe-emea/qlabs-components-ai` already renders any node.
- Wiring real model calls — owned by the consuming app (presentation-layer boundary,
  `docs/DECISIONS.md` §D5 / ADR-0007).
