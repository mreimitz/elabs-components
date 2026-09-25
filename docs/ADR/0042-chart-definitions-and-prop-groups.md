# ADR 0042 — Chart definitions and prop groups: one definition per chart, on a shared `ui` base

- **Status:** Accepted 2026-09-25
- **Date:** 2026-09-25
- **Deciders:** Manuel Reimitz (maintainer); drafted for RM-162 by the chart-definitions track
- **Context:** [`docs/review/2026-09-25-charts-unification-review.md`](../review/2026-09-25-charts-unification-review.md)
  (39 verified findings, F01–F39, and the concept × chart matrix);
  [`docs/review/2026-09-25-flow-unified-contract-and-yaml-review.md`](../review/2026-09-25-flow-unified-contract-and-yaml-review.md)
  §3 and §5 (the shared base, agreed with the flow track)
- **Issue:** RM-162 (no GitHub issue — the track is tracked in
  [`roadmap/chart-definitions/`](../../roadmap/chart-definitions/) only). Every later item of the
  track, RM-163 to RM-205, builds on it. RM-162..RM-205 and ADR 0042 are reserved; the flow track
  takes numbers after them.
- **Related:** ADR [0006](./0006-subpath-exports.md) (a subpath needs a lighter dependency tree and a
  real consumer), ADR [0007](./0007-presentation-layer-scope-boundary.md) (a definition describes
  props; it never owns data fetching or a runtime), ADR [0013](./0013-manifest-docgen-extraction.md)
  (the docs manifest this ADR feeds), ADR [0039](./0039-chart-responsive-contract.md) (`Responsive<T>`,
  `plotHeight`), ADR [0040](./0040-chart-analytics-navigator-selection.md) (the navigator and
  selection commons registered here by reference), ADR [0041](./0041-media-primitives-in-ui.md) §5
  (the one-minor alias precedent), [`DEPRECATION.md`](../DEPRECATION.md)

## Context

`@elabs-ai/components-charts` has good commons (`Responsive<T>`, the host config, the navigator and
selection props, `useContainerLegend`, the value formatters, `ChartFrame`, `ChartSpec` and the
contract specs), but no layer composes them. Every container declares a flat props interface, and
the same concept takes a different name, shape, unit or default from family to family. The review
verified 39 findings (7 as stated, 32 with corrections, none refuted). The drift that this ADR
settles:

| Concern           | Drift (verified)                                                                           | Finding       |
| ----------------- | ------------------------------------------------------------------------------------------ | ------------- |
| Descriptions      | at least eight hand-kept descriptions of chart types (ChartSpec, A2UI prose, docs, intent) | F03, F15, F39 |
| Legend            | `legend` (11 containers) vs `showLegend` (Heatmap) vs Choropleth's config                  | F04           |
| Loading / empty   | `status` (4 families) vs `loading` (6 components); Heatmap's three `empty*` props          | F11           |
| Labels            | `labels` means value labels, place names or UI words depending on the family; `showValues` | F17           |
| Axes              | `numTicks` + `tickCount` synonyms; `orientation` vs `position`                             | F24           |
| Interaction names | `zoom` / `zoomEnabled` / `zoomable`; four `highlightKey` shapes; `window` as a number      | F21           |
| Data keys         | `xDataKey` vs `x` vs `xKey`; defaults `"date"` vs `"name"`                                 | F15           |
| Motion            | `animationDuration` vs `enterDurationMs`; `revealSignature` vs `motionReplayKey`           | F18           |
| Bar geometry      | `barGap` is a fraction on BarChart and pixels on ComposedChart                             | F14           |
| Docs manifest     | reads only own members, so eight containers restate mixin props on purpose (RM-146)        | F10           |
| Surfaces          | Sparkline `label`, ChartCard `height = 260`, Gantt's own density vocabulary                | F37           |

The flow review reached the same need from the other side: flow nodes and edges also want one
definition per kind, a serializable spec and generated docs. Both packages are layer 2, may not
import each other, and both depend on `ui`.

## Decision

### 1. The maintainer's three decisions (2026-09-25)

1. **One source of truth.** Each chart gets one definition: data targets, defaults and grouped
   properties. The docs manifest, `ChartSpec`/`AutoChart`, the A2UI catalog and the `./test` double
   all read from it. There is no end-user property-panel editor now; a `FormSpec` can be generated
   later.
2. **Rename with aliases.** Names are unified now. Old names keep working, with a one-time
   development warning, for at least one minor, and are removed at **6.0.0**.
3. **A shared definition base in `ui`, built by this plan.** Charts and flow describe component kinds
   the same way. The charts foundation wave builds the base once, and this ADR records it. Flow's
   own ADR covers only `FlowSpec`. Acceptance: the base expresses `BarChart` (data roles) **and**
   `FlowNode` (ports) with no special case.

### 2. Three layers

| Layer                  | Where                                                                    | Holds                                                                                                                                                     | Imports                                       |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1 · ui base            | `@elabs-ai/components-ui/definition` (`packages/ui/src/lib/definition/`) | `definePropGroup`, `field.*`, `ComponentDefinition`, `resolveProps`, `applyAliases`, `warnOnce`, the issue shape, the `header` / `a11y` / `status` groups | nothing React; no engine                      |
| 2 · charts groups      | `packages/charts/src/charts/props/*.ts`                                  | the chart prop groups (§4), each built with `definePropGroup` over today's mixins                                                                         | `import type` from the families; the ui base  |
| 3 · charts definitions | `packages/charts/src/definitions/<id>.definition.ts`                     | one pure definition per **chart**, **part** and **surface** kind (§5)                                                                                     | the groups and the ui base; never a component |

The generators (`generate/json-schema`, `generate/snapshot`) and the completeness helper
(`testing/assert-definition-complete`) are separate modules of the base. No component imports them.

### 3. The ui base

The base is React-free: types, pure helpers and generators. It ships as the
`@elabs-ai/components-ui/definition` subpath because it has a different dependency tree from the
root barrel (no React, no Radix) and two real consumers (charts and flow), which is what ADR 0006
asks of a subpath.

