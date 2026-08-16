# 01 · Charts integration plan — vendor bklit-ui into `@qlik-coe-emea/qlabs-components-charts`

> Part of the **chart-components** pack. The plan to integrate **all of Bklit UI's charts** as native
> `@qlik-coe-emea/qlabs-components-charts` components (the `@qlik-coe-emea/qlabs-components-editor`/`@qlik-coe-emea/qlabs-components-flow` wrap-an-engine pattern). Assessment +
> verdict: [`README.md`](./README.md). Actioned as **CH-01**
> ([`working-packages/CH-01-charts-integration/`](./working-packages/CH-01-charts-integration/)).
> **License is out of scope here** — handled directly with the author; this plan assumes the MIT grant
> is in place.

## Scope (confirmed)

Vendor **everything chart-related** from `@bklitui/ui` into `@qlik-coe-emea/qlabs-components-charts`:

- **All 14 charts:** area, bar, candlestick, choropleth (geo map), composed, funnel, gauge, line,
  live-line (streaming), pie/donut, radar, ring, scatter, sankey.
- **All primitives:** axis (X/Y), grid, legend (+progress/markers/value/label), tooltip
  (box/dot/indicator/content/date-ticker/crosshair), markers, brush, gradients/patterns,
  reveal/loading, per-chart context, the `useChart` hook.
- **The 2 libs:** `utils` (cn etc.) and `chart-utils` (formatters, decimation, y-domain, layout — the
  logic the unit tests cover).
- **The 17 examples** → become the Storybook stories baseline (one per chart) + registry `registry:example`.
- **The 3 blocks** (`stat-card-area/line/choropleth-01`) → registry blocks + the model to modernize the
  existing `MetricCard`/`ChartCard` KPI tiles.

Plus two things that are **built**, not vendored: a **reuse-audit** so no generic primitive we already
own is copied in (Phase 1, step 3), and a **`ChartFrame`** wrapper giving every chart three universal
features — **expand** (large modal, chart-left / detail-right, mirroring `sidebar-02`), **flip-to-table**,
and **download CSV** (Phase 3, spec below).

Engine deps come along (all MIT/free, respects "no paid deps"): `@visx/*`, `d3-*`, `topojson-client`,
`motion`, `@number-flow/react`, `react-use-measure`. **`@base-ui/react` does NOT** (dropped — see below).

## The phases (and build order)

### Phase 0 — Spike (de-risk before committing the full vendor)

Vendor **2 charts end-to-end** (area + choropleth — one simple, one with the heaviest deps: geo +
topojson) into `@qlik-coe-emea/qlabs-components-charts`, wire the token bridge, drop Base UI, add a story, run the six-theme
audit. Confirms the whole pipeline (theming, alpha-dep behavior, AA, story pattern) on a small surface
before doing all 14. **Output:** a go/no-go + a locked pattern.

### Phase 1 — Vendor all 14 + primitives + libs, conform, re-token

1. **Vendor** `@bklitui/ui/src/charts` (+ `lib/utils` + `lib/chart-utils`) into `packages/charts/src/`.
2. **Namespace + cn:** repoint `@/components/charts` / `@/lib/utils` → `@qlik-coe-emea/qlabs-components-charts` +
   `@qlik-coe-emea/qlabs-components-ui/lib/cn`. Keep `'use client'`.
3. **Reuse base primitives — don't re-vendor what we already own (the audit).** For every vendored
   file, if it duplicates a **generic** primitive brand-ui already ships, import the `@qlik-coe-emea/qlabs-components-*` one and
   **delete the copy**. Keep ONLY genuinely chart-specific primitives. Grounded mapping (verified
   against the bklit source + the `@qlik-coe-emea/qlabs-components-ui` barrel — `Card`, `Button`, `Badge`, `Progress`, `Tooltip`,
   `Separator`, `ScrollArea` all already exist):

   | bklit file / import                                                                                                                  | Action                                                                              | brand-ui replacement                                       |
   | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
   | `@base-ui/react/progress` (`legend-progress.tsx`, `chart-legend.tsx`)                                                                | **replace + drop dep**                                                              | `@qlik-coe-emea/qlabs-components-ui` `Progress` (Radix)    |
   | `src/card.tsx` (a create-turbo demo UTM link — not a real card)                                                                      | **delete**                                                                          | `@qlik-coe-emea/qlabs-components-ui` `Card`/`CardHeader`/… |
   | `src/button.tsx` (demo)                                                                                                              | **delete**                                                                          | `@qlik-coe-emea/qlabs-components-ui` `Button`              |
   | examples' `@/components/ui/card`, `@/components/ui/badge`                                                                            | **repoint**                                                                         | `@qlik-coe-emea/qlabs-components-ui` `Card`, `Badge`       |
   | chart **datapoint** tooltips (`tooltip-box/dot/indicator/content`, `sankey-tooltip`, `choropleth-tooltip`, `date-ticker`, crosshair) | **keep** — chart-specific (a positioned SVG readout, NOT the Radix hover `Tooltip`) | —                                                          |
   | axis / grid / legend / markers / brush / gradients / `useChart`                                                                      | **keep** — chart-specific                                                           | —                                                          |

   Rule of thumb (the same call `@qlik-coe-emea/qlabs-components-editor` and `@qlik-coe-emea/qlabs-components-flow` made): reuse the brand **chrome**, keep
   the **engine-specific** parts. Net: `@base-ui/react` gone; **no duplicate Card / Button / Badge /
   Progress** lands in `@qlik-coe-emea/qlabs-components-charts`. A grep gate (issue-06) fails the build if a vendored file
   re-declares a primitive that exists in the `@qlik-coe-emea/qlabs-components-ui` barrel.

