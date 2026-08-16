# chart-components · assessment of bklit-ui as the `@qlik-coe-emea/qlabs-components-charts` bundle

A detailed assessment of **[Bklit UI](https://github.com/bklit/bklit-ui)** (analyzed locally from
`~/Downloads/bklit-ui-main` on 2026-06-06) as the basis for brand-ui's charts — how well it fits, how
well it's built, and what it takes to integrate it as **native** brand-ui components (the same
"wrap-an-engine" pattern as `@qlik-coe-emea/qlabs-components-editor` = Monaco and `@qlik-coe-emea/qlabs-components-flow` = React Flow).

> **You asked me to assess first and come back with an opinion. This is that.** No code has been
> changed; nothing is integrated yet.
>
> **Plan + backlog:** [`01-integration-plan.md`](./01-integration-plan.md) ·
> [`working-packages/CH-01-charts-integration/`](./working-packages/CH-01-charts-integration/) ·
> sample story: [`story-pattern/`](./story-pattern/). **License** is handled separately (maintainer ↔
> author) and is out of scope here.
>
> **Two things are built, not vendored** (per your 2026-06-06 notes): a **reuse-audit** so no primitive
> we already own is copied in, and a **`ChartFrame`** wrapper giving every chart **expand / flip-to-table
> / download-CSV** (the expand modal mirrors the `sidebar-02` layout — chart left, detail panel right).
> See the plan's "Chart-chrome spec" + `working-packages/.../issue-07-chart-chrome.md`.

## Opinion up front (the verdict)

**Adopt it — vendor the chart components into `@qlik-coe-emea/qlabs-components-charts` (source-owned, re-themed to your tokens).
This is the strongest external-adoption candidate I've seen for brand-ui, and the cleanest
"wrap-an-engine" yet.** Three reasons it's almost a drop-in:

1. **Same architecture & stack as brand-ui** — pnpm + Turborepo monorepo, **Tailwind v4**, `cn()` +
   `clsx` + `tailwind-merge`, React 19, `'use client'`-bounded, and a **shadcn registry** for
   copy-own distribution. It even ships `AGENTS.md`, an `llms.txt`, a 157KB `llms-full.txt`, and
   per-component skills — your exact agent-friendliness playbook.
2. **Already token-driven, in oklch** — the charts read **CSS custom properties** (`--chart-*`,
   `--legend-*`, `--foreground`, `--background`, …) that alias to a **`--chart-1..N` palette**
   (`--chart-line-primary: var(--chart-1)`). brand-ui _already defines `--chart-1..5` per theme_, so
   **six-theme support is nearly free** — the integration is mostly a token-name mapping, not a
   re-theme. Only **8 raw hex** in the entire `@bklitui/ui` package.
3. **The engine is visx (headless SVG) — not a black-box chart lib.** There's no opinionated chart
   theme to fight; everything is yours to style with tokens. MIT, free, mature (Airbnb).

**The breadth is exactly "everything you wanted":** 14 chart types incl. the hard ones most libs lack —
**sankey, choropleth (geo maps), candlestick (OHLC), composed (multi-series), gauge, live/streaming
line, radar, funnel, ring/donut** — plus composable axis/grid/legend/tooltip/markers/brush primitives
and a `useChart` hook. This single-handedly closes the WP-05 charts gap and turns `@qlik-coe-emea/qlabs-components-charts` from
**3 KPI tiles into a full enterprise data-viz suite**.