```ts
// @elabs-ai/components-ui/definition — a sketch; RM-170 settles the exact types
interface ComponentDefinition<TProps, TTargets> {
  id: string; // what a document's `type` refers to
  version: number;
  label: string;
  description: string;
  groups: readonly PropGroup[]; // typed modules, never string keys
  fields: FieldMap<TProps>; // own props, same field vocabulary as the groups
  codeOnly?: readonly (keyof TProps & string)[]; // callbacks, ReactNode, render* props
  defaults?: Partial<TProps>; // the kind's overrides of group defaults
  targets: TTargets; // charts: data roles · flow: ports
  normalize?: (props: TProps, ctx: unknown) => TProps; // pure
  aliases?: readonly AliasRow[]; // §8
  migrate?: (props: unknown, fromVersion: number) => unknown;
}

type AppliesWhen = { field: string; equals: unknown } | { field: string; in: readonly unknown[] };
```

- **No `component` on a definition.** The component is bound in a registry (§6). Charts' `./test`
  double may never import an engine, and a consumer that imports one chart must not pull in every
  component.
- **`codeOnly`** lists callback, `ReactNode` and `render*` props by name. They have no field kind,
  the generators skip them, and the completeness test can still prove that every TS prop is a
  field, a group field or `codeOnly`.
- **`appliesWhen` is declarative** (`{ field, equals }` / `{ field, in }`), never a function, so it
  serializes into JSON Schema and maps onto a future `FormSpec`.
- **Field vocabulary:** `string | number | integer | boolean | enum | color | responsive | object |
array`. Each field carries `default`, `min`/`max`, `description`, `tier` (`essential | advanced`),
  `appliesWhen` and `deprecated`.
- **One resolution order:** user prop > the kind's `defaults` > the group default > the theme token.
  `resolveProps(definition, props, ctx)` implements it and is memoized in the component, so render
  code only sees resolved values.
- **One issue shape:** validators never throw and return `{ ok, value, issues }`, where an issue is
  `{ path, code, message }` plus an optional `severity` (`"error"` by default, `"warning"` for a
  `deprecated-prop` issue). This is the shape `SpecPlayground` already renders.
- **`warnOnce`** is the `ui` generalization of `warnChartOnce`; `warnChartOnce` becomes a thin
  wrapper around it.

### 4. The charts prop groups

Each group is `definePropGroup(...)` over an interface that already exists or a new small one. The
existing mixins stay where they are; a group references them and is never a second declaration.
Member names below are the **canonical** names; the renames that reach them are frozen in
Appendix A.

| Group             | Applies to                                                               | Members                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `motion`          | chart kinds that declare they animate                                    | `animationDuration` (ms), `animationEasing`, `enterTransition`, `enterStaggerScale`, `revealSignature`                                                     |
| `frame-size`      | all charts                                                               | `plotHeight` (`Responsive`), `margin` (`number \| Margin`, because Radar takes a number)                                                                   |
| `legend`          | chart kinds that have a legend                                           | `legend` (`boolean \| LegendConfig`; family configs extend it), `legendShowValue`                                                                          |
| `tooltip`         | all charts                                                               | `tooltip`, `tooltipAvoid`                                                                                                                                  |
| `palette`         | all charts                                                               | `palette` (family palettes are `Extract<ChartPalette, …>`), `colorBy`                                                                                      |
| `value-format`    | all charts                                                               | `valueFormat`, `locale`, `currency`, `maxFractionDigits`                                                                                                   |
| `chart-state`     | all chart kinds                                                          | `status` (`"loading" \| "ready"`), `empty` (`{ title?, message?, action? }`)                                                                               |
| `data-labels`     | Bar part, Pie, Ring, Funnel, Waterfall, Treemap, Heatmap, Unit, Dumbbell | `labels`                                                                                                                                                   |
| `axis`            | axis **parts**                                                           | `tickCount` (`number \| "auto"`), `position`, `label`                                                                                                      |
| `series`          | series **parts**                                                         | `dataKey`, `name`, `color`                                                                                                                                 |
| `reference-marks` | cartesian charts                                                         | `referenceLines`, `trendLine`                                                                                                                              |
| `messages`        | all charts                                                               | `messages` (overrides keyed like the existing `charts.*` keys in the ui `LocaleProvider`)                                                                  |
| commons           | per definition, by reference                                             | `ChartInteractionProps`, `ChartSelectionProps`, `ChartNavigatorProps` / `ChartCategoryNavigatorProps`, `ChartSelectionGestureProps`, `ChartAnalyticsProps` |
| `header`, `a11y`  | from `ui`                                                                | `title` / `subtitle` / `description`; `accessibleLabel` / `accessibleDescription`                                                                          |

- Group membership **is** the capability: a family with no `legend` group has no legend.
- The `messages` group adds no second English table. The existing `charts.*` keys are the catalogue.
- `data-labels` lands only after the word-bag `labels` props have moved to `messages` (RM-191), so
  `labels` never means two things at once.

### 5. Definitions: kinds `chart`, `part` and `surface`

`defineChart`, `definePart` and `defineSurface` (in `definitions/define-chart.ts`) are thin charts
helpers on `ComponentDefinition`.

| Kind      | Ids                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `chart`   | the 26 `ChartFamilyName` ids: AreaChart, BarChart, LineChart, ComposedChart, ScatterChart, DensityScatterChart, CandlestickChart, LiveLineChart, PieChart, RingChart, FunnelChart, RadarChart, ChoroplethChart, SankeyChart, Gantt, DumbbellChart, BulletChart, HeatmapChart, UnitChart, TreemapChart, DistributionChart, WaterfallChart, BumpChart, ParallelCoordinatesChart, TreeChart, NetworkChart |
| `part`    | XAxis, YAxis, BarValueAxis, LiveXAxis, Grid, Bar, Line, Area, Scatter, ReferenceLine                                                                                                                                                                                                                                                                                                                   |
| `surface` | Gauge, Sparkline, ChartCard, MetricGrid                                                                                                                                                                                                                                                                                                                                                                |

- **`specTypes[]`**, not a single `type`: one family can serve several `ChartType` values.
  `ChartType` stays hand-written; `definitions/registry.test-d.ts` locks it to the registry, and
  `ChartFamilyName` to the chart-kind ids.
- A chart definition's `targets` and `contract` are its current `CHART_CONTRACT_SPECS` entry, copied
  **verbatim**. The `ChartContractSpec` type moves verbatim into `definitions/contract-types.ts`, and
  `test/contract.ts` re-exports it.
- **Parts carry the child-primitive renames.** No container axis or series props are invented; an
  axis rename lives on the axis part's definition.
- Test-only fixtures (`definitions/__fixtures__/<id>.fixture.ts`) hold minimal valid data per
  definition. They are not shipped.
