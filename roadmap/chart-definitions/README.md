# Roadmap track — Chart definitions: shared prop groups and one definition per chart (`ui`, `charts`, `cli`)

Source review: `docs/review/2026-09-25-charts-unification-review.md` (F01–F39; line numbers in the items are as of that review, 2026-09-25).
Decision (ADR 0042, `docs/ADR/0042-chart-definitions-and-prop-groups.md`): `@elabs-ai/components-charts` becomes one unified package. Shared components, prop types and property definitions live once and every chart composes them — the pattern of the reference chart templates (per chart: default properties, data targets and a property definition, all built from shared property groups), adopted without its engine. Three layers: a React-free definition base in `ui` (`@elabs-ai/components-ui/definition`, shared with flow), pure prop groups and one definition per chart, part and surface in `charts`, and a committed snapshot in `cli` that the docs manifest, the A2UI catalog, `ChartSpec` / `AutoChart`, `chart_for`, the doc regions and the `./test` double all read. Names are unified with aliases: an old name keeps working with a one-time dev warning for at least one minor and is removed at 6.0.0; the complete rename table (39 rows) is frozen in ADR 0042 Appendix A at wave 0. **Nothing in the public API is removed before 6.0.0.** Items follow the chart-interaction track's format (front matter + Finding / Change / Acceptance / Test / gate / Orchestrator notes). Status values: `planned`, `in-progress`, `done`, `dropped` — update the front matter and the table together.

**Numbering: RM-162 … RM-205 and ADR 0042 are reserved for this track.** The flow track takes RM and ADR numbers after them.

Orchestration: `ORCHESTRATOR-PROMPT.md` in this folder is the kickoff prompt. Items are tracked in this folder only (front matter + table status); no GitHub issues; one report at the end. An item is done only on merged, gate-green, **browser-verified** evidence (Chromium through the CLI runner `pnpm test:stories`, light + dark, 380 / 600 / 900 px, keyboard path exercised where the item is interactive). **RM-162 is the decision item. ADR 0042 records the maintainer's three decisions as accepted; the maintainer reviews its Appendix A — the frozen rename table, confirmation item (d) — before RM-191 starts.**

## Items

