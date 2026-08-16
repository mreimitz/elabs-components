---
TYPE: epic (tracking issue)
TITLE: "[charts] CH-01 — Integrate Bklit UI charts as native @qlik-coe-emea/qlabs-components-charts (all 14 + primitives + blocks)"
LABELS: type:tech-debt, severity:P1, area:charts, area:tokens, needs-triage
---

## Summary

Vendor **all of Bklit UI's charts** into `@qlik-coe-emea/qlabs-components-charts` as native, token-driven, six-theme-safe
components (the `@qlik-coe-emea/qlabs-components-editor`/`@qlik-coe-emea/qlabs-components-flow` wrap-an-engine pattern; engine = **visx**, MIT). Closes
the charts gap (enterprise-gap A3 / WP-05 issue-03) and turns `@qlik-coe-emea/qlabs-components-charts` from 3 KPI tiles into a
full enterprise data-viz suite. Plan + token-bridge spec: [`../../01-integration-plan.md`](../../01-integration-plan.md);
assessment: [`../../README.md`](../../README.md).

**Scope:** all 14 charts (area, bar, candlestick, choropleth, composed, funnel, gauge, line, live-line,
pie/donut, radar, ring, scatter, sankey) + primitives (axis/grid/legend/tooltip/markers/brush/`useChart`)

- libs (utils, chart-utils) + the 17 examples (→ stories) + the 3 stat-card blocks. Plus, **built** (not
  vendored): a **reuse-audit** (every generic primitive we already own — Card/Button/Badge/Progress — comes
  from `@qlik-coe-emea/qlabs-components-*`; nothing duplicated) and a **`ChartFrame`** wrapper giving every chart three universal
  features — **expand** (large modal, chart-left / detail-right, mirroring the `sidebar-02` layout),
  **flip-to-table**, and **download-CSV**.

**Out of scope:** the license (handled directly with the author — assume the MIT grant is in place);
the bklit `studio` app (a separate authoring tool).

## Why P1

It's the highest-leverage breadth gap for the stated audience (dashboards/data apps), and it's the
cleanest external adoption available — same stack (Tailwind v4, cn/cva, React 19, shadcn registry),
already token-driven in oklch aliasing to `--chart-1..N` (which brand-ui already ships), MIT.

## Child issues

- **issue-01-spike** — Phase 0: vendor **2 charts e2e** (area + choropleth) with the token bridge, Base-UI
  drop, one story, six-theme audit; lock the pattern + the alpha-pin/`forwardRef` decisions. _(P1)_
- **issue-02-vendor-conform** — vendor all 14 + primitives + libs; namespace/cn repoint; **reuse-audit**
  (Card/Button/Badge/Progress → `@qlik-coe-emea/qlabs-components-ui`; delete copies; drop Base UI); pin/validate the `@visx/*`
  alpha deps; conventions + a charts rule. _(P1)_
- **issue-03-token-bridge** — add the `--chart-*`/`--legend-*` alias block to `themes.css`; tokenize the
  ~8 stray hex; extend the data palette to `--chart-1..8+`. _(P1)_
- **issue-04-stories-and-aa** — author `*.stories.tsx` per chart from the 17 examples; run the
  `brand-ui-audit` six-theme contrast pass; tune the palette to AA; commit the artifact. _(P1)_
- **issue-05-blocks-and-metriccard** — vendor the 3 stat-card blocks → `registry/`; modernize
  `MetricCard`/`ChartCard` with the KPI-tile-with-mini-chart pattern. _(P2)_
- **issue-06-register-test-docs** — register everywhere (manifest/registry/storySort/package lists);
  re-run the logic tests + add render smoke tests; wire the **reuse-audit grep gate**; harvest the
  wiki/`useChart` docs into the manifest/context + a `brand-ui` skill section. _(P1)_
- **issue-07-chart-chrome** — **`ChartFrame`** wrapper: **expand** (large `Dialog` + `SplitPanel`,
  chart-left / detail-right, mirroring `sidebar-02`), **flip-to-table** (`@qlik-coe-emea/qlabs-components-data` `DataTable`),
  **download-CSV** (new `@qlik-coe-emea/qlabs-components-data` `downloadCsv` helper) + a `size` variant on `@qlik-coe-emea/qlabs-components-ui` `Dialog`.
  All reuse; one wrapper for all 14. _(P1)_

## Definition of done

- All 14 charts + primitives render as `@qlik-coe-emea/qlabs-components-charts` components, **semantic-tokens-only** (no raw
  hex), **passing six-theme AA** (committed audit), with stories + smoke tests.
- **No duplicated generic primitive** — Card/Button/Badge/Progress come from `@qlik-coe-emea/qlabs-components-ui`; `@base-ui/react`
  removed; the reuse-audit grep gate fails on re-declared primitives. Conventions conformed (forwardRef on
  containers + documented charts rule); alpha deps pinned/validated.
- **Every chart has the three universal features via `ChartFrame`** — expand (chart-left / detail-right,
  `sidebar-02` layout), flip-to-table, download-CSV — built once as a wrapper, verified across six themes.
- The stat-card blocks ship; `MetricCard`/`ChartCard` modernized.
- Registered everywhere (born-compliant under the WP-10 gates); the agent layer (manifest/context/skill)
  knows the charts **and `ChartFrame`**.

## Dependencies

Implements enterprise-gap **WP-05 issue-03**. Benefits from **WP-10** (gates), **WP-02** (the
story/test/six-theme bar), **WP-03** (manifest/context to harvest the docs into). `@qlik-coe-emea/qlabs-components-charts` stays
an opt-in package (bundle weight contained). License resolved out-of-band by the maintainer.