- Definitions hold structure, not prose. They use top-level `import type` only, and a family imports
  only its own definition.

### 6. Registry and components are separate modules

| Module                      | Holds                                                | Imported by                                             |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| `definitions/registry.ts`   | `CHART_DEFINITIONS`: definitions only, no components | AutoChart, `components.ts`, `src/test/**`, the gen step |
| `definitions/components.ts` | binds each definition id to its component            | AutoChart and the A2UI renderer only                    |

A single-chart import therefore never reaches the registry, the other definitions or AutoChart. The
definitions get **no public subpath** until a real outside consumer exists (ADR 0006).

### 7. The committed snapshot

`packages/cli/scripts/gen-definitions.mjs` runs at dev time (esbuild), as a step placed before
`manifest` in `scripts/gen.mjs`. It writes **`packages/cli/lib/definitions.generated.json`**,
committed and keyed by package, so flow joins the same file instead of adding a second one. It also
writes the codemod map `packages/cli/lib/chart-codemod-map.generated.json` from the alias rows.
TSDoc prose is joined at gen time. The shipped CLI reads the JSON and never bundles; `core.mjs`
never imports esbuild. The existing freshness gate ("Generated artifacts are fresh") covers both
files.

### 8. Rename with aliases: alias rows are data

```ts
type AliasTransform = "identity" | "loading-to-status" | "boolean-to-labels" | "invert-boolean";

interface AliasRow {
  from: string; // the deprecated prop
  to: string; // the canonical prop; a dotted path ("empty.title") writes into an object prop
  transform: AliasTransform; // a closed set: no functions, so rows serialize
  precedence: "new-wins" | "old-wins";
  since: string; // the minor that deprecates it, filled in when the item lands
  removeIn: "6.0.0";
}
```

| Transform           | Maps                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity`          | the value unchanged                                                                                                                            |
| `loading-to-status` | `true` → `"loading"`, `false` → `"ready"`                                                                                                      |
| `boolean-to-labels` | `true` → `true` (labels on, with the family's default label config), `false` → `false`; any other value is a validation issue, never forwarded |
| `invert-boolean`    | `true` → `false`, `false` → `true` (in the closed set for the shared base; no chart row uses it)                                               |

- **Precedence.** `new-wins` (the default): when both names are set, the new name's value is used
  and the warning says the old one was ignored. `old-wins`: the old name's value is used when it is
  set, and only where today's code already lets it win (the `numTicks` rows, see A.2).
- **The shorthand** `aliases: Record<string, string>` in the flow review is accepted and means
  `identity` / `new-wins` rows.
- **The frozen table** is Appendix A. Adoption never adds a temporary name; a change to the table is
  an amendment to this ADR.
- **Every rename item follows [`DEPRECATION.md`](../DEPRECATION.md) in full:** `@deprecated` TSDoc
  naming the replacement, a Storybook autodocs note, a CHANGELOG `### Deprecated` bullet, the alias
  row, and `warnOnce` in development.
- **Internal callers migrate in the same PR** (for example WaterfallChart to BarChart, AutoChart,
  ChartMultiples), so consumers never see warnings for code they did not write.
- **The test double** keeps **both** names in its payload until 6.0, and `configureChartTestDouble`
  gains `deprecatedProps: "ignore" | "warn" | "throw"`.
- **The A2UI catalog** keeps deprecated names with `deprecated: true`, and the validator emits a
  warning-level `deprecated-prop` issue for them until 6.0.
- **The last rename item lands at least one full minor before 6.0.0.** The 6.0 tripwire test is
  scoped to the alias table plus the listed legacy deprecations (`ChartSelection`,
  `ChartBrushLayout`, the `height` aliases and Scatter `trend`), not to every `@deprecated` tag.

### 9. The `status` name rule