| ID     | Title                                                                                                          | Wave | Priority | Effort | Depends on                                  | Agent / model                       | Status      |
| ------ | -------------------------------------------------------------------------------------------------------------- | ---- | -------- | ------ | ------------------------------------------- | ----------------------------------- | ----------- |
| RM-162 | ADR 0042 + review copy + track skeleton (decision gate; freezes the rename table)                              | 0    | P0       | S–M    | —                                           | brand-ui-docs-writer / opus         | in-progress |
| RM-163 | Legend values: `ChartLegendEntry.value`, filled by every legend caller (F09)                                   | 1    | P0       | M      | —                                           | brand-ui-component-builder / sonnet | in-progress |
| RM-164 | Honest `stackGap`: symmetric inset at internal boundaries in `Bar` + `SeriesBar` (F14)                         | 1    | P0       | S–M    | —                                           | brand-ui-component-builder / sonnet | in-progress |
| RM-165 | Scatter `resolveValueDomain` (negatives) + Candlestick y over the window (F25)                                 | 1    | P0       | M      | —                                           | brand-ui-component-builder / sonnet | in-progress |
| RM-166 | Unit `palette`: `explicit` from the caller's prop, not the resolved default (F06)                              | 1    | P0       | S      | —                                           | brand-ui-component-builder / sonnet | in-progress |
| RM-167 | `useChartInteractionPolicy`: `ChartTooltipBox` passive gate + every gesture owner (F23, F05)                   | 1    | P0       | L      | —                                           | brand-ui-component-builder / opus   | in-progress |
| RM-168 | `DEFAULT_ANIMATION_DURATION_MS` for the `1100`s, Ring duration, 7+1 doc fixes (F36, F18)                       | 1    | P1       | S–M    | —                                           | brand-ui-component-builder / sonnet | in-progress |
| RM-169 | Hygiene: ChartBrush `selection`, 8 type exports, Scatter `trend` `@deprecated`, MetricGrid ref (F35, F19, F37) | 1    | P1       | S      | —                                           | brand-ui-component-builder / sonnet | in-progress |
| RM-170 | ui definition base: `@elabs-ai/components-ui/definition` subpath (flow Phase A)                                | A    | P0       | L      | —                                           | brand-ui-component-builder / opus   | in-progress |
| RM-171 | ui definition generators: JSON Schema, snapshot, completeness helper                                           | A    | P0       | M      | 170                                         | brand-ui-component-builder / opus   | in-progress |
| RM-172 | Rule `charts-definitions-pure` (runtime closure of `definitions/**` + `props/**`)                              | 2    | P0       | S–M    | 162, 170                                    | brand-ui-component-builder / sonnet | planned     |
| RM-173 | Pure leaves (`responsive`, margin, stroke, opacity, interactions, a11y types, legend types)                    | 2    | P0       | M      | 172                                         | brand-ui-component-builder / sonnet | planned     |
| RM-174 | Charts prop groups with `definePropGroup` (no adoption yet)                                                    | 2    | P0       | M–L    | 170, 173                                    | brand-ui-component-builder / opus   | planned     |
| RM-175 | `defineChart` + contract types + registry + completeness; seeds the cartesian core + parts                     | 2    | P0       | L      | 171, 174                                    | brand-ui-component-builder / opus   | planned     |
| RM-176 | Seed the other 18 charts + 4 surfaces (Gauge, Sparkline, ChartCard, MetricGrid)                                | 2    | P0       | L      | 175                                         | brand-ui-component-builder / sonnet | planned     |
| RM-177 | `./test` double reads the registry; `deprecatedProps` option                                                   | 2    | P0       | M      | 176                                         | brand-ui-component-builder / sonnet | planned     |
| RM-178 | `gen-definitions` → `definitions.generated.json` (keyed by package) + codemod map                              | 2    | P0       | M–L    | 176                                         | brand-ui-component-builder / opus   | planned     |
| RM-179 | Manifest `extends` resolver (`Omit`, generics, `.tsx`) + snapshot join + `deprecated`                          | 2    | P1       | M–L    | 178                                         | brand-ui-component-builder / opus   | planned     |
| RM-180 | Delete the 8 RM-146 restatement blocks (incl. `heatmap/`, `distribution/`)                                     | 2    | P1       | S      | 179                                         | brand-ui-component-builder / sonnet | planned     |
| RM-181 | Rule `charts-definition-isolation` + `check-chart-treeshake.mjs` in the built-output CI step                   | 2    | P0       | M      | 176                                         | brand-ui-component-builder / sonnet | planned     |
| RM-182 | Adopt: cartesian core (Line, Area, Composed, Bar, Scatter, Candlestick, LiveLine, Waterfall)                   | 3    | P1       | L      | 163, 164, 165, 167, 168, 177, 180, 181      | brand-ui-component-builder / opus   | planned     |
| RM-183 | Adopt: radial + part-to-whole (Pie, Ring, Funnel, Radar, Unit, Bullet)                                         | 3    | P1       | L      | 163, 166, 168, 177, 180, 181                | brand-ui-component-builder / sonnet | planned     |
| RM-184 | Adopt: hierarchy + relational (Treemap, Tree, Sankey, Network, Parallel)                                       | 3    | P1       | L      | 163, 167, 168, 177, 180, 181                | brand-ui-component-builder / sonnet | planned     |
| RM-185 | Adopt: geo, matrix, distribution (+ Distribution / Waterfall paint-back, 1-D DensityScatter)                   | 3    | P1       | L      | 163, 167, 168, 177, 180, 181                | brand-ui-component-builder / sonnet | planned     |
| RM-186 | Palette convergence: one union, one `resolveColorBy`, 7 hard-coded cycles, `CHART_PALETTE`                     | 3    | P1       | M–L    | 166, 182, 183, 184, 185                     | brand-ui-component-builder / opus   | planned     |
| RM-187 | Formatting + messages: `useChartFormatters`, host-locale leaks, #250, strings onto `charts.*` keys             | 3    | P1       | L      | 182, 183, 184, 185                          | brand-ui-component-builder / sonnet | planned     |
| RM-188 | Reference marks + axes: one painter each, `chart-style-constants`, shared axes, one zoom control               | 3    | P1       | L      | 182, 183, 184, 185                          | brand-ui-component-builder / opus   | planned     |
| RM-189 | Sizing + motion: one measurement path, one debounce, Dumbbell `groupBy`, one reduced-motion source             | 3    | P1       | M–L    | 182, 183, 184, 185                          | brand-ui-component-builder / sonnet | planned     |
| RM-190 | Rules `charts-deprecated-usage`, `chart-default-prose`, `charts-group-drift` + the 6.0 tripwire                | 4    | P1       | M      | 162, 178, 182, 183, 184, 185                | brand-ui-component-builder / sonnet | planned     |
| RM-191 | Rename: word-bag `labels` → `messages`; Sparkline `label` → `accessibleLabel` (ADR A.1)                        | 4    | P1       | M      | 183, 185, 187, 190                          | brand-ui-component-builder / sonnet | planned     |
| RM-192 | Rename on axis parts: `numTicks` → `tickCount` (old-wins), `orientation` → `position` (ADR A.2)                | 4    | P1       | S–M    | 182, 188, 190                               | brand-ui-component-builder / sonnet | planned     |
| RM-193 | Rename: `showValues` → `labels`; `data-labels` group applied (ADR A.3)                                         | 4    | P1       | M      | 182, 183, 184, 185, 190, 191                | brand-ui-component-builder / sonnet | planned     |
| RM-194 | Rename: Heatmap `showLegend`; Heatmap + Gantt `loading` → `status`; `empty*` → `empty` (ADR A.4)               | 4    | P1       | M      | 185, 190                                    | brand-ui-component-builder / sonnet | planned     |
| RM-195 | Rename: `zoom`, `windowSeconds`, Sankey hover, `plotAlign`; `highlightKey` widened (ADR A.5, A.7)              | 4    | P1       | M–L    | 182, 183, 184, 185, 188, 190                | brand-ui-component-builder / sonnet | planned     |
| RM-196 | Rename: data keys, Radar motion, Composed `groupGap`; widenings; Candlestick `@deprecated` (ADR A.6–A.8)       | 4    | P1       | M–L    | 182, 183, 185, 189, 190                     | brand-ui-component-builder / sonnet | planned     |
| RM-197 | A2UI catalog from the snapshot (deprecated names kept + flagged; `Responsive`; choropleth)                     | 5    | P1       | M      | 178, 191, 192, 193, 194, 195, 196           | brand-ui-component-builder / sonnet | planned     |
| RM-198 | ChartSpec v1 + AutoChart: `validateChartSpec` → `{ ok, value, issues }`, generated prose, groups               | 5    | P1       | L      | 176, 178                                    | brand-ui-component-builder / opus   | planned     |
| RM-199 | Doc regions + `chart_for` from the snapshot + `chart-selection.md` key props + `argTypesFromDefinition`        | 5    | P2       | M      | 178, 179                                    | brand-ui-component-builder / sonnet | planned     |
| RM-200 | FormSpec spike (test-only) for BarChart; gaps in the ADR appendix                                              | 5    | P3       | S–M    | 162, 175                                    | brand-ui-component-builder / sonnet | planned     |
| RM-201 | Bar / Scatter / Candlestick on shared shell hooks; DensityScatter axes (F08, F22)                              | 6    | P2       | L      | 182, 185, 188                               | brand-ui-component-builder / opus   | planned     |
| RM-202 | Ring on the Pie engine (F28)                                                                                   | 6    | P2       | M–L    | 183                                         | brand-ui-component-builder / sonnet | planned     |
| RM-203 | Split `ChartContextValue`; one legend item type; one hover context (F38, F04)                                  | 6    | P2       | M–L    | 182, 183, 184, 185                          | brand-ui-component-builder / opus   | planned     |
| RM-204 | Wiring dedupe: `mergeRefs`, `useId`, `displayName`, warn-once, datapoint gate, shared helpers (F13, F31, F34)  | 6    | P2       | M–L    | 182, 183, 184, 185                          | brand-ui-component-builder / sonnet | planned     |
| RM-205 | 6.0.0: remove aliases + legacy deprecations; migration steps + `brand-ui codemod`                              | 7    | P1       | M      | 169, 190, 191, 192, 193, 194, 195, 196, 197 | brand-ui-component-builder / opus   | planned     |

