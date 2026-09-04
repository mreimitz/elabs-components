# lieflat-charts vs `@elabs-ai/components-charts` — gap analysis and recommendation

Date: 2026-09-04
Source under review: https://github.com/larashero3-dotcom/lieflat-charts (main, cloned and rendered locally)
Package under review: `packages/charts` (brand-ui 4.0.0, 14 chart containers, visx/d3 + motion)

Method: read `SKILL.md`, `catalog.md`, `mono-tokens.js`, `color-presets.js`, every `// ════` block in the seven gallery templates and the two validation scripts; rendered the three main galleries headless (Chromium, external CDNs blocked) to confirm what actually draws without a network; cross-checked every "missing in brand-ui" claim with a grep of `packages/charts/src` and the token sheet.

## 1. What lieflat-charts actually is

It is not a chart library. It is a **prompt-driven template catalogue**: 63 hand-written chart cards in seven static HTML galleries, plus a `SKILL.md` that tells an agent how to pick one by _data shape_, copy its code block, swap the data and keep the visual grammar. Roughly 45 of the 63 are hand-drawn SVG, 16 are ECharts, one is Chart.js, two are ECharts maps with remote GeoJSON.

Three families, one grammar:

| Family                                | Count | Reader time | Engine                   | Idea                                                               |
| ------------------------------------- | ----- | ----------- | ------------------------ | ------------------------------------------------------------------ |
| Lupi Editorial (L1–L20)               | 19    | 30 s+       | SVG                      | one mark = one record; hairlines, annotations, whitespace          |
| Lupi Basics (F1–F17)                  | 17    | ~30 s       | SVG (+1 ECharts treemap) | familiar bar/line/donut silhouettes rebuilt from _countable units_ |
| Glance (G3–G22)                       | 20    | < 10 s      | ECharts / Chart.js / SVG | bold, pre-aggregated, conclusion-first                             |
| Maps (M1–M2), Big interactive (B1–B3) | 5     | —           | ECharts / SVG            | choropleths, 60–180 node networks, 100+ route threads              |

Why the charts look good — the actual mechanics, not the marketing:

1. **Unit decomposition.** Bars are ladders of 1px rungs ("one rung = $1k"), donuts are 100 ticks, waffles and "hundred fields" are 100 dots. The unit is stated in the subtitle. This is the single biggest visual signature and it is cheap to implement.
2. **Hairline vocabulary.** 0.5–0.9px strokes with per-mark seeded opacity/length jitter; areas built from one vertical hairline per day instead of a filled path; a "barcode floor" where every calendar period gets a tick whether or not it has data.
3. **Lightness is data.** A 7-step grey ladder; the most important series is the darkest; hero-and-rest hierarchy (one element at 2px ink and 800 weight, everything else at 0.65px and 50% opacity). Colour presets (porcelain / palm / wire) keep this contract and only swap hue.
4. **Furniture.** Dashed leaders (`1 3`), dashed rings around the peak cell, italic marginalia with bézier leader lines, ledger-paper hairlines, rim ticks, "silence made visible" (zero cells drawn as 0.9px pinpricks, never blank), paper-coloured halo text (`paint-order: stroke`).
5. **Card contract.** Conclusion-style title ("Where we gained, where we bled", never "bar chart") → prose subtitle carrying the legend → chart → all-caps letter-spaced source row.
6. **Honesty rules enforced by the prompt.** No broken axes on bars; `sqrt(v)` for area encodings; deterministic `rnd(i,k)` instead of `Math.random`; one colour system per deliverable; category count caps per palette.
7. **Motion.** IntersectionObserver reveal, click-to-replay, per-mark `animation-delay` stagger (8–15 ms dots, 80–130 ms bars), `pathLength=1` draw-in, `prefers-reduced-motion` opt-out.
8. **A data-shape decision tree** (SKILL.md §4) that maps "few categories", "two time points", "cat × cat + value", "multi-select percentages", "OHLC" etc. to two or three candidates each — this is where most of the skill's value sits.

