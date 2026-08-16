# ai-charts · rendering `@qlik-coe-emea/qlabs-components-charts` inside an AI chat UI

How to put charts into an `@qlik-coe-emea/qlabs-components-ai` chat scenario, and the one new primitive worth
building for it: a **smart, data-driven `AutoChart`** that picks the right chart from
context (data shape / agent intent) — **not** one component per chart type.

> **Status:** design approved (2026-06-08). No code changed yet at the time of writing;
> the build follows [`01-ai-chart-integration-plan.md`](./01-ai-chart-integration-plan.md).

## Opinion up front (the verdict)

**Build one thing: `AutoChart` + a serializable `ChartSpec`, in `@qlik-coe-emea/qlabs-components-charts`.**
Everything else the request implied is already solved by the existing system.

The original ask was "an AI chart component that fits into the `@qlik-coe-emea/qlabs-components-ai` bundle,
reusing the existing charts." Investigation showed that framing over-complicates it:

1. **Charts-in-chat already works today, with zero new package code.** The chat
   **app** depends on both `@qlik-coe-emea/qlabs-components-ai` and `@qlik-coe-emea/qlabs-components-charts` (verified: `apps/playground`
   and `apps/docs` both list them) and composes them directly. `@qlik-coe-emea/qlabs-components-ai`'s
   `ToolOutput`/`Artifact` render any React node
   (`packages/ai/src/tool.tsx:132`), so an agent's chart tool-output can be shown in a
   conversation immediately. **Apps compose sibling packages freely.**

2. **`@qlik-coe-emea/qlabs-components-ai` must not import `@qlik-coe-emea/qlabs-components-charts` — but that rule is about package
   internals, not the app.** They are peers in the one-way dependency graph
   (`tokens → ui/icons → {ai, charts, data, flow, …}`); a sideways peer→peer import
   would risk cycles and bundle bloat (visx/d3 dragged into chat-only bundles). The
   rule is **not** an obstacle to this feature — reuse still flows freely _downward_
   onto shared foundations (`@qlik-coe-emea/qlabs-components-charts` already reuses `@qlik-coe-emea/qlabs-components-ui` in ~40 places:
   `packages/charts/src/metric-card/metric-card.tsx:2`). The exact same situation —
   `@qlik-coe-emea/qlabs-components-charts` forbidden from importing sibling `@qlik-coe-emea/qlabs-components-data` — is handled by the
   copy-owned `registry/blocks/chart-frame-data/` block.

3. **Coloring is already consistent.** Both packages share `@qlik-coe-emea/qlabs-components-tokens`
   (`--chart-1..5`, `--foreground`, …), so a chart rendered in a chat inherits theme
   colors by construction. The only caveat is an agent emitting a _raw hex_ color (it
   bypasses tokens) — handled trivially by ignoring raw colors and using the token
   palette.

So the **only genuinely new value** is the smart selector. It is a _chart_ capability,
so it lives in `@qlik-coe-emea/qlabs-components-charts` and is reusable by dashboards/saved-views as well as
chat. The chat app uses it the normal way: `<ToolOutput output={<AutoChart spec={…} />}>`.

This is **Build-with** (the ~99% default per `docs/DECISIONS.md` §D1): the agent emits a
typed, serializable `ChartSpec`; the pre-built `AutoChart` renders it. Agent-emitted
_markup_ would be `JSXPreview`/A2UI — out of scope here.

## What `AutoChart` is

A single `<AutoChart spec={ChartSpec} />` that maps a declarative, JSON-serializable
spec onto the right existing `@qlik-coe-emea/qlabs-components-charts` container, inferring the chart type from
the data when `spec.type` is omitted. v1 covers the **Core 7**: line, area, bar
(grouped + stacked), pie/donut, scatter, radar, funnel. Unsupported types degrade to a
graceful fallback (never throws). Full spec, the `renderChart` mapping, the
`inferChartType` heuristic, the in-chat demo, risks, and the verification/gate plan are
in [`01-ai-chart-integration-plan.md`](./01-ai-chart-integration-plan.md).

## Index

- [`01-ai-chart-integration-plan.md`](./01-ai-chart-integration-plan.md) — the full
  design + build/verification plan.

## Key references (verified)

- `packages/ai/src/tool.tsx:122-156` — `ToolOutput` renders any React node passed as
  `output` (the zero-code chat seam).
- `packages/charts/src/index.ts` — the charts barrel (no auto/smart selector exists
  today; `AutoChart` is net-new).
- `packages/charts/src/charts/chart-context.tsx` — `defaultScatterColors` =
  `["var(--chart-1)" … "var(--chart-5)"]` (reused for palette cycling).
- `registry/blocks/chart-frame-data/chart-frame-data-block.tsx` — precedent for
  composing two sibling packages in a copy-owned block (optional `ai-chart` block).
- `docs/DECISIONS.md` §D1/§D5 · `.claude/rules/chart-components.md` (charts → ui only).