Agent names are the `.claude/agents/brand-ui-*.md` definitions; `model` in each file overrides the agent's default for that item.

## Waves and semver

Versioning is lockstep (Changesets). Each wave's changesets follow this column.

| Wave | Scope                                       | Items           | Semver                                                                | Needs                                                                                                 |
| ---- | ------------------------------------------- | --------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 0    | docs: ADR 0042, review copy, this track     | RM-162          | — (no changeset)                                                      | —                                                                                                     |
| 1    | bugs and hygiene                            | RM-163 … RM-169 | minor (adds `ChartLegendEntry.value` and `useChartInteractionPolicy`) | nothing — runs in parallel with wave A                                                                |
| A    | ui definition base                          | RM-170, RM-171  | minor (new `@elabs-ai/components-ui/definition` subpath)              | nothing — runs in parallel with wave 1                                                                |
| 2    | charts foundations                          | RM-172 … RM-181 | minor, additive                                                       | wave A                                                                                                |
| 3    | adoption, one PR per cluster                | RM-182 … RM-189 | minor                                                                 | wave 2                                                                                                |
| 4    | renames                                     | RM-190 … RM-196 | minor per item; the last lands at least one minor before 6.0          | wave 3's cluster for the names it touches; RM-191 … RM-196 also the maintainer's review of Appendix A |
| 5    | derived artifacts                           | RM-197 … RM-200 | minor                                                                 | wave 2 (RM-197 also wave 4, for the deprecated flags)                                                 |
| 6    | optional convergence, each behind baselines | RM-201 … RM-204 | minor                                                                 | wave 3 (independent of waves 4 and 5)                                                                 |
| 7    | major                                       | RM-205          | 6.0.0                                                                 | waves 4 and 5 (RM-197)                                                                                |