4. **Pin the alpha deps:** the `@visx/*` are `4.0.1-alpha.0` — pin exact, or move to **stable visx 3.x**
   where the API matches; validate. (Dropping Base UI removes its alpha.)
5. **Conventions:** PascalCase exports + barrel; add `forwardRef` on the **top-level chart container**
   components (where a DOM ref is meaningful); for the rest, ship a **`.claude/rules/chart-components.md`**
   documenting the charts exceptions (charts configure via typed data/props/children + `useChart`, not
   `cva` variant axes — like `@qlik-coe-emea/qlabs-components-flow`/`@qlik-coe-emea/qlabs-components-editor` have their own rules). Keep the existing
   typed props + JSDoc.

### Phase 2 — Token bridge + stories + six-theme AA (the quality core)

6. **Token bridge** (the key step — spec below): add the `--chart-*` / `--legend-*` alias block to
   `packages/tokens/src/themes.css`; tokenize the ~8 stray hex; extend the data palette.
7. **Stories from examples:** author `*.stories.tsx` per chart, seeded from the 17 bklit examples
   (sample data + composition already there). Pattern locked in
   [`story-pattern/`](./story-pattern/). Cover Default + the chart's key states (loading/empty where
   they apply) + the six theme slugs.
8. **Six-theme AA:** run `brand-ui-audit` (oklch-aware) across all charts × six themes; tune the data
   palette tokens until **body/label text ≥ 4.5:1 and series colors are distinguishable** in every
   theme. This is the main _quality_ task (charts are the hardest thing to keep AA + legible across
   themes). Commit the audit artifact.

### Phase 3 — Chart chrome (the three universal features: expand / flip-to-table / download)

Every chart gets three features — built **once** as a wrapper, not 14 times (spec below).

9. **`ChartFrame` wrapper** — a single `@qlik-coe-emea/qlabs-components-charts` component that wraps any chart and provides the
   toolbar (Expand · Flip-to-table · Download CSV). Reuses `@qlik-coe-emea/qlabs-components-ui` `Dialog`, `SplitPanel`, `Button`,
   `Tooltip`, `Toggle` and `@qlik-coe-emea/qlabs-components-data` `DataTable` — **no new primitives**.
10. **Two small reuse-friendly enablers** (both benefit the whole library, not just charts): add a
    `size` variant (`sm|lg|xl|full`) to `@qlik-coe-emea/qlabs-components-ui` `Dialog` (today `DialogContent` is hardcoded
    `max-w-lg`) for the large expand modal; add a `toCsv()` / `downloadCsv()` helper to **`@qlik-coe-emea/qlabs-components-data`**
    (none exists yet) for the download + any table export. Stories for `ChartFrame` (closed, expanded,
    table-flipped) across the six themes.

### Phase 4 — Blocks, registration, docs

11. **Blocks:** vendor the 3 `stat-card-*` blocks → `registry/`; use them to **modernize
    `MetricCard`/`ChartCard`** (the KPI-tile-with-mini-chart pattern), or keep both and deprecate the
    thin tiles.
12. **Register everywhere (born compliant):** barrel, `brand-ui.manifest.json`, `registry/registry.json`,
    Storybook storySort, and the package list (CLAUDE/AGENTS/PROJECT). Re-run the logic unit tests
    under your Vitest + add a render smoke test per chart.