On a chart kind, `status` is the loading alias `"loading" | "ready"` (conventions, "Loading &
streaming states"). The shared ui `status` group (a `StatusTone`) is therefore **never applied to a
chart container**. Charts may use the tone group only on surfaces and marks that carry a tone, and
no component takes both meanings. Flow nodes, groups and edges have no loading alias, so on flow
`status` always means the tone. Surfaces and wrappers that are not chart kinds (AutoChart,
ChartFrame, ChartCard, MetricGrid) keep the canonical `loading?: boolean`; no fourth loading alias
is minted.

### 10. What is derived from the registry or the snapshot

| Artifact                            | After                                                                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs manifest (`extractPropTable`)  | a textual `extends` resolver (`Omit<…>`, generics, `.tsx`) plus a join of defaults, kind, group and `deprecated` from the snapshot. The eight RM-146 restatement blocks are deleted after the regenerated prop diff is reviewed |
| Test double (`test/doubles.tsx`)    | `CHART_CONTRACT_SPECS = contractSpecsFromDefinitions(CHART_DEFINITIONS)`; alias normalization keeps both names until 6.0                                                                                                        |
| `ChartSpec` / AutoChart             | `ChartSpec` gains `version: 1`; `validateChartSpec` returns `{ ok, value, issues }`; `assertChartSpecContract` wraps it and still throws                                                                                        |
| A2UI catalog                        | prop names, defaults, enums and a real `Responsive` schema from the snapshot; prose stays in `catalog.source.json`, with a coverage check                                                                                       |
| `chart_for`                         | reads targets plus the joined `@dataShape` / `@avoidWhen` prose; a regression test compares every family before and after                                                                                                       |
| Doc regions (`gen.mjs` genTargets)  | generated defaults and data-shape tables; generated `chart-selection.md` key props                                                                                                                                              |
| Storybook                           | the stories-only `argTypesFromDefinition(def)`                                                                                                                                                                                  |
| Codemod map and 6.0 migration steps | `chart-codemod-map.generated.json` and the CHANGELOG 6.0 steps, both from the alias rows                                                                                                                                        |
| `FormSpec`                          | a test-only spike for BarChart; no editor                                                                                                                                                                                       |

### 11. Gates

- **New `pnpm check` rules** (auto-loaded from `scripts/check/rules/*.mjs`, each with fixtures):
  - `charts-definitions-pure` — the runtime closure of `definitions/**` and `props/**` reaches only
    an allow-list of pure modules; `*.test-d.ts` is exempt;
  - `charts-definition-isolation` — no family imports the registry or another family's definition;
  - `charts-deprecated-usage` — no deprecated name in repo stories, docs, templates or non-test chart
    source;
  - `chart-default-prose` — a documented default matches the definition;
  - `charts-group-drift` — a prop that shares a group key must come from the group (a keys baseline
    that only shrinks);
  - `chart-style-constants` — dash, opacity and duration literals go through shared constants (count
    baseline).
- **CI post-build:** `packages/cli/scripts/check-chart-treeshake.mjs` reads esbuild metafile inputs
  and holds a per-family byte budget. A BarChart-only bundle contains no other definition, no
  registry and no AutoChart. A family over budget splits into `<id>.defaults.ts` (runtime) and
  `<id>.definition.ts` (meta).
- **Existing gates that stay green:** `charts-test-double`, `charts-responsive`, `charts-honesty`,
  `chart-hairline`, `locale-formatting`, `i18n-strings`, `motion-tokens`, `data-slot`,
  `variant-coverage`, `loading-states`, `reference-leakage`, and generated-artifact freshness.
- **Tests:** lockstep type tests, the completeness test, the golden `CHART_CONTRACT_SPECS`, defaults
  parity, registry-loop behaviour tests, one test per alias row (the old name renders identically,
  warns once, and the double stays silent), the 6.0 tripwire, and the visual baselines.

### 12. Coordination with the flow track

These four points refine the flow review's §3.2:

1. `appliesWhen` is declarative (`{ field, equals }` / `{ field, in }`), not a function.
2. `aliases` are data rows with closed transform ids and `precedence`; `Record<string, string>` is
   shorthand for `identity` / `new-wins`.
3. The base ships as the `@elabs-ai/components-ui/definition` subpath; flow's `/spec` core imports it
   from there.
4. The snapshot is `packages/cli/lib/definitions.generated.json`, keyed by package; flow joins it.

### 13. Out of scope

- A property-panel editor and `FieldSpec` extensions (only the test-only spike).
- zod or any runtime schema library.
- The reference chart templates' engine concepts: queries, expressions, soft properties, host
  negotiation and mutating hooks.
- Restructuring the root barrel. No new barrel entries; no public definitions subpath.
- A full translation catalogue.
- 2-D DensityScatter brushing.
- YAML for `ChartSpec`. It comes after flow YAML works (flow Phase 4); `ChartSpec` v1 and the issue
  shape are designed so YAML can wrap them later.

## Options considered

| Option                                             | Verdict                                                                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Document the drift and keep flat props             | rejected — the eight hand-kept descriptions drift again; nothing checks them against each other                   |
| A charts-only definition type                      | rejected by the maintainer (decision 3) — flow needs the same shape, and two bases would drift                    |
| `component` on the definition                      | rejected — the `./test` double would import engines, and one chart import would pull in every component           |
| Function-valued `appliesWhen` and alias transforms | rejected — neither serializes, so JSON Schema, the snapshot, A2UI and the codemod map could not read them         |
| zod (or another runtime schema library)            | rejected — a runtime dependency in every chart bundle for what types and a small field vocabulary already express |
| Hard renames at 6.0 with no aliases                | rejected by the maintainer (decision 2) — consumers get no warning period                                         |
| Rename piecemeal as each family adopts the groups  | rejected — every adoption PR would mint its own names; the table is frozen once, here                             |
| One snapshot per package                           | rejected — flow and charts would each need their own reader; one file keyed by package is joined once             |
| Adopt all 26 families in one PR                    | rejected — too large to review against baselines; adoption runs one cluster per PR                                |

## Consequences

- `ui` gains the `./definition` subpath (RM-170/171), reviewed by `brand-ui-reviewer`.
- Charts gains `charts/props/*` and `definitions/*`; the families adopt them cluster by cluster
  (RM-182..189) with defaults parity and visual baselines as the gate.
- The docs manifest shows inherited props for the first time; the RM-146 restatements go.
- Wave 4 (RM-190..196) deprecates the names in Appendix A in minors. RM-205 removes them at 6.0.0,
  with numbered migration steps and the generated codemod map.
- The flow track builds its node and edge definitions on the same base and joins the same snapshot.

## Watch for

- **A default that moves silently.** Defaults are seeded verbatim; the defaults-parity test and the
  visual baselines gate every adoption PR. The 1100/900/800 entry durations stay as they are.
- **Alias resolution order.** Aliases resolve before any controlled/uncontrolled check (Sankey's
  `isNodeHoverControlled`) and before a family's computed default (Heatmap's `labels` default),
  or either name alone would behave differently.
- **Code that reads child props directly.** `multiples/facet-scope.tsx:73` reads a YAxis child's
  `props.orientation` before any alias runs; it must read both names until 6.0.
- **Dotted `to` paths.** The `empty.*` rows need `applyAliases` to write into an object prop and
  merge per key, so a caller who sets only `empty.message` keeps the default title (RM-170).
- **A required prop behind an alias.** Heatmap's `x`/`y` are required today. While both spellings
  exist, the type must still require one of each pair, so a caller who passes neither still fails to
  compile.
- **A deprecation with no replacement.** `DEPRECATION.md` §2 says a deprecation must name the thing
  to use instead. The two Candlestick members in A.8 never had an effect; their `@deprecated` text
  names the migration ("remove the prop") and RM-196 must say so explicitly.
- **TypeScript cost of 30+ `as const` definitions.** Record `tsc --extendedDiagnostics` before and
  after RM-175/176.

## Maintainer confirmation

- [x] (a) One source of truth: one definition per chart, part and surface kind (2026-09-25).
- [x] (b) Rename with aliases; old names warn once and are removed at 6.0.0 (2026-09-25).
- [x] (c) The shared definition base lives in `ui` and is built by this plan; flow's ADR covers only
      `FlowSpec` (2026-09-25).
- [ ] (d) Review Appendix A before RM-191 starts. It goes beyond the plan's wording in four places:
      Heatmap joins `data-labels`; Choropleth's `emptyTitle`/`emptyMessage` join the `empty` rows;
      Pie/Tree `align` becomes `plotAlign`; `loading` stays on AutoChart, ChartFrame, ChartCard and
      MetricGrid.
- [ ] (e) The 6.0 questions left open in A.9: Scatter's field-name `highlightKey`, Choropleth
      `zoomMin`/`zoomMax` vs Tree `zoomRange`, Composed `barSize`/`maxBarSize`, ChartLegend
      `onHover`, LiveLineChart `numXTicks`, Grid's tick counts, and Funnel `showLabels` next to
      `labels`.

---

## Appendix A — The frozen rename table