Tooling-only items (RM-172, RM-180, RM-181, RM-190, RM-200) ship no changeset.

## Waves

```
wave 0  └ RM-162 ADR 0042 + review copy + track   ← maintainer reviews Appendix A (the frozen rename table) before RM-191
wave 1  ┬ RM-163 legend values          ┐
        ├ RM-164 honest stackGap        │ bugs + hygiene, disjoint files; in parallel with wave A
        ├ RM-165 value domains          │
        ├ RM-166 Unit palette flag      │
        ├ RM-167 interaction policy     │
        ├ RM-168 motion + doc drift     │
        └ RM-169 hygiene                ┘
wave A  └ RM-170 ui definition base → RM-171 generators   ← flow Phase 1 may start once A merges; it needs nothing else
              ▼ A merged (wave 2 needs A)
wave 2    RM-172 pure rule → RM-173 pure leaves → RM-174 prop groups ─┐
          RM-171 ──────────────────────────────────────────────────── RM-175 defineChart + registry + cartesian seed
          → RM-176 other 18 charts + 4 surfaces → ┬ RM-177 test double
                                                  ├ RM-178 gen-definitions → RM-179 manifest resolver → RM-180 delete RM-146 blocks
                                                  └ RM-181 isolation rule + tree-shake check
              ▼ wave 2 merged (wave 3 needs 2; each cluster also waits for the wave-1 fixes in its families)
wave 3  ┬ RM-182 cartesian core              ┐ one PR per cluster
        ├ RM-183 radial + part-to-whole      │
        ├ RM-184 hierarchy + relational      │
        └ RM-185 geo + matrix + distribution ┘
              ▼ all four clusters merged
        ┬ RM-186 palette · RM-187 formatting + messages · RM-188 reference marks + axes · RM-189 sizing + motion
              ▼ the cluster that owns each renamed name merged (wave 4 needs 3's cluster)
wave 4    RM-190 rules + tripwire → ┬ RM-191 labels → messages → RM-193 showValues → labels
                                    ├ RM-192 axis parts (after RM-188)
                                    ├ RM-194 legend + state
                                    ├ RM-195 interaction names (after RM-188)
                                    └ RM-196 data keys + series (after RM-189; last rename)
wave 5  ┬ RM-197 A2UI from the snapshot        ← needs wave 2 and all of wave 4
        ├ RM-198 ChartSpec v1 + AutoChart      ┐
        ├ RM-199 doc regions + chart_for       │ need wave 2 only
        └ RM-200 FormSpec spike                ┘
wave 6  ┬ RM-201 shared shell hooks · RM-202 Ring on the Pie engine   ← independent after wave 3
        └ RM-203 split ChartContextValue · RM-204 wiring dedupe
wave 7  └ RM-205 6.0.0 removals   ← only when the maintainer says release, a full minor after RM-196
```