**License:** **out of scope for this assessment/plan** — the maintainer is aligning directly with the
author. (For reference only: the project README declares **MIT** / "Open Source charts… you can
customize and extend.")

**Net:** strong yes. The effort is real but bounded (it's a wrap + re-token + conform-to-conventions +
add-stories job, not a build-from-scratch), and the result is best-in-class charts that bridge both of
brand-ui's worlds (enterprise breadth + agent-legibility).

## What Bklit UI is

- **An open-source (MIT) React chart & data-viz library** built on **visx** (Airbnb's headless SVG
  primitives: `@visx/shape|scale|curve|responsive|event|group|gradient|grid|geo|sankey|brush|zoom|
pattern`) + **d3** primitives (`d3-array|geo|scale|shape|sankey`, `topojson-client` for maps) +
  **Motion** (Framer Motion) for animation + `@number-flow/react` for animated numbers.
- **Two packages that matter to you are distinct:**
  - **`@bklitui/ui`** — _the chart components_ (the integration target). 102 source files under
    `src/charts/` + `src/components/`.
  - **`@bklitui/studio`** — a separate **authoring playground** (tune props, record animations, export
    code/registry JSON; uses Remotion/mediabunny). **Not** an integration target — it's the tool that
    _produces_ charts, analogous to a Figma-for-charts. Ignore it for the bundle.
- **Distributed as a shadcn registry** (`npx shadcn@latest add @bklit/line-chart`; 47 registry items:
  25 components, 17 examples, 3 blocks, 2 libs). Copy-own — exactly brand-ui's model.
- **Docs:** MDX (Fumadocs) per component + a dedicated theming doc + the `llms.txt`/`llms-full.txt`
  wiki + `.agents/skills/` (bklit-playground, chart-performance, wiki-llms-text, shadcn, unit-tests…).
- Tooling: Biome + ultracite (vs brand-ui's ESLint+Prettier), Turborepo, husky, TypeScript, CI.

## Chart inventory — bklit vs brand-ui today

|            | brand-ui `@qlik-coe-emea/qlabs-components-charts` today               | Bklit UI                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Components | 3 (`MetricCard`, `MetricGrid`, `ChartCard` — KPI tiles + a container) | **14 chart types** + composition primitives                                                                                                                     |
| Charts     | **none** (no real chart primitives)                                   | Area, Bar, **Candlestick**, Choropleth (geo map), **Composed**, Funnel, **Gauge**, Line, **Live Line** (streaming), Pie/Donut, Radar, Ring, Scatter, **Sankey** |
| Primitives | —                                                                     | Axis (X/Y), Grid, Legend (+progress/markers), Tooltip (crosshair/dots/date), Markers, Brush, gradients/patterns, `useChart` hook, per-chart context             |
| States     | (uses `@qlik-coe-emea/qlabs-components-ui` states)                    | loading pulses, reveal-clip, hover-dim built in                                                                                                                 |

This is the direct fill for **gap A3** (charts) and **WP-05 issue-03** (real charts set). It also
overlaps the KPI tile concern (its Gauge/Ring/Number-Flow complements your `MetricCard`).

## Build-quality assessment

**Strong.** Evidence:

- **Headless engine (visx) → fully themeable.** No bundled chart skin to override; charts are React +
  SVG you style via tokens. This is _better_ for brand-ui than Recharts/Chart.js (which carry their own
  theme you must fight). MIT/free; no paid deps.
- **Styling stack identical to brand-ui:** `cn()` (33 files), `clsx`, `tailwind-merge`, Tailwind v4.
- **Token-driven theming, oklch:** a coherent `--chart-*` / `--legend-*` semantic set, aliased to
  `--chart-1..N` (`--chart-line-primary: var(--chart-1)`), in oklch — _the same color space and
  mechanism brand-ui uses_. A dedicated `theming.mdx`. Only 8 raw hex in the package.
- **Composable, well-typed API:** e.g. `AreaChart` takes `data`, `xDataKey`, `margin`,
  `animationDuration/Easing`, motion transitions, and **children** (Area, axes, tooltip, legend as
  composable children) — the modern shadcn/Recharts composition idiom, with TS interfaces + JSDoc.
- **Logic is unit-tested:** `charts/__tests__/` covers formatters, time-series decimation, y-domain
  utils, segment layout, animation, etc. — the hard math has tests.
- **RSC-safe:** 108 `'use client'` files (charts are interactive/SVG — correctly client-bounded).
- React 19; peer `react ^18||^19`.

**Gaps / divergences from brand-ui conventions (the conformance work):**

- **No `forwardRef`** (0 files) and **no `cva`** (0 files). brand-ui's component-api rule wants
  `forwardRef` + `cva` variants. For charts this is largely acceptable (React 19 ref-as-prop reduces
  the need; charts configure via data/props/children, not `cva` variant axes) — but to be "native" you
  either add light conformance or **document a charts exception** (as `@qlik-coe-emea/qlabs-components-flow` and `@qlik-coe-emea/qlabs-components-editor`
  already have their own rule files).
- **No Storybook stories** (0) — it docs via MDX/Fumadocs, not Storybook. Integration must **author
  stories** for the six-theme verification + the Storybook-MCP discoverability your system relies on.
- **Ships a few generic primitives we already own** — `@base-ui/react` progress (2 files), plus demo
  `card.tsx`/`button.tsx` and example `card`/`badge` imports. These must **not** be copied in: the
  integration runs a **reuse-audit** that repoints them to `@qlik-coe-emea/qlabs-components-ui` (`Progress`, `Card`, `Button`,
  `Badge`) and deletes the copies, keeping only chart-specific primitives (axes, grid, datapoint
  tooltips, brush…). A grep gate keeps it enforced. (Plan: Phase 1, step 3.)
- **Namespace/cn import:** `@bklitui/ui` + `@/lib/utils` cn — repoint to `@qlik-coe-emea/qlabs-components-charts` +
  `@qlik-coe-emea/qlabs-components-ui/lib/cn` on vendoring.

## Fit assessment — naming, tokens, the wrap-an-engine pattern

- **The wrap-an-engine pattern fits perfectly — and it's the _cleanest_ case yet.** `@qlik-coe-emea/qlabs-components-editor`
  wraps Monaco (needed a custom oklch→hex theme bridge because Monaco is a black box); `@qlik-coe-emea/qlabs-components-flow`
  wraps React Flow. Charts wrap **visx**, which is _already_ React + Tailwind + token-driven — so the
  theme bridge is a **token alias block**, not a runtime color resolver. Less work than the editor.
- **Token concept — near-perfect alignment.** bklit's chart tokens alias to `--chart-1..N`; brand-ui
  already ships `--chart-1..5` per theme (the theming rule mandates it). Integration = add bklit's
  `--chart-*`/`--legend-*` alias block to `packages/tokens/src/themes.css` (mapping to your
  `--chart-1..5` + `--foreground`/`--background`/`--popover`/`--muted-foreground`), and extend
  `--chart-1..5` → a few more if a chart needs >5 series colors. This _improves_ brand-ui's chart
  tokenization (more granular chart tokens) while staying in your system. **No raw hex enters your
  components.**
- **Naming conventions:** kebab-case files (matches), composable compound components (matches your
  Card/compound pattern). Renames: `@bklitui/ui` → `@qlik-coe-emea/qlabs-components-charts`, conform export/barrel names to your
  PascalCase + `xxxVariants` where applicable.
- **Distribution:** both are shadcn registries → the charts slot into your `registry/` and the
  package-vs-registry model with no new mechanism.
- **Agent-legibility (a bonus):** bklit's `llms.txt`/`llms-full.txt` + per-chart skills + the `useChart`
  docs are ready-made fuel for your **manifest enrichment (WP-03)**, **context generator (WP-03/E7)**,
  and **guidance (WP-12)** — i.e. adopting it also advances the agent-friendliness stream.

## Universal chart chrome — expand · flip-to-table · download (built, not vendored)

Beyond vendoring, every chart gets three features through **one** wrapper, **`ChartFrame`** — not a
behaviour re-implemented 14 times (the systemic call per `.claude/rules/conceptual-framing.md`). All of
it composes existing brand primitives:

- **Expand** → a large `@qlik-coe-emea/qlabs-components-ui` `Dialog` whose body is a `SplitPanel`: **chart canvas on the left,
  detail panel on the right** — the exact two-pane shell of the `Layout/App Shell/Dashboard (sidebar-02)`
  block you pointed at, **mirrored** so the sidebar role becomes the right-hand detail panel.
- **Flip to table** → a `Toggle` swaps the canvas for the **`@qlik-coe-emea/qlabs-components-data` `DataTable`** of the chart's
  base rows (reuses the existing TanStack table).
- **Download** → a new **`@qlik-coe-emea/qlabs-components-data` `downloadCsv`** helper exports those same rows as CSV.

Net-new is small and shared: the `ChartFrame` wrapper, a `size` variant on `@qlik-coe-emea/qlabs-components-ui` `Dialog` (today
`max-w-lg` only), and the CSV helper — both enablers benefit the whole library. Full spec in
[`01-integration-plan.md`](./01-integration-plan.md) ("Chart-chrome spec") + backlog item
[`issue-07-chart-chrome.md`](./working-packages/CH-01-charts-integration/issue-07-chart-chrome.md).

## License

**Out of scope** — handled directly between the maintainer and the author; the integration plan assumes
the grant is in place. (For reference only: the project README declares **MIT** / "Open Source… you can
customize and extend"; author bklit / @uixmat.)

## What it takes to integrate (the effort) — wrap-an-engine, ~medium

Same shape as `@qlik-coe-emea/qlabs-components-editor`. Sequenced:

1. **Vendor `@bklitui/ui/src/charts` (+ needed `lib`) into `@qlik-coe-emea/qlabs-components-charts`** — replacing the 3 tiles or
   alongside them; keep the engine deps (`@visx/*`, `d3-*`, `motion`, `@number-flow/react`, Base UI).
   All MIT/free; respects "no paid deps." Retain the MIT license/attribution.
2. **Repoint cn + namespace** — `@/lib/utils` → `@qlik-coe-emea/qlabs-components-ui/lib/cn`; package → `@qlik-coe-emea/qlabs-components-charts`; barrel
   exports in your conventions.
3. **Theme bridge** — add the `--chart-*`/`--legend-*` alias block to `themes.css`, mapping to
   `--chart-1..5` + semantic tokens; extend the chart palette if needed; tokenize the 8 stray hex.
4. **Conform conventions** — PascalCase exports; decide `forwardRef`/`cva` conformance **vs** a
   documented charts rule (`.claude/rules/chart-components.md`, like flow/editor). Keep `'use client'`.
5. **Six-theme + a11y** — author **Storybook stories** per chart; run the `brand-ui-audit` cross-theme
   - contrast pass (the data palette must hit AA in all six themes — this is the main _quality_ task).
6. **Register everywhere** — barrel, `brand-ui.manifest.json`, `registry/`, storySort, the package list
   (CLAUDE/AGENTS/PROJECT) — born compliant under the WP-10 gates.
7. **Harvest the docs** — fold bklit's per-chart docs + `useChart` into your manifest/context (WP-03) +
   a `brand-ui` skill section, so agents know the new charts.
8. **Reconcile tooling** — it uses Biome; you use ESLint/Prettier. Vendoring source means it just
   passes _your_ lint/format (re-run); you don't import their toolchain.

**Effort:** medium (M–L). The components + theming + tests come for free; the work is conforming +
six-theme verification + stories + registration. Far less than building 14 charts from scratch.

**Risks (manageable):** (a) AA contrast of the data palette across six themes — must verify/tune (audit
catches it); (b) `@visx/*` are pinned alpha versions (`4.0.1-alpha.0`) — pin/validate before relying;
(c) Base UI is alpha-ish — isolate or rewire; (d) bundle size — charts are heavy, so keep `@qlik-coe-emea/qlabs-components-charts`
opt-in (it already is a separate package); (e) keep upstream attribution + a note on what was vendored
(so future bklit fixes can be pulled).

## Where this lands in the program

This **is** the implementation of **WP-05 issue-03 (real charts set)** and supersedes the "wrap
Recharts/build from scratch" option there — bklit is a better base. It also feeds the KPI/`MetricCard`
work (its Gauge/Ring) and advances WP-03/WP-12 (its wiki → your manifest/context/guidance). If you
green-light it, I'd write a dedicated **charts working package** (vendor → re-token → conform → stories
→ register → docs) and update WP-05 to point at it.

## What I'd confirm before integrating

- The **MIT grant** is real on the repo (it is per README; add the LICENSE file on vendor).
- The **`@visx/*` alpha pins** are intentional/stable enough (or move to stable visx).
- Whether to **conform `forwardRef`/`cva`** or ship a documented **charts rule** exception.
- Scope: **all 14 charts** now, or a Tier-1 subset (line/area/bar/pie/scatter/radar) first + the
  specialist ones (sankey/choropleth/candlestick/gauge/live) as a second wave.

---

_Source: local analysis of `~/Downloads/bklit-ui-main` (package.json deps, `src/charts/`, `themes`/CSS
vars, `registry.json`, `wiki/llms.txt` + `llms-full.txt`, README). Engine: visx (MIT). Relates to
enterprise-gap WP-05 (hard widgets / charts), WP-03 (manifest/context), WP-10 (gates), and the
`@qlik-coe-emea/qlabs-components-editor`/`@qlik-coe-emea/qlabs-components-flow` wrap-an-engine precedent._