What it is _not_, and should not be copied:

- No responsiveness: every SVG bakes pixel positions into a 400×320 viewBox and scales as an image; 5–7px labels become unreadable at half width. `.grid2` has no media query.
- No accessibility beyond SVG `<title>` tooltips: no `role="img"`, no keyboard path, no focus, caption greys at ~2:1 contrast.
- Token drift: `mono-tokens.js` is declared canonical but no template imports it; constants and helpers are copy-pasted twice per gallery and already diverge (`rnd` sign handling, missing reduced-motion CSS in two galleries).
- Colour presets are 18 hand-forked HTML files (~10.9k lines), not themes.
- Three engines (hand SVG, ECharts, Chart.js) pinned to unversioned CDN majors, Google Fonts, remote GeoJSON with no error handling.
- Validation covers syntax and colour-literal discipline; the Playwright smoke test only exercises the 13 newest charts.

brand-ui already does the hard, boring parts lieflat skips (tokens, themes, density, decoration dial, keyboard drill-down, contrast gates, test double, ChartFrame). What it lacks is the _vocabulary_ — both the chart types and the editorial marks.

## 2. Coverage map: data shape → lieflat → brand-ui today

| Data shape                              | lieflat answer                                             | brand-ui today                                     | Gap                                                                                 |
| --------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Few categories, compare                 | G3 Chunky Bars, F1 Rung Bars, F5 Tick Rows, L2 Dot Cascade | `BarChart` (vertical/horizontal, grouped, stacked) | no value labels on bars, no unit/rung mode                                          |
| Signed categorical values               | G10 Diverging Bar                                          | `BarChart` accepts negatives                       | no zero-line marker, capsule on both ends, no sign labels                           |
| 100 % composition                       | G4 Dot Waffle, L14 Hundred Field, F4 Tick Donut            | `PieChart`, `RingChart`                            | **no waffle / unit chart**; no tick-donut variant                                   |
| Multi-select % (each 0–100, sum > 100)  | L15 Ballot Tally                                           | horizontal `BarChart`                              | no unit tick mode                                                                   |
| Two time points per category            | F12 Dumbbell Queue, F6 Paired Rungs                        | grouped `BarChart`                                 | **no dumbbell / range bar / slope**                                                 |
| Daily series ≤ 30 d / 30–60 d / 90 d    | F2 Hairline Line, F3 Hairline Area, L3 Barcode Lollipop    | `LineChart`, `AreaChart`                           | no hollow-vs-filled point semantics, no per-period tick floor, no top-k peak labels |
| Cumulative growth + KPI                 | G18 Draw-in + Counter                                      | `LineChart` + `ChartStatFlow`                      | present (compose)                                                                   |
| Two linked series (input vs output)     | G8 Rainfall                                                | `ComposedChart`                                    | present; no inverted top panel                                                      |
| Real-time                               | G17 Dynamic Stream                                         | `LiveLineChart`                                    | present, better                                                                     |
| Rank over time                          | G16 Bar Race, G21 Rank Strip                               | —                                                  | **no bump / rank strip** (race not worth it)                                        |
| Weekday × hour × count                  | G14 Single Axis, F10 Dot Heat                              | —                                                  | **no heatmap / punch card**                                                         |
| Cat × cat + value (matrix)              | L4 Arc Matrix, L9 Bubble Almanac, L16 / G20 Matrix Heat    | —                                                  | **no heatmap**                                                                      |
| Whole year, day granularity             | L17 Calendar Heat                                          | —                                                  | **no calendar heatmap**                                                             |
| Waterfall / bridge                      | F9 Rung Waterfall                                          | —                                                  | **no waterfall**                                                                    |
| Single value progress                   | F11 Tick Gauge                                             | `Gauge` (notched)                                  | present; no milestone markers                                                       |
| 2-D scatter ≤ 20 pts                    | F8 Plumb Scatter                                           | `ScatterChart`                                     | no drop lines, no hero labels                                                       |
| Distribution, record-level              | G15 Jitter Strip                                           | —                                                  | **no strip / jitter**                                                               |
| Binned frequency                        | F14 Rung Histogram                                         | —                                                  | **no histogram**                                                                    |
| Five-number summary                     | F15 Tick Box                                               | —                                                  | **no box plot**                                                                     |
| Density shape, few groups / many groups | G19 Violin, L19 Ridgeline                                  | —                                                  | **no violin / ridgeline**                                                           |
| Many-to-one membership                  | L5 Radial Convergence, L12 Type Colonnade                  | `SankeyChart` (approximation)                      | no bipartite / arc diagram                                                          |
| Funnel                                  | L13 Hourglass Stream                                       | `FunnelChart`                                      | present; no stage-to-stage conversion annotation                                    |
| Hierarchy, show membership              | G7 Tree LR                                                 | —                                                  | **no tree**                                                                         |
| Hierarchy + share                       | F13 Nested Treemap                                         | —                                                  | **no treemap**                                                                      |
| Composition over continuous time        | F16 Stream Ribbon                                          | stacked `AreaChart`                                | no silhouette/wiggle offset                                                         |
| Same entities × 3–6 dimensions          | L20 Parallel Coordinates                                   | `RadarChart` (single-pole only)                    | **no parallel coordinates**                                                         |
| OHLC                                    | F17 Candlestick                                            | `CandlestickChart`                                 | present; `AutoChart` inference stubbed to "line"                                    |
| Two-end aggregated flow                 | G22 Aggregate Sankey                                       | `SankeyChart`                                      | present                                                                             |
| Per-record routes (100+)                | B3 Threads                                                 | —                                                  | no thread / alluvial-per-record mode                                                |
| Network ≤ 15 nodes / 60 / 180           | G6, G11, B1, B2, L6                                        | —                                                  | **no network / force / chord**                                                      |
| Region shading                          | M1, M2                                                     | `ChoroplethChart`                                  | present, better (offline, keyboard)                                                 |
| Angle × radius double encoding          | G13 Big Slice                                              | `PieChart`                                         | no `radiusKey`                                                                      |
| Events on a 24 h clock                  | L10 Radial Patchwork                                       | —                                                  | editorial one-off                                                                   |
| Launch time + current size per entity   | L1 Launch Fan                                              | —                                                  | editorial one-off                                                                   |
| Isometric stacked grids                 | L8 Dotty Matrix                                            | —                                                  | decorative one-off                                                                  |
| Event lifelines                         | L11 Trend Lineage                                          | `Gantt` (approximation)                            | editorial one-off                                                                   |
| Bipolar scale + competitors             | L7 Brand Spectrum                                          | —                                                  | dumbbell/range bar covers it once added                                             |
| Demo animation (morph, pictorial)       | G9, G5, G12                                                | —                                                  | not recommended                                                                     |