Every rename that wave 4 (RM-191..RM-196) performs. Each row was checked against the code on
2026-09-25; "Declared today" is the file and line of the old name, relative to
`packages/charts/src/`. `since` is filled in when the item ships; every row has `removeIn: "6.0.0"`.
Anything looked at and **not** renamed is listed in A.9 with the reason.

**How names were chosen.** (a) The name most families already use; (b) consistency with the prop
groups in §4. Where the two disagree, the row says which won and why.

### A.1 RM-191 — word bags to `messages`; Sparkline `label` to `accessibleLabel`

| #   | Component           | Old      | New               | Transform  | Precedence | Declared today                                         |
| --- | ------------------- | -------- | ----------------- | ---------- | ---------- | ------------------------------------------------------ |
| 1   | BulletChart         | `labels` | `messages`        | `identity` | new-wins   | `charts/bullet-chart.tsx:85`                           |
| 2   | Gauge               | `labels` | `messages`        | `identity` | new-wins   | `charts/gauge.tsx:278`                                 |
| 3   | Sparkline           | `labels` | `messages`        | `identity` | new-wins   | `sparkline/sparkline.tsx:151`                          |
| 4   | DensityScatterChart | `labels` | `messages`        | `identity` | new-wins   | `charts/density-scatter/density-scatter-chart.tsx:244` |
| 5   | Sparkline           | `label`  | `accessibleLabel` | `identity` | new-wins   | `sparkline/sparkline.tsx:90`                           |

- **Why `messages`:** these four objects hold words for the accessible description, tooltips and
  controls, not value labels. `labels` is the `data-labels` group's name (Pie, Ring and Waterfall
  already use it for value labels), so the word bags must move first. The object moves as is; its
  keys are unchanged.
- **Why `accessibleLabel`:** it is the ui `a11y` group's name and is already declared on most chart
  families; Sparkline is the only component that calls its accessible name `label`. The A2UI catalog
  exposes Sparkline `label`; it stays there flagged `deprecated: true` until 6.0.

### A.2 RM-192 — axis parts

| #   | Component    | Old           | New         | Transform  | Precedence | Declared today                 |
| --- | ------------ | ------------- | ----------- | ---------- | ---------- | ------------------------------ |
| 6   | XAxis        | `numTicks`    | `tickCount` | `identity` | old-wins   | `charts/x-axis.tsx:135`        |
| 7   | YAxis        | `numTicks`    | `tickCount` | `identity` | old-wins   | `charts/y-axis.tsx:48`         |
| 8   | BarValueAxis | `numTicks`    | `tickCount` | `identity` | old-wins   | `charts/bar-value-axis.tsx:13` |
| 9   | LiveXAxis    | `numTicks`    | `tickCount` | `identity` | old-wins   | `charts/live-x-axis.tsx:31`    |
| 10  | XAxis        | `orientation` | `position`  | `identity` | new-wins   | `charts/x-axis.tsx:163`        |
| 11  | YAxis        | `orientation` | `position`  | `identity` | new-wins   | `charts/y-axis.tsx:41`         |

- **Why `tickCount`, old-wins:** `tickCount` (`number | "auto"`) is the `axis` group member and
  already exists on XAxis (`:142`) and YAxis (`:53`). `numTicks: number` is a narrowing of it, so
  `identity` is type-safe. Today `resolveAxisTickTarget` (`charts/tick-targets.ts:70-86`) lets an
  explicit, finite `numTicks` win over `tickCount`; `old-wins` keeps exactly that, and a non-finite
  `numTicks` still falls through as it does today.
- **BarValueAxis and LiveXAxis** have no `tickCount` today. On them, `"auto"` means the part's
  current default: 3 ticks below 320 px and 5 above (`charts/bar-value-axis.tsx:40`), and 5
  (`charts/live-x-axis.tsx:55`). An unset prop renders unchanged.
- **Why `position`:** `position` is already the axis side on BarValueAxis (`charts/bar-value-axis.tsx:11`),
  LiveYAxis (`charts/live-y-axis.tsx:83`), the `ChartSpec` `AxisSpec` (`auto-chart/chart-spec.ts:857`)
  and Dumbbell's value-axis config (`charts/dumbbell-chart.tsx:156`) — four uses against two. And
  `orientation` means bar direction on BarChart (`"vertical" | "horizontal"`), so the axis side must
  not share it. Values are unchanged: `"top" | "bottom"` and `"left" | "right"`.
- **Internal callers:** `multiples/facet-scope.tsx:73` reads the YAxis child's `props.orientation`;
  `auto-chart/auto-chart.tsx:577` and `:583` pass `orientation`. Both migrate in the RM-192 PR. The
  `data-orientation` DOM attribute is not a prop and stays, because the selector at
  `charts/axis-title.tsx:118` reads it.

### A.3 RM-193 — `showValues` to `labels`

| #   | Component      | Old          | New      | Transform           | Precedence | Declared today                         |
| --- | -------------- | ------------ | -------- | ------------------- | ---------- | -------------------------------------- |
| 12  | Bar (part)     | `showValues` | `labels` | `identity`          | new-wins   | `charts/bar.tsx:260`                   |
| 13  | FunnelChart    | `showValues` | `labels` | `boolean-to-labels` | new-wins   | `charts/funnel-chart.tsx:71`           |
| 14  | HeatmapChart   | `showValues` | `labels` | `boolean-to-labels` | new-wins   | `charts/heatmap/heatmap-chart.tsx:202` |
| 15  | TreemapChart   | `showValues` | `labels` | `boolean-to-labels` | new-wins   | `charts/treemap/treemap-chart.tsx:141` |
| 16  | WaterfallChart | `showValues` | `labels` | `boolean-to-labels` | new-wins   | `charts/waterfall-chart.tsx:964`       |

- **Why `labels`:** by count `showValues` is more common (these five against `labels` on Pie, Ring
  and Waterfall), but (b) wins: the `data-labels` group names it `labels`, `labels` already carries a
  config object on three families, and a `show*` name holding an object (Bar's `BarShowValues`) is
  the odd shape.
- **Bar part:** the `BarShowValues` type (`charts/bar.tsx:191`) moves as is, so `identity`. The test
  double's check (`test/doubles.tsx:858`) and AutoChart's `<Bar … showValues>`
  (`auto-chart/auto-chart.tsx:1479`) migrate in the same PR.
- **Defaults stay per kind:** Funnel `true` (`charts/funnel-chart.tsx:811`), Treemap `false`
  (`charts/treemap/treemap-chart.tsx:215`), Waterfall `true` (`charts/waterfall-chart.tsx:1062`).
  Heatmap's computed default (`showValues ?? palette === "diverging"`,
  `charts/heatmap/heatmap-chart.tsx:1177`) becomes the kind's normalize step and runs only when both
  names are unset.