13. **Docs harvest:** fold bklit's per-chart docs + `useChart` + theming into the **manifest/context**
    (WP-03) and a **`brand-ui` skill** section, so agents know the new charts and the token surface.

## Token-bridge spec (the heart of "fits the token concept")

bklit's charts already read CSS custom properties; brand-ui already ships `--chart-1..5` per theme. The
bridge is an **alias block** (mostly theme-independent — it points at your per-theme tokens, which
resolve correctly in all six themes). Add to `themes.css` (`:root` + `@theme inline` as needed):

```css
/* chart engine tokens → brand-ui semantic + data palette */
--chart-line-primary: var(--chart-1);
--chart-line-secondary: var(--chart-2);
--chart-grid: var(--border);
--chart-foreground: var(--foreground);
--chart-foreground-muted: var(--muted-foreground);
--chart-background: var(--card);
--chart-crosshair: var(--muted-foreground);
--chart-label: var(--muted-foreground);
--chart-tooltip-foreground: var(--popover-foreground);
--chart-tooltip-muted: var(--muted-foreground);
--chart-segment-line: var(--border);
--chart-segment-background: var(--muted);
--chart-brush-border: var(--border);
--chart-ring-background: var(--muted);
--chart-indicator-color: var(--chart-1);
--chart-marker-background: var(--background);
--chart-marker-border: var(--border);
--chart-marker-foreground: var(--foreground);
--chart-marker-badge-background: var(--primary);
--chart-marker-badge-foreground: var(--primary-foreground);
/* legend */
--legend: var(--foreground);
--legend-foreground: var(--foreground);
--legend-muted-foreground: var(--muted-foreground);
--legend-muted: var(--muted);
--legend-track: var(--muted);
```

Plus: **extend the data palette** beyond `--chart-1..5` to `--chart-1..8` (or 12) in every theme block,
since multi-series charts (composed, radar, sankey) can exceed 5 series — define them in oklch, AA-tuned
(Phase 2). Replace the ~8 raw hex in the vendored source with the relevant token. Net: **no raw hex in
`@qlik-coe-emea/qlabs-components-charts`; one alias block; six themes inherited for free.**

## Chart-chrome spec — the three universal features (`ChartFrame`)

**Model: one wrapper, every chart — not a feature re-implemented 14 times.** This is the systemic call
(per `.claude/rules/conceptual-framing.md`: prefer a systemic solution every consumer gets for free over
additive opt-in parts). A single **`ChartFrame`** owns the toolbar + the three behaviours; you wrap any
chart and it inherits them:

```tsx
<ChartFrame
  title="Revenue by month"
  description="Trailing 12 months, EUR"
  data={rows}                       // base rows → table + CSV (or auto-read from useChart, see below)
  columns={cols}                    // optional ColumnDef[]; auto-derived from series keys if omitted
  detail={<SeriesLegend …/>}        // optional right-panel content (defaults to legend + summary)
  features={["expand", "table", "download"]}   // all three on by default
>
  <AreaChart series={rows}> … </AreaChart>
</ChartFrame>
```

**Where the data comes from.** The vendored charts already expose their resolved series via the
`useChart` context. `ChartFrame` reads rows from that context by default, with an explicit
`data`/`columns` escape hatch for full control — so the common case is just _wrap the chart_, and the
table + CSV stay in sync with what's plotted. Agent-legible (an explicit prop) but low-friction.

### ① Expand — large modal, chart-left / detail-right (mirrors `sidebar-02`)

Opens a large **`@qlik-coe-emea/qlabs-components-ui` `Dialog`** (`size="xl"`/`"full"`) whose body is a **`SplitPanel`** — exactly
the two-pane shell of the `Layout/App Shell/Dashboard (sidebar-02)` story you pointed at, **mirrored** so
the nav-sidebar role becomes the right-hand **detail panel**:

| `sidebar-02` (dashboard)       | →   | `ChartFrame` expand modal                                                            |
| ------------------------------ | --- | ------------------------------------------------------------------------------------ |
| `SidebarProvider` + flex row   | →   | `Dialog` (size `xl`/`full`)                                                          |
| `DashboardSidebar` (left)      | →   | **detail panel — moved to the RIGHT** (`SplitPanel.end`)                             |
| `SidebarInset` content (right) | →   | **chart canvas — the main area on the LEFT** (`SplitPanel.start`, `startSize="1fr"`) |

So: `<SplitPanel start={<chart canvas, enlarged />} end={<detail panel />} startSize="1fr" />`. The
detail panel (`detail` prop) defaults to title + description + the series legend + quick summary stats;
flip-to-table and download are available inside the modal too. `Dialog` already gives focus-trap +
`Esc` + scrim for free (Radix) — no custom modal.