Fourteen genuinely missing chart types; six existing families that can absorb the editorial variants with a prop; ten lieflat cards that are one-off editorial compositions and should stay recipes, not components.

## 3. Recommendation A — new chart types to add

Ordered by how many data shapes each one closes, how much of brand-ui's existing scaffolding it reuses (`ChartProvider`, axes, tooltip, datapoint layer, legend, reveal, test double contract), and how often the shape shows up in dashboards, data apps and AI-assistant chart output.

### Tier 1 — close the common analytical gaps (this quarter)

| #   | Component                                                                                                                                                                   | Closes                      | Build on                                                         | Effort |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------- | ------ |
| 1   | **`HeatmapChart`** — `x`, `y`, `valueKey`; `mode="cell" \| "dot"`; `variant="calendar"` (52 × 7 with month ticks); null → pinprick; `highlight="max"` dashed ring           | L16, G20, F10, G14, L4, L17 | `scaleBand` × 2, sequential ramp (see C2), `ChartDatapointLayer` | M      |
| 2   | **`WaterfallChart`** — steps add/subtract, running-total connectors, `totalKeys`                                                                                            | F9                          | `Bar`, `BarXAxis`, dashed hand-off connector primitive           | S      |
| 3   | **`DumbbellChart`** — `startKey` / `endKey` per category, horizontal, optional bead units between, `variant="slope"` for the two-column form                                | F12, F6, L7                 | horizontal `BarChart` layout, `UnitStack` primitive (see C1)     | S–M    |
| 4   | **`UnitChart`** — `layout="waffle" \| "field" \| "row"`, `unit` (1 dot = N), 100-dot default, footer arithmetic                                                             | G4, L14, L15, L2            | new; phyllotaxis helper for `field`                              | S–M    |
| 5   | **`TreemapChart`** — two levels default, `area = value`, parent title bands, paper gaps as separators, `nodeClick` off by default                                           | F13                         | `d3-hierarchy` (add dep), `ChartDatapointLayer`                  | M      |
| 6   | **`DistributionChart`** — one container, `kind="histogram" \| "box" \| "violin" \| "strip"`, shared numeric scale, grouped by category; `ridgeline` later as `kind="ridge"` | F14, F15, G19, G15, L19     | `d3-array` (`bin`, quantiles), KDE helper, seeded jitter         | M–L    |