- **Waterfall merges the two.** It already has `labels?: WaterfallLabelsConfig` (`:993`), and when
  it is given it overrides `showValues` entirely. `new-wins` keeps that. `labels` widens to
  `boolean | WaterfallLabelsConfig`, where `false` is today's `showValues={false}`.
- **Heatmap** is not in the plan's `data-labels` list; it joins it here because it has `showValues`.

### A.4 RM-194 — legend and state

| #   | Component       | Old            | New             | Transform           | Precedence | Declared today                               |
| --- | --------------- | -------------- | --------------- | ------------------- | ---------- | -------------------------------------------- |
| 17  | HeatmapChart    | `showLegend`   | `legend`        | `identity`          | new-wins   | `charts/heatmap/heatmap-chart.tsx:247`       |
| 18  | HeatmapChart    | `loading`      | `status`        | `loading-to-status` | new-wins   | `charts/heatmap/heatmap-chart.tsx:280`       |
| 19  | Gantt           | `loading`      | `status`        | `loading-to-status` | new-wins   | `gantt/gantt.tsx:744`                        |
| 20  | HeatmapChart    | `emptyTitle`   | `empty.title`   | `identity`          | new-wins   | `charts/heatmap/heatmap-chart.tsx:284`       |
| 21  | HeatmapChart    | `emptyMessage` | `empty.message` | `identity`          | new-wins   | `charts/heatmap/heatmap-chart.tsx:282`       |
| 22  | HeatmapChart    | `emptyAction`  | `empty.action`  | `identity`          | new-wins   | `charts/heatmap/heatmap-chart.tsx:289`       |
| 23  | ChoroplethChart | `emptyTitle`   | `empty.title`   | `identity`          | new-wins   | `charts/choropleth/choropleth-chart.tsx:187` |
| 24  | ChoroplethChart | `emptyMessage` | `empty.message` | `identity`          | new-wins   | `charts/choropleth/choropleth-chart.tsx:189` |

- **Why `legend`:** `legend` (`ContainerLegendProp`) is on 11 containers, and Choropleth's `legend`
  takes a boolean or a config too. Heatmap is the only `showLegend`. A boolean passes through
  unchanged, and Heatmap's default `true` (`:1146`) stays as its kind default.
- **Why `status`:** conventions make `status: "loading" | "ready"` the charts alias; Line, Area,
  Composed and Bar already use it. `true` becomes `"loading"` and `false` becomes `"ready"`, so the
  skeleton shows exactly when it does today. Gantt's `GanttTask.status` (`gantt/gantt.tsx:125`) is
  task data inside `tasks`, not a prop, and the ui tone group is never applied here (§9).
- **Why `empty`:** the `chart-state` group's `empty: { title?, message?, action? }`. Heatmap and
  Choropleth are the only two families with an empty state of their own. Their defaults stay per
  kind: Heatmap "No data" / "No data to plot." (`:1134-1135`), Choropleth "No data" / "No region has
  data to map." (`charts/choropleth/choropleth-chart.tsx:1214-1215`). `empty.action` is a
  `ReactNode`, so it is `codeOnly`. Choropleth goes beyond the plan's "Heatmap `empty*`"; its two
  props have the same meaning, so leaving them would leave the drift.

### A.5 RM-195 — interaction names

| #   | Component       | Old                 | New             | Transform  | Precedence | Declared today                               |
| --- | --------------- | ------------------- | --------------- | ---------- | ---------- | -------------------------------------------- |
| 25  | ChoroplethChart | `zoomEnabled`       | `zoom`          | `identity` | new-wins   | `charts/choropleth/choropleth-chart.tsx:195` |
| 26  | TreeChart       | `zoomable`          | `zoom`          | `identity` | new-wins   | `charts/tree-chart.tsx:284`                  |
| 27  | LiveLineChart   | `window`            | `windowSeconds` | `identity` | new-wins   | `charts/live-line-chart.tsx:50`              |
| 28  | SankeyChart     | `hoveredNodeIndex`  | `hoveredIndex`  | `identity` | new-wins   | `charts/sankey/sankey-chart.tsx:73`          |
| 29  | SankeyChart     | `onNodeHoverChange` | `onHoverChange` | `identity` | new-wins   | `charts/sankey/sankey-chart.tsx:75`          |
| 30  | PieChart        | `align`             | `plotAlign`     | `identity` | new-wins   | `charts/pie-chart.tsx:200`                   |
| 31  | TreeChart       | `align`             | `plotAlign`     | `identity` | new-wins   | `charts/tree-chart.tsx:307`                  |

- **Why `zoom`:** the navigator commons (`charts/navigator/types.ts:88`, on Line, Area, Composed,
  Candlestick, Bar and Heatmap) and DensityScatter (`:204`) call it `zoom`; `zoomEnabled` and
  `zoomable` are one family each. Defaults stay per kind: Choropleth `false` (`:1198`), Tree `false`
  (`:937`), the navigator and DensityScatter `true`. Choropleth's `zoomControls` still turns zoom on
  (today `zoomEnabled || Boolean(zoomControls)`, `:1316`).
- **Why `windowSeconds`:** on the navigator commons, `window` is a `NavigatorWindow` object
  (`charts/navigator/types.ts:55`). LiveLine's `window` is a number of seconds (default 30). The
  closed transform set has no unit scaling, so the name carries the unit and the value stays in
  seconds.
- **Why `hoveredIndex` / `onHoverChange`:** Pie, Ring, Radar, Funnel and the `Legend` component use
  them; Sankey is the one `Node` variant. The controlled check (`hoveredNodeIndexProp !== undefined`, `:242`)
  runs after alias resolution, so either name controls hover. Link hover stays internal state.
- **Why `plotAlign`:** `align` is a navigator commons member meaning where the first window sits
  (`"start" | "end"`, `charts/navigator/types.ts:65`). Pie and Tree use it for plot placement
  (`"start" | "center"`), a different concept and value set, which `charts-group-drift` would report
  as drift. The review (F21) proposed the same name. Values are unchanged.

### A.6 RM-196 — data keys, motion and bar geometry