### ② Flip to table — base data as a flat table

A `@qlik-coe-emea/qlabs-components-ui` `Toggle` in the toolbar swaps the chart canvas for the **`@qlik-coe-emea/qlabs-components-data` `DataTable`** of the
underlying rows (`ColumnDef`s auto-derived from the series keys, or supplied via `columns`). Reuses the
existing TanStack table — sorting/zebra/scroll/empty-state all come with it. Works both inline and inside
the expand modal (where the table simply renders in the `SplitPanel.start` pane).

### ③ Download — CSV of the same rows

A toolbar button calls a new **`downloadCsv(rows, { filename, columns })`** helper (added to
`@qlik-coe-emea/qlabs-components-data` — none exists today; it belongs next to `DataTable`). Exports the exact rows the table
shows, so "flip to table" and "download" are the same data.

**Everything here is reuse.** Net-new is small and shared: the `ChartFrame` wrapper itself, a `size`
variant on `Dialog`, and the `toCsv`/`downloadCsv` helper — both enablers benefit the whole library.
`ChartFrame` gets its own stories (closed / expanded / table-flipped) verified across the six themes.

## Closing the gaps (from the assessment) — recap, all in the plan

| Gap                            | Closure                                                                                                                  | Phase |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----- |
| No `forwardRef`                | add on chart containers; document a charts rule for the rest                                                             | 1     |
| No `cva`                       | correct for charts (typed props/children) — documented exception                                                         | 1     |
| No Storybook stories           | author from the 17 examples; six-theme + axe                                                                             | 2     |
| **Duplicated base primitives** | **reuse-audit: Card/Button/Badge/Progress → `@qlik-coe-emea/qlabs-components-ui`; delete copies; drop `@base-ui/react`** | **1** |
| Namespace / cn                 | repoint to `@qlik-coe-emea/qlabs-components-charts` + `@qlik-coe-emea/qlabs-components-ui/lib/cn`                        | 1     |
| Raw hex / theming              | the token-bridge block + tokenize 8 hex + extend palette                                                                 | 2     |
| Six-theme AA                   | `brand-ui-audit` pass + tune; commit artifact                                                                            | 2     |
| Alpha deps                     | pin exact / move to stable visx; Base-UI removal drops one                                                               | 1     |
| **No expand / table / CSV**    | **`ChartFrame` wrapper (Dialog+SplitPanel, DataTable flip, `downloadCsv`)**                                              | **3** |
| Registration/tests             | manifest/registry/storySort/lists + render smoke tests                                                                   | 4     |
| License                        | **out of scope — handled by the maintainer with the author**                                                             | —     |

## Story development (locking the pattern)

I can author all 14 stories; the **17 examples are the baseline** (each already has sample data + the
exact composition). The convention + a real sample (`AreaChart`) are in
[`story-pattern/area-chart.stories.tsx`](./story-pattern/area-chart.stories.tsx). Honest caveat: stories
are **written here as the pattern**, but **running/visual six-theme verification requires the charts
vendored into `@qlik-coe-emea/qlabs-components-charts` + Storybook up** — that's Phase 2 execution, not authoring.

## Relationship to the program

This **is** the implementation of enterprise-gap **WP-05 issue-03 (real charts set)** — and supersedes
its "wrap Recharts / build from scratch" option (bklit is a better base). It feeds **WP-03**
(manifest/context: the charts + `useChart`), **WP-13** (the stat-card blocks modernize `MetricCard`),
and rides the **WP-10** gates. If you want, I'll update WP-05 to point here.

## Build order / handover (for the implementing agent)

**Phase 0 spike → Phase 1 (vendor + conform + reuse-audit) → Phase 2 (token bridge + stories + AA) →
Phase 3 (chart chrome: `ChartFrame` expand/flip/download) → Phase 4 (blocks + register + docs).** Each
phase is shippable; charts stay an **opt-in package** (`@qlik-coe-emea/qlabs-components-charts` is separate — bundle weight
contained). Confirm the visx alpha-pin decision and the `forwardRef`/charts-rule choice in Phase 0.
Detailed issues:
[`working-packages/CH-01-charts-integration/`](./working-packages/CH-01-charts-integration/).

---

_Source: local analysis of `~/Downloads/bklit-ui-main`. Engine: visx (MIT). Pattern precedent:
`@qlik-coe-emea/qlabs-components-editor` (Monaco), `@qlik-coe-emea/qlabs-components-flow` (React Flow)._