### Tier 2 — round out the analytical set (next quarter)

| #   | Component                                                                                                                                           | Closes                       | Build on                                 | Effort |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------- | ------ |
| 7   | **`BumpChart`** (rank over discrete time; `variant="strip"` for the cell/filmstrip form with ▲▼ deltas)                                             | G21, static G16              | `LineChart` scales + `scalePoint`        | S–M    |
| 8   | **Streamgraph** — not a new container: `AreaChart offset="silhouette" \| "wiggle"` via `d3-shape` `stackOffset*`, plus per-band widest-point labels | F16                          | `AreaChart` (stack already there)        | S      |
| 9   | **`ParallelCoordinatesChart`** — 3–6 axes, one hairline per entity, `heroKey` promotes one line                                                     | L20                          | `scaleLinear` per axis, `SeriesHoverDim` | M      |
| 10  | **`NetworkChart`** — `layout="force" \| "circular" \| "arc"`, `ChartDatapointLayer` on nodes, emphasis-adjacency on hover, drag optional            | G6, G11, B1, B2, L5, L12, L6 | `d3-force`, `@visx/network` or own SVG   | L      |
| 11  | **`TreeChart`** — left-to-right orthogonal                                                                                                          | G7                           | `@visx/hierarchy`                        | S–M    |

### Explicitly not recommended as package components

- G16 Bar Race, G9 Scatter Morph, G12 Stagger Wave, G5 Pictorial Bar: demo/short-video animations; `LiveLineChart` already covers the one real-time case (G17).
- L1 Launch Fan, L8 Dotty Matrix, L9 Bubble Almanac, L10 Radial Patchwork, L11 Trend Lineage, L13 Hourglass Stream: bespoke editorial compositions with one intended data set each. Ship the two or three most striking (L10, L13, L9) as **registry blocks / Storybook recipes** built from the new primitives, so the package API stays small.
- M1/M2 maps: `ChoroplethChart` is already the better implementation (offline TopoJSON, keyboard nav, tooltips).
- B3 Threads: worth a `SankeyChart mode="threads"` (one path per record, fat invisible hit-twin, hover-bundle, click-pin) _after_ the Tier 1 work, not before.

## 4. Recommendation B — enhance the existing charts