| #   | Component           | Old               | New                 | Transform  | Precedence | Declared today                                         |
| --- | ------------------- | ----------------- | ------------------- | ---------- | ---------- | ------------------------------------------------------ |
| 32  | HeatmapChart        | `x`               | `xDataKey`          | `identity` | new-wins   | `charts/heatmap/heatmap-chart.tsx:168`                 |
| 33  | HeatmapChart        | `y`               | `yDataKey`          | `identity` | new-wins   | `charts/heatmap/heatmap-chart.tsx:170`                 |
| 34  | DensityScatterChart | `xKey`            | `xDataKey`          | `identity` | new-wins   | `charts/density-scatter/density-scatter-chart.tsx:176` |
| 35  | DensityScatterChart | `yKey`            | `yDataKey`          | `identity` | new-wins   | `charts/density-scatter/density-scatter-chart.tsx:178` |
| 36  | RadarChart          | `enterDurationMs` | `animationDuration` | `identity` | new-wins   | `charts/radar-chart.tsx:48`                            |
| 37  | RadarChart          | `staggerScale`    | `enterStaggerScale` | `identity` | new-wins   | `charts/radar-chart.tsx:50`                            |
| 38  | RadarChart          | `motionReplayKey` | `revealSignature`   | `identity` | new-wins   | `charts/radar-chart.tsx:54`                            |
| 39  | ComposedChart       | `barGap`          | `groupGap`          | `identity` | new-wins   | `charts/composed-chart.tsx:126`                        |

- **Why `xDataKey` / `yDataKey`:** `xDataKey` is the x column on Line, Area, Composed, Scatter,
  Candlestick and Bar. No family names a y column today; `yDataKey` pairs with it on the two
  families whose y is a column key rather than a series part's `dataKey`. DensityScatter keeps its
  defaults (`"x"`, `"y"`), and `xDataKey` keeps `xKey`'s second role as the intent `field` for x
  ranges. Heatmap's `x` and `y` are required, so the type keeps one of each pair required (see
  Watch for).
- **Why the Radar names:** `animationDuration` (ms) is on Line, Area, Composed, Bar, Scatter,
  Candlestick, Sankey, Choropleth and Ring; `enterStaggerScale` on Pie, Ring and Gauge;
  `revealSignature` on Line, Area, Bar, Scatter, Composed, Candlestick, Sankey and Choropleth. Radar
  is the only family with its own three names, and each means the same thing: an entry budget in
  milliseconds (default 1100, `:232`), a stagger multiplier (default 1), and a string whose change
  replays the entry animation. Units and defaults are unchanged.
- **Why `groupGap`:** it is the Bar part's name for the pixel gap between grouped bars
  (`charts/bar.tsx:245`, default 4). ComposedChart's `barGap` is that same pixel gap (default 4,
  `:804`), while BarChart's `barGap` is a 0–1 band fraction (`charts/bar-chart.tsx:202`). After the
  rename `barGap` means only the fraction.

### A.7 Type changes without a rename

No alias row and no warning: these only widen a type, so every call that compiles today behaves the
same.

| Component                                             | Change                                                                                                                                                                                                                                  | RM  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| Bar, SeriesBar and Scatter parts                      | gain the `series` group's `name`, which only Line (`charts/line.tsx:183`) and Area (`charts/area.tsx:301`) have. Unset, the legend and tooltip fall back to `dataKey` as today                                                          | 196 |
| Area part `labelPeaks` (`charts/area.tsx:299`)        | `boolean` widens to Line's `number \| { count; minGap? }` plus `boolean` (`charts/line.tsx:178`); `true` keeps today's Area behaviour                                                                                                   | 196 |
| PatternArea, ProfitLossLine and LiveLine `curve`      | `CurveFactory` widens to `CurveFactory \| CurveAlias`, as on Line, Area and AreaBand (`charts/pattern-area.tsx:14`, `charts/profit-loss-line.tsx:36`, `charts/live-line.tsx:67`)                                                        | 196 |
| BumpChart and ParallelCoordinatesChart `highlightKey` | widen to Bar's `string \| number \| ((datum, index) => boolean)` (`charts/bar.tsx:209`); on all three a string or number is a key value (`charts/bump-chart.tsx:106`, `charts/parallel-coordinates/parallel-coordinates-chart.tsx:127`) | 195 |

### A.8 Deprecated without a replacement

| Component        | Prop                              | Declared today                                                                        | Why                                                                                              |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| CandlestickChart | `maxVisibleItems`, `windowDomain` | `charts/navigator/types.ts:72`, `:79`, inherited at `charts/candlestick-chart.tsx:53` | category-axis members of `ChartNavigatorProps`; Candlestick has a time axis and never reads them |

RM-196 omits them from Candlestick's inherited props and redeclares them with `@deprecated` ("has no
effect on CandlestickChart; remove the prop"). They are still accepted and ignored, and RM-205
removes them. Line and Area keep both, because they read them on a band x axis.

### A.9 Checked, not renamed