Critical path to 6.0.0: RM-170 → RM-172 → RM-173 → RM-174 → RM-175 → RM-176 → RM-178 → RM-179 → RM-180 → RM-182 → RM-187 → RM-191 → RM-193 → RM-197 → RM-205 (≈ 42 agent-days at the upper effort bound). RM-163 and RM-165 are the items to demo first — legends that show their values and a scatter that no longer clips negatives are visible wins.

## Flow coordination

The flow review (`docs/review/2026-09-25-flow-unified-contract-and-yaml-review.md`) is no longer a live session; RM-162 mirrors these four points into its §3.2.

1. `appliesWhen` is declarative (`{ field, equals }` / `{ field, in }`), not a function, so it serialises and maps onto FormSpec `visibleWhen`.
2. `aliases` are data rows with closed transform ids and `precedence`. The `Record<string, string>` form is shorthand for `identity` / `new-wins`.
3. The base ships as the `@elabs-ai/components-ui/definition` subpath; flow's `/spec` core imports it from there.
4. The snapshot is `packages/cli/lib/definitions.generated.json`, keyed by package, so flow joins it rather than adding a second file. RM-162 … RM-205 and ADR 0042 are taken; flow takes numbers after them.

Flow Phase 1 needs wave A (RM-170, RM-171) and nothing else from charts.

## Gates

- New `pnpm check` rules, each with fixtures (`pnpm check:test`): `charts-definitions-pure` (RM-172), `charts-definition-isolation` (RM-181), `chart-style-constants` (RM-188), `charts-deprecated-usage`, `chart-default-prose`, `charts-group-drift` (RM-190).
- CI post-build: `packages/cli/scripts/check-chart-treeshake.mjs` (esbuild metafile inputs plus a per-family byte budget) in the "Built-output checks" step (RM-181).
- Existing gates that stay green: `charts-test-double`, `charts-responsive`, `charts-honesty`, `chart-hairline`, `locale-formatting`, `i18n-strings`, `motion-tokens`, `data-slot`, `variant-coverage`, `loading-states`, `reference-leakage`, and `pnpm gen:check` ("Generated artifacts are fresh").
- Tests: lockstep type tests (`*.test-d.ts`), the completeness test, golden `CHART_CONTRACT_SPECS`, defaults parity, registry-loop behaviour tests (policy, tooltip, legend, palette, status, spec fixtures — jsdom plus fixtures, Storybook play tests where jsdom cannot render), per-alias tests, the 6.0 tripwire, visual baselines (`charts/__baselines__`).

## Definition of done for the track

- Every chart (26), part and surface (4) has a definition in `CHART_DEFINITIONS`; `CHART_CONTRACT_SPECS` is derived from it; the lockstep type tests compile.
- The docs manifest, A2UI catalog, `chart_for`, doc regions, `chart-selection.md` key props and the codemod map all derive from `packages/cli/lib/definitions.generated.json`; `pnpm gen && pnpm gen:check` is clean twice in a row.
- `pnpm check` green, including the six new rules; `pnpm check:test` green.
- `pnpm -r typecheck lint test`, `pnpm build`, then `node packages/cli/scripts/check-chart-treeshake.mjs`: a BarChart-only bundle holds no other definition, no registry and no AutoChart; `./test` holds no visx, d3 or motion.
- `pnpm consumer:check` before each release; each wave's changeset follows the semver column.
- `pnpm test:stories` (the CLI runner, not the MCP runner, which serves stale package code) with `addon-a11y` on every touched story, light and dark, 380 / 600 / 900 px.
- The `chart_for` and A2UI catalog outputs are compared before and after (RM-197, RM-199).
- At 6.0.0: the tripwire is green and the CHANGELOG migration section lists every alias row with `brand-ui codemod` usage.
- The review's `## Outcome` records merged items, gate results and browser evidence.