| Chart                      | Add                                                                                                                                                                                                                                                                                                                                                                                           | From                 | Effort                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------- |
| `BarChart`                 | `showValues` (end-of-bar labels, 800 weight, halo) — currently no value labels at all; `unit` mode rendering rungs/ticks instead of a solid rect; diverging mode: zero-line marker, capsule only on the outer end, signed labels; `highlightKey` / `highlightIndex` for hero-and-rest                                                                                                         | G3, F1, F5, G10, L15 | S each                                        |
| `LineChart`                | `markerStyle` per point (hollow vs filled, e.g. weekend); `labelPeaks={k}` with minimum-gap collision avoidance; `periodTicks` (one tick per calendar period on the floor — the "barcode floor")                                                                                                                                                                                              | F2, L3               | S–M                                           |
| `AreaChart`                | `offset="silhouette" \| "wiggle"`; hairline-area rendering as the **high-decoration** variant (one vertical stroke per sample) — this slots straight into the existing decoration dial that already swaps solid fills for patterns                                                                                                                                                            | F3, F16              | S–M                                           |
| `PieChart` / `RingChart`   | `radiusKey` (angle = share, radius = intensity); tick-ring rendering (100 ticks, 1 = 1 %) as the high-decoration variant; centre value already exists                                                                                                                                                                                                                                         | G13, F4              | S–M                                           |
| `ScatterChart`             | `dropLines` to the floor; `labelExtremes` (best/worst) with halo; `jitter` for categorical y (this doubles as `DistributionChart kind="strip"`)                                                                                                                                                                                                                                               | F8, G15              | S                                             |
| `FunnelChart`              | stage-to-stage conversion % annotation in the gutter                                                                                                                                                                                                                                                                                                                                          | L13                  | S                                             |
| `Gauge`                    | already notched (`totalNotches`); add milestone dots at 25/50/75/100 and a "N to go" caption                                                                                                                                                                                                                                                                                                  | F11                  | S                                             |
| `SankeyChart`              | `mode="threads"` per-record variant                                                                                                                                                                                                                                                                                                                                                           | B3                   | M                                             |
| `ChoroplethChart`          | hatch pattern for no-data regions (pattern infra exists); top-N inline labels with halo                                                                                                                                                                                                                                                                                                       | M1, M2               | S                                             |
| `ChartCard` / `ChartFrame` | `source` prop (all-caps letter-spaced source row); keep `description` but document it as _the legend in prose_; optional `badge`; PNG/SVG export next to CSV download                                                                                                                                                                                                                         | card contract        | S                                             |
| `AutoChart`                | extend `ChartType` with the new families; port lieflat's decision tree into `inferChartType` (OHLC keys → candlestick — already stubbed; two numeric keys per category → dumbbell; cat × cat + numeric → heatmap; `children` → treemap; signed single series → diverging bar; ≤ 6 rows summing to ~100 → ring/unit; numeric-only single column → histogram; ISO date × ≥ 300 rows → calendar) | SKILL.md §4          | M — highest leverage for the `ai-chart` block |

## 5. Recommendation C — what to tune in the package overall

C1. **Add an "editorial marks" primitive layer** (`packages/charts/src/marks/`), used by the new containers and exposed for composition: `HaloText` (`paint-order: stroke`, halo colour from `--chart-background`), `Leader` (dashed `1 3` / `2 3` bézier or elbow leader to an annotation), `PeakRing` (dashed ring/square around one mark), `Marginalia` (italic note + leader), `HairlineFloor` (one tick per period), `QuietDot` (null/zero as a 0.9px pinprick — never blank), `UnitStack` (n marks of kind rung/tick/dot with `markEvery`), `seededRnd(i, k)` (deterministic jitter — also fixes snapshot stability), `useReveal` + `stagger(i, base, step)` + `DrawPath` (`pathLength=1`). About ten small files; each reused by three or more charts above.