| Prop (declared today)                                                                                                                                                                                                                                                                                                                                                                                                             | Why it stays                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AutoChart, ChartFrame, ChartCard, MetricGrid `loading` (`auto-chart/auto-chart.tsx:1589`, `chart-frame/chart-frame.tsx:660`, `chart-card/chart-card.tsx:114`, `metric-grid/metric-grid.tsx:35`)                                                                                                                                                                                                                                   | not chart kinds; conventions make `loading` canonical and reserve `status` for charts (§9). The plan's "`loading` on 6 families" counted them; only Heatmap and Gantt are chart kinds                                                                    |
| Line and Area part `loading` (`charts/line.tsx:222`, `charts/area.tsx:291`)                                                                                                                                                                                                                                                                                                                                                       | a switch for the loading-pulse overlay that follows the chart's phase, not a loading state                                                                                                                                                               |
| Choropleth `zoomMin` / `zoomMax` (`:197`, `:199`) vs Tree `zoomRange` (`charts/tree-chart.tsx:286`)                                                                                                                                                                                                                                                                                                                               | merging two numbers into a tuple is outside the closed transform set. **6.0 question**                                                                                                                                                                   |
| Choropleth `initialZoom` (`:201`, a transform matrix) vs Tree `defaultZoom` (`:288`, a number)                                                                                                                                                                                                                                                                                                                                    | different types, not the same concept                                                                                                                                                                                                                    |
| Choropleth `zoomControls` (`:180`) and ChoroplethZoomControls `labels` (`charts/choropleth/zoom-controls.tsx:33`)                                                                                                                                                                                                                                                                                                                 | Choropleth's own control toggle; the zoom-controls component is not exported                                                                                                                                                                             |
| Treemap `drilldown` (`charts/treemap/treemap-chart.tsx:132`); Gantt `pixelsPerDay` / `zoomBounds`                                                                                                                                                                                                                                                                                                                                 | different concepts that the review grouped under zoom                                                                                                                                                                                                    |
| Heatmap `highlight` (`:207`), Network `emphasis` (`charts/network/network-chart.tsx:123`)                                                                                                                                                                                                                                                                                                                                         | which cell gets the peak ring, and a neighbour-lighting mode: not a highlighted key                                                                                                                                                                      |
| Scatter `highlightKey` (`charts/scatter.tsx:93`)                                                                                                                                                                                                                                                                                                                                                                                  | the same name as elsewhere, but a string is a **field name** read as a flag, not a key value. An alias cannot map a name onto itself, and changing the meaning changes behaviour. **6.0 question**                                                       |
| `hoverCategory` (`charts/chart-hover-link.ts:26`)                                                                                                                                                                                                                                                                                                                                                                                 | already the shared commons name                                                                                                                                                                                                                          |
| ChartLegend `onHover` (`charts/chart-legend.tsx:50`)                                                                                                                                                                                                                                                                                                                                                                              | the one `onHover` beside `hoveredIndex`, but ChartLegend is not a chart, part or surface kind, so an alias row has no definition to live on. **6.0 question**                                                                                            |
| LiveLineChart `numXTicks` (`charts/live-line-chart.tsx:52`)                                                                                                                                                                                                                                                                                                                                                                       | a container prop; RM-192 renames axis parts only and invents no container axis props. **6.0 question**                                                                                                                                                   |
| Grid `numTicksRows` / `numTicksColumns` (`charts/grid.tsx:43`, `:45`)                                                                                                                                                                                                                                                                                                                                                             | Grid is not in the `axis` group; per-direction counts passed straight to the axis scale, with no `"auto"`. **6.0 question**                                                                                                                              |
| Bar part and Funnel `staggerDelay` (`charts/bar.tsx:241`, `charts/funnel-chart.tsx:80`)                                                                                                                                                                                                                                                                                                                                           | seconds, where the motion group uses milliseconds; a unit change is outside the closed transform set. RM-189 stops treating stagger as a duration                                                                                                        |
| LiveLineChart `lerpSpeed` (`charts/live-line-chart.tsx:58`)                                                                                                                                                                                                                                                                                                                                                                       | no counterpart elsewhere                                                                                                                                                                                                                                 |
| Ring `animationDuration` (`charts/ring-chart.tsx:77`)                                                                                                                                                                                                                                                                                                                                                                             | already canonical; it is declared but never read, a bug RM-168 fixes                                                                                                                                                                                     |
| Composed `barSize` / `maxBarSize` (`charts/composed-chart.tsx:122`, `:124`)                                                                                                                                                                                                                                                                                                                                                       | the width of one series' bar, shrunk to fit the group (`charts/series-bar-layout.ts:30`). BarChart's `barWidth` (`charts/bar-chart.tsx:204`) replaces the whole category band (`:951`). A rename would change what the number measures. **6.0 question** |
| BarChart `barGap` (`charts/bar-chart.tsx:202`); Candlestick `candleGap` / `candleWidth` (`charts/candlestick-chart.tsx:78`, `:80`)                                                                                                                                                                                                                                                                                                | the band fraction keeps `barGap`; Candlestick's pair has the same units as BarChart's                                                                                                                                                                    |
| Bar `xDataKey` default `"name"` (`charts/bar-chart.tsx:1795`) vs `"date"` elsewhere                                                                                                                                                                                                                                                                                                                                               | a kind default, not a name                                                                                                                                                                                                                               |
| Role keys: Heatmap `valueKey` (`:172`); Bump `period` / `entity` / `valueKey` / `rankKey` (`charts/bump-chart.tsx:92-98`); Dumbbell `category` / `startKey` / `endKey` (`charts/dumbbell-chart.tsx:164-168`); Parallel `entity` / `dimensions` (`:118`, `:120`); Distribution `valueKey` / `groupKey` (`charts/distribution/distribution-chart.tsx:134`, `:136`); Choropleth `scale.key` (`:226-229`); LiveLine `dataKey` (`:48`) | each names a data role, not the x position; the definitions map them to targets. `valueKey` is already shared by three families                                                                                                                          |
| Funnel `showLabels` (`charts/funnel-chart.tsx:72`) and `showPercentage` (`:70`)                                                                                                                                                                                                                                                                                                                                                   | stage names and percentages, not value labels. Next to the new `labels` the names invite confusion. **6.0 question**                                                                                                                                     |
| Heatmap `legendLabels` (`:255`)                                                                                                                                                                                                                                                                                                                                                                                                   | a legend label mode; it belongs in the legend config later, not a rename                                                                                                                                                                                 |
| Heatmap `emptyMarkScale` (`:229`), `emptyValue` (`:237`)                                                                                                                                                                                                                                                                                                                                                                          | how empty **cells** draw, not the empty state                                                                                                                                                                                                            |
| Choropleth `labels` (`:171`), Scatter part `labels` (`charts/scatter.tsx:137`)                                                                                                                                                                                                                                                                                                                                                    | place-name and point labels: data labels, already the `data-labels` meaning                                                                                                                                                                              |
| Choropleth legend `labels` (`:244`), RampLegend `labels` (`charts/legend/ramp-legend.tsx:64`)                                                                                                                                                                                                                                                                                                                                     | a nested legend label mode, not a top-level prop                                                                                                                                                                                                         |
| ChartFrame `footerLabels` (`chart-frame/chart-frame.tsx:622`)                                                                                                                                                                                                                                                                                                                                                                     | a word bag, but not named `labels` and not a definition kind; its words move onto `charts.*` keys with RM-187                                                                                                                                            |
| `DescribeBulletChartInput.labels` (`charts/bullet-chart.tsx:210`)                                                                                                                                                                                                                                                                                                                                                                 | the input of an exported helper function, not a component prop                                                                                                                                                                                           |
| Choropleth `hideNoData` (`:163`)                                                                                                                                                                                                                                                                                                                                                                                                  | the only inverted boolean found; no plan item renames it, so `invert-boolean` has no row                                                                                                                                                                 |