C2. **Add sequential and diverging ramps to the token sheet.** brand-ui has twelve _categorical_ series tokens (yellow/blue/grey families) and nothing else; lieflat's whole "lightness is data" contract needs an ordered ramp. Add `--chart-seq-1..7` (one hue, seven lightness steps derived from `--chart-2` per theme, the way porcelain does it) and `--chart-div-neg/-mid/-pos`, both under the existing contrast and ΔE gates. Then give every container a `palette="categorical" \| "sequential" \| "diverging" \| "mono" \| "accent"` prop, where `accent` = grey ramp + one hero in `--chart-1` (lieflat's wire preset). Heatmap, calendar, treemap, matrix and choropleth all need this; categorical charts with more than six series should default to `mono`.

C3. **Value hierarchy on the type scale.** Lieflat sets in-chart values at weight 800 and axis labels at 600; brand-ui's density-aware `text-meta` is 500. Add `text-chart-value` (800) and `text-chart-source` (all-caps, `.08em` tracking) roles so the card contract is a token, not a per-story class.

C4. **Reveal on scroll, replay on click.** `ChartRevealClip` plays as soon as the chart renders, wherever it is on the page; add `revealOn="mount" \| "inView"` (motion's `whileInView` with a 0.3 threshold) and per-mark stagger tokens (`--chart-stagger-dot: 12ms`, `--chart-stagger-bar: 100ms`) in `MOTION_GUIDELINES.md`. `prefers-reduced-motion` is already handled — keep it.

C5. **Turn lieflat's honesty rules into gates**, matching the repo's "enforcement over reminders" stance: `charts:honesty:check` — bar and unit charts must include zero in the y-domain (`niceYDomain` currently just nices whatever it gets), area encodings must go through a shared `areaRadius(v)` = `sqrt` helper, `Math.random` banned in `packages/charts/src` (already true in practice; make it a rule), and every container story must declare the unit it plots in `description`.

C6. **Port the decision tree, not the templates, into the skill.** The most valuable part of lieflat is `SKILL.md` §4 (data shape → 2–3 candidates) and the "≥ 3 candidates, write down why the others lost" discipline. Add a `reference/chart-selection.md` to `skills/brand-ui` and a `brand-ui chart-for "<data shape>"` CLI/MCP query that returns candidates from the manifest. This is what makes the AI-assistant consumers pick the right chart; the templates are secondary.

C7. **Storybook: a data-shape index.** Alongside the per-component stories, add one "Charts / By data shape" story group that mirrors the table in §2, so a human or agent looking for "two time points per category" lands on `DumbbellChart` without knowing the name.

C8. **Keep visx. Do not add ECharts or Chart.js.** Lieflat's mixed engines are its main structural weakness, and every chart above is expressible in visx/d3 with the existing provider, tooltip and datapoint layer. `d3-hierarchy` and `d3-force` are the only new dependencies needed.

C9. **Do not copy: forked per-palette files, CDN fonts, `<title>`-only tooltips, hardcoded viewBoxes.** Every new container must pass the existing gates (test double contract, `charts:reuse:check`, a11y baseline, contrast) — that is the bar lieflat never clears.

## 6. Suggested sequence

1. C1 marks layer + C2 ramps (everything else depends on them) — ~1 week.
2. Tier 1 #1 `HeatmapChart` (with calendar variant) and #2 `WaterfallChart` — first visible wins, both small.
3. B `BarChart` `showValues` / `unit` / diverging, `AreaChart` `offset` — cheap, high-frequency.
4. Tier 1 #3 `DumbbellChart`, #4 `UnitChart`, #5 `TreemapChart`.
5. `AutoChart` inference extension (B, last row) once the types exist.
6. Tier 1 #6 `DistributionChart`, then Tier 2.
7. C6 chart-selection reference + CLI query; C7 Storybook data-shape index; C5 gates as each rule becomes checkable.

Everything in steps 1–4 is S or M effort and reuses existing scaffolding; nothing requires a new rendering engine or a breaking change to the current 14 containers.
