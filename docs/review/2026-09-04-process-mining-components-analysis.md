# Process mining visualization for brand-ui — market analysis, requirements and decision

Date: 2026-09-04
Question: brand-ui gains a set of components for process mining and process visualization. Where do they live, and what exactly gets built?
Decision (maintainer, 2026-09-04): **a new layer-3 package `@elabs-ai/components-process` that composes `flow`, `charts`, `data` and `ui`. Missing primitives are added to the base packages or existing base components are enhanced — never re-implemented inside the new package.** Roadmap: `roadmap/process-mining/`.
Packages inspected: `packages/flow` (23 exports, dagre + d3-force layout, `FlowNode`/`FlowEdge`/`FlowSmartEdge`/`FlowFloatingEdge`, `CanvasShell`, `InspectorPanel`, `Legend`), `packages/charts` (14 chart containers, `Gantt`, `Sparkline`, editorial `marks/`, ramps from RM-018), `packages/data` (`DataTable`, `FilterBar`, `FacetFilter`, `to-csv`), `packages/ui` (`MetricCard`, `Slider`, `ToggleGroup`, `SegmentedField`, `Table`), ADR 0006/0012/0015/0018/0019, `docs/playbooks/flow-workspace.md`, `.claude/rules/architecture-review.md` D1.

Method: web survey of 13 commercial products (Celonis, UiPath, SAP Signavio, ARIS, Apromore, Power Automate Process Mining, Appian, IBM, Disco, QPR, mindzie, Mehrwerk mpmX, process.science), the open-source stack (pm4py, pm4js, bupaR/processmapR, ProM IvM, Performance Spectrum Miner, bpmn-js, bpmn-visualization, elkjs, dagre, Cytoscape), the XES and OCEL 2.0 standards, and the visual-analytics literature on process maps. Every claim about the repo was checked against source. Sources are listed at the end; claims that could only be confirmed from secondary sources are marked _(secondary)_.

## 1. Executive summary

1. **Process mining is not one graph.** The canon across all thirteen products is a _coordinated set_ of views — process map (directly-follows graph) with two abstraction sliders, variant explorer with sequence chips and coverage %, case table, case timeline, KPI strip, dotted chart, conformance overlay — and only the first is a React Flow surface. The rest are bars, tables, timelines and scatter-like marks that `charts` and `data` already own. No single existing package can host the set without either sideways imports (forbidden by the two-layer rule) or duplication (`charts:reuse:check` rejects it).
2. **Placement: a third layer.** `tokens → ui/icons → data/ai/flow/maps/charts/… → process`. `@elabs-ai/components-process` is the only layer-3 package; nothing depends on it. It imports `flow` (canvas, layout, edges), `charts` (`ChartFrame`, `Gantt`, `Sparkline`, marks, ramps), `data` (`DataTable`, `FilterBar`) and `ui`. The dependency graph stays acyclic and one-way; the rule text in `CLAUDE.md`, `architecture-review.md` D1 and `quality-gates.md` gains one arrow, recorded in an ADR.
3. **Primitives go down, compositions go up.** Every domain-agnostic thing a process map needs is a `flow` primitive first: weighted edges, edge label pills via `EdgeLabelRenderer`, self-loop edge, back-edge style, `"layered-tb"` layout, a continuous-scale `Legend`, later an elkjs adapter behind a lazy boundary (ADR 0019). `charts` gains a canvas mark layer for tens of thousands of dots. The process package composes; it does not own a single pixel that another package could reuse.
4. **A framework-free core as a subpath.** `@elabs-ai/components-process/core` (ADR 0006 subpath exports): event-log model, adapters (flat rows, CSV, XES, OCEL), DFG discovery, variants, abstraction with connectivity repair, performance aggregation, rework detection, selection types, later token replay. Pure TypeScript, worker-safe, fixture-tested, importable by the CLI/MCP side. Nothing comparable exists in TypeScript on npm — pm4js is BSD but untyped and near-dormant, pm4py is AGPL and Python — so this is a build, not a reuse decision.
5. **Two inputs, one selection model.** Components accept a raw event log (the component computes) _or_ a pre-aggregated graph and variant list computed by a backend or an associative BI engine. Selection is a controlled tri-state (`selected | associated | excluded`) so the same components work with local filtering and with an external selection engine, and so excluded elements render dimmed instead of vanishing — the biggest documented UX gap in commercial tools.
6. **Four waves.** Wave 0 (base-package primitives + package scaffold and ADR) and wave 1 (core + `ProcessMap` + sliders + metric switch + KPI strip) produce what every vendor demo opens on. Variants and cases in wave 2; time-axis views and conformance in wave 3; comparison, replay, object-centric and ELK in wave 4.

## 2. What the market actually shows

Thirteen products, one shared skeleton. Every one has a DFG with two abstraction sliders and a metric switcher; almost every one has a variant list coupled to the graph; most have conformance against a BPMN reference and a case-level drill-down. Differences are at the margins.

| Visualization             | Ubiquity | Who does it best         | What "best" means                                                                                                                                            |
| ------------------------- | -------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Process map / DFG         | 13/13    | Disco, Celonis, Apromore | Two sliders (activities, paths) that never change statistics; map stays connected; secondary metric label; "N paths hidden"                                  |
| Variant explorer          | 12/13    | Celonis, Power Automate  | Sequence chips per variant with Cases / Coverage % / median duration; multi-select merges into one graph; "Variant DNA" strip                                |
| Performance overlay       | 13/13    | Apromore, Appian         | Independent node metric and edge metric; size = one metric, colour = a second; median default, mean/trimmed-mean optional                                    |
| Conformance overlay       | 11/13    | UiPath, IBM, Celonis     | Three-colour (log-only / model-only / both) on the graph; violation types with % of cases; conforming vs non-conforming KPI pair; conformance-rate-over-time |
| Case table + timeline     | 10/13    | Power Automate, Apromore | Variant → case table → single-case Gantt with parallel flags and waiting time                                                                                |
| Rework / loops            | 9/13     | Power Automate           | Split self-loop vs loop KPIs; red/blue halo for loop starters/closers                                                                                        |
| Token animation           | 7/13     | Disco, Apromore          | Tokens per case; synchronized-start mode; tokens route around skipped activities; congestion = bigger blobs                                                  |
| Comparison                | 6/13     | Power Automate           | Up to three views; green = common, blue = A only, red = B only                                                                                               |
| Social / handover network | 6/13     | IBM, Power Automate      | Resource × activity map; circle size = interaction frequency                                                                                                 |
| Object-centric (OC-DFG)   | 4/13     | Celonis                  | Shared activities merge into one node with per-object-type counts and colour squares; global slider synced with per-type sliders                             |
| Root-cause panel          | 10/13    | Power Automate, ARIS     | Decision tree of attribute splits; "convert rule to filter"                                                                                                  |
| Dotted chart              | 1/13     | ProM / bupaR only        | Absent from commercial tools — a research/analyst view, cheap to build, differentiating in demos                                                             |
| Performance spectrum      | 0/13     | ProM PSM only            | Segments × time with one line per case; shows batching, FIFO violations, queue build-up                                                                      |

Common KPI vocabulary: throughput / cycle / lead time (vendor-specific synonyms; Celonis "TPT"), activity frequency vs case frequency (events > cases when loops exist), max repetitions, rework rate, conformance / fitness %, coverage % of selected variants, variant count, median vs mean vs trimmed mean, automation rate.

### Interaction patterns that recur

Two sliders, not one: activities first, then paths; auto-position on load (Power Automate "Autoslider", UiPath "Default"). Sliders are view-only and never change the statistics (Disco and QPR state this explicitly). Kept nodes stay connected to start and end (Disco, Apromore, pm4py's `keep_all_activities_connected`). Click a node or edge → a pre-built filter (with / without / starts with / ends with / follower). Hover → metric readout plus highlight of incoming and outgoing paths. Vertical layout is the default (Celonis, ARIS, mpmX); a TB/LR toggle is common. Variants and the graph are coupled: select variants, the graph re-renders from those cases and shows coverage %. Drill path is always variant → case table → single case.

### Design ideas worth borrowing (and what to skip)

Borrow: Disco's secondary metric label and clickable slider percentages; Celonis's KPI-strip / graph / collapsible-filter-bar layout and the "median over mean" guideline; Apromore's backbone layout (most frequent path on one straight line) and invert toggle (hide the _most_ frequent to see the exceptions); Power Automate's Variant DNA strip and rework halo; UiPath's conformance-rate trend; the three-colour conformance convention (IBM/UiPath); Celonis's per-object-type colour squares; the associative "excluded stays visible in grey" model of the BI-embedded tools (mpmX, process.science). Skip: token animation as a wave-1 feature (decorative unless linked to a time slider and case count), 3D views, subway-map metaphors, root-cause decision trees (an analytics feature, not a visualization primitive).

### What the visual-analytics literature adds

The 2026 _Process Science_ review of Apromore, Celonis, Disco and ProM finds three systematic gaps: no preview of what a slider or filter will do, no exploration history, and no visible reference to what was filtered out. The 2025 BISE taxonomy of 405 real process mining questions gives a persona backbone: analysts ask "where is the bottleneck / which variants dominate / what drives duration"; process owners ask "on track vs target / which segment deviates / before vs after"; auditors ask "which cases skipped approval, show me the evidence". Auditors end at a table, not a map. Fuzzy-miner encoding rules (brightness, size and saturation for significance; cluster the insignificant) remain the standard.

Accessibility has no process-mining-specific guidance anywhere; general dataviz rules apply and no commercial tool documents keyboard traversal of the graph. That is an opening: brand-ui already enforces non-colour-only encodings (`FlowNode` tone glyphs, #387) and keyboard drill-down in charts.

## 3. Where it lives — the package decision

### The constraint

The repo's dependency rule is two layers and one-way: `tokens → ui/icons → data/ai/flow/maps/charts/marketing/editor/viewer/terminal` (`CLAUDE.md`, `architecture-review.md` D1; ADR 0012 calls `editor → charts` "a forbidden sideways dependency"). `ai` lists `charts` only as a devDependency and its source explicitly avoids importing it. There is no precedent for a package that composes other leaves, and ADR 0012's answer to "two leaves need the same thing" was to move it _down_ to `ui`.

`flow` itself is a wrap-an-engine leaf: branded React Flow building blocks (ADR 0018). Its runtime dependencies are `tokens`, `ui`, `icons`, `@xyflow/react`, dagre, d3-force. A process mining set needs, beyond the graph: sequence bars (`charts` marks), a virtualized case table (`data/DataTable`), a case timeline (`charts/Gantt`), KPI tiles (`ui/MetricCard`), a dotted chart and performance spectrum (`charts` scales and `ChartFrame`), and filter chips (`data/FilterBar`).

### Options considered

| Option                                                                              | Shape                                                                                        | Consequence                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Everything in `flow`                                                             | Map, variants, dotted chart, case table all in `packages/flow`                               | Either `flow` imports `charts`/`data` (sideways, forbidden; every flow consumer pulls visx and TanStack) or it re-implements bars, tables and timelines (`charts:reuse:check` rejects this). Rejected.                                                                                                                                                                                                                    |
| B. Views in their leaves, no shared core                                            | `ProcessMap` in `flow`, `VariantExplorer` in `charts`                                        | Each package would define its own DFG/variant types and re-derive them; no place for the algorithms or the coordinated behaviour. Rejected.                                                                                                                                                                                                                                                                               |
| C. Headless core at layer 1, views in their leaves, composition in a registry block | `components-process-core` beside `icons`; `flow` and `charts` import it; a block wires it up | Keeps the two-layer rule but scatters one product over three packages and a copy-own block; the coordinated selection behaviour has no importable home. Considered; not chosen.                                                                                                                                                                                                                                           |
| **D. Layer-3 composite `@elabs-ai/components-process`**                             | Depends on `flow`, `charts`, `data`, `ui`; core as `/core` subpath                           | One importable package, one home for the domain model and the coordinated behaviour, publishable on its own. Cost: an ADR introducing a third layer, the dependency line in three governance files, `PKG_ORDER`/`PKG_PURPOSE`, an `area:process` label, a rule file, and a consumer that installs it pulls React Flow, visx and TanStack together (acceptable: that consumer is building a process explorer). **Chosen.** |

Binding rule that comes with D: **if the process package needs a primitive that does not exist, it is added to the base package that owns that kind of thing (`flow` for graph, `charts` for marks and scales, `data` for tables and filters, `ui` for controls, `tokens` for ramps), or an existing base component is enhanced. The process package never contains a generic edge, mark, table or control.** The architecture review's D1 and a new `process:reuse:check` gate (mirror of `charts:reuse:check`) enforce this.

### Primitives that go into the base packages first

| Package  | Addition                                                                                                                                                      | Why                                                                                     | Effort |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------ |
| `flow`   | `FlowWeightedEdge` — stroke width from `data.weight`, min-max scaled into `widthRange`, optional sequential colour from `data.value` through the RM-018 ramps | Every DFG, and any "how much flows here" diagram                                        | S      |
| `flow`   | Edge label pill via `EdgeLabelRenderer` (HTML, token-styled)                                                                                                  | Frequencies and durations on edges; SVG `<text>` cannot theme, wrap or carry two values | S      |
| `flow`   | `FlowSelfLoopEdge` — small arc at a node's top/right with its own label                                                                                       | Self-loops are the most common rework signal; React Flow draws them degenerate          | S      |
| `flow`   | Back-edge variant (dashed, distinct token) and `layoutFlow` returning `backEdges`/`selfLoops` from dagre's cycle breaking                                     | Rework loops must look different from forward flow; dagre does not lay out self-loops   | S–M    |
| `flow`   | `layoutGraph` gains `"layered-tb"` (today only `"layered-lr"`)                                                                                                | Process maps default to top-to-bottom                                                   | XS     |
| `flow`   | `Legend` continuous variant — width ramp and colour ramp with min / median / max labels                                                                       | Frequency and duration encodings need it; today `Legend` is categorical only            | S      |
| `flow`   | Optional `layoutFlowElk()` behind `import("elkjs/lib/elk-api")` with the worker (ADR 0019)                                                                    | Orthogonal routing, self-loop placement, compound nodes for activity groups; wave 4     | M      |
| `charts` | Canvas mark layer inside `ChartFrame` for >20k points, with the same datapoint/keyboard contract as the SVG layer                                             | Dotted chart and performance spectrum; also unblocks large scatter/strip charts         | M      |
| `charts` | `Gantt` accepts gap bands (waiting time between bars on one row)                                                                                              | Case timeline; generally useful for any schedule with idle time                         | S      |
| `data`   | `FilterBar` chip variant with a secondary count ("excluded 1 204") and a removable state                                                                      | Filter breadcrumbs with "what was removed"; useful to every data-app                    | S      |
| `ui`     | none expected — `Slider`, `ToggleGroup`, `SegmentedField`, `Switch`, `MetricCard`, `Table` cover the controls                                                 |                                                                                         |        |

## 4. Requirements catalogue

Grouped by persona question; each requirement names the view that answers it.

| #   | Requirement                                                                                                                             | Persona          | View                              | Wave       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------- | ---------- |
| R1  | Show the discovered process as a directed graph of activities with start/end markers                                                    | all              | ProcessMap                        | 1          |
| R2  | Abstract by activities % and paths %, view-only, graph stays connected, "N hidden" badge                                                | analyst, owner   | ProcessMap + AbstractionControls  | 1          |
| R3  | Switch metric layer: frequency (absolute, case, max repetitions) / performance (median, mean, min, max, total) / rework                 | analyst          | MetricLayerSwitch                 | 1          |
| R4  | Independent node and edge metric, optional secondary label                                                                              | analyst          | ProcessMap                        | 1          |
| R5  | Encode frequency as edge width + node saturation; performance as sequential colour + label; never colour alone                          | all              | ProcessMap, ScaleLegend           | 1          |
| R6  | Hover: metric readout + highlight in/out paths; click: select (tri-state) and emit filter intent                                        | all              | ProcessMap                        | 1          |
| R7  | KPI strip: cases, events, variants, median throughput, rework rate, conformance %                                                       | owner            | ProcessKpiStrip                   | 1          |
| R8  | TB/LR toggle, fit-to-view, zoom, minimap for large maps                                                                                 | all              | ProcessMap (reuses flow)          | 1          |
| R9  | Variant list: sequence chips, count, coverage %, cumulative coverage, median duration; multi-select; top-N / coverage slider            | analyst, owner   | VariantExplorer                   | 2          |
| R10 | Selecting variants re-derives the map from those cases and shows coverage                                                               | analyst          | coordinated                       | 2          |
| R11 | Case table with attributes, duration, variant id, conformance flag; export CSV (`data/to-csv`)                                          | auditor          | CaseTable                         | 2          |
| R12 | Single-case timeline with activity durations and waiting time                                                                           | auditor, analyst | CaseTimeline (Gantt)              | 2          |
| R13 | Filter breadcrumbs showing the active filter chain, removable, with "excluded" counts                                                   | all              | ProcessFilterBar                  | 2          |
| R14 | Dotted chart: case rows × time, colour by activity, sort by start/end/duration, absolute/relative time                                  | analyst          | DottedChart                       | 3          |
| R15 | Performance spectrum: segments × time, one line per case, coloured by duration class                                                    | analyst          | PerformanceSpectrum               | 3          |
| R16 | Conformance: reference model (happy path or BPMN), three-colour overlay, violation list with % cases, conforming vs non-conforming KPIs | auditor, owner   | ConformanceOverlay, ViolationList | 3          |
| R17 | Side-by-side or superimposed comparison of two logs/segments with diff colouring                                                        | owner            | ProcessCompare                    | 4          |
| R18 | Token replay with time slider and live case count; synchronized-start mode                                                              | demo             | ProcessReplay                     | 4          |
| R19 | Object-centric DFG: per-object-type colour, merged shared activities, per-type counts                                                   | analyst          | ProcessMap (OC mode)              | 4          |
| R20 | Handover / social network between resources                                                                                             | analyst          | reuse `layoutGraph("force")`      | 4          |
| R21 | Accept raw event log or pre-aggregated graph; compute in a worker above a size threshold                                                | all              | core                              | 1          |
| R22 | Tri-state selection driven from outside (an associative selection engine) or computed locally                                           | all              | all                               | 1          |
| R23 | Table twin for every graph view; keyboard traversal of nodes and edges; reduced-motion respected                                        | all              | all                               | 1 onward   |
| R24 | Works in both themes, all densities, `decoration` dial; `audit --strict` clean                                                          | all              | all                               | every wave |

## 5. Architecture

### 5.1 Core (`@elabs-ai/components-process/core`)

Pure TypeScript, no React, no DOM, no runtime dependencies. Mirrors bupaR's grammar (the most complete published metric spec, MIT) and pm4py's semantics; borrows algorithms from pm4js (BSD-3) where useful, ported and typed rather than depended on.

```ts
// Input — flat rows are the lingua franca; adapters produce them.
interface EventRow {
  caseId: string;
  activity: string;
  timestamp: string | number | Date;   // completion time by default
  startTimestamp?: string | number | Date;
  resource?: string;
  lifecycle?: "start" | "complete";
  attributes?: Record<string, string | number | boolean | null>;
}
interface EventLog { events: EventRow[]; caseAttributes?: Record<string, Record<string, unknown>> }
// adapters: fromCsv(), fromXes() (IEEE 1849 concept/time/org/lifecycle extensions), fromOcel(objectType)

// Derived model — also the pre-aggregated input shape.
interface ProcessGraph {
  activities: ActivityStats[];        // id, label, instances, cases, isStart, isEnd, duration stats
  transitions: TransitionStats[];     // source, target, count, caseCount, duration samples/stats, isSelfLoop, isBackEdge
  startActivities: Record<string, number>;
  endActivities: Record<string, number>;
  totals: { cases: number; events: number; variants: number };
}
interface Variant { id: string; sequence: string[]; count: number; share: number; cumulativeShare: number; caseIds: string[]; duration: DurationStats }

type FrequencyMode = "absolute" | "absolute_case" | "relative" | "relative_case" | "relative_antecedent" | "relative_consequent" | "max_repetitions";
type PerformanceAgg = "median" | "mean" | "min" | "max" | "sum" | "p90" | "trimmed_mean";
type FlowTime = "idle_time" | "inter_start_time";

discoverGraph(log): ProcessGraph
extractVariants(log): Variant[]
abstractGraph(graph, { activities: 0..1, paths: 0..1, keepConnected: true, invert?: boolean }): ProcessGraph & { hidden: { activities: number; paths: number } }
aggregatePerformance(graph, { agg, flowTime, unit })
detectRework(log): { selfLoops, loops, caseReworkRate, perActivity }
filterLog(log, FilterSpec[]): EventLog      // with / without / startsWith / endsWith / follower / attribute / duration
tokenReplay(log, model): ConformanceResult  // wave 3
segments(log): SegmentOccurrence[]          // for performance spectrum
activityColorScale(graph): ActivityColorScale  // frequency-ranked, --chart-1..11 + "other"
```

Design rules for core: deterministic, streaming-friendly (single pass per trace), duration samples kept as sorted arrays up to a cap then a t-digest, min-max and quantile scaling helpers exported so components share one visual scale. Everything is fixture-tested against a small synthetic log and one public log (a BPI Challenge 2012 subset, ~13k cases, is the usual benchmark). `createProcessWorker()` runs `discoverGraph`/`extractVariants` off-thread above ~50k events.

### 5.2 Components

| Component                              | Composes (base packages)                                                                  | Notes                                                                                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProcessMap`                           | `flow`: `CanvasShell`, `layoutFlow`, `ZoomControls`, `FlowMiniMap`, `Legend` (continuous) | Controlled: `graph`, `abstraction`, `metric`, `selection`, `onSelect`, `onFilterIntent`, `direction`. Uncontrolled convenience: pass `log` and it runs core internally  |
| `ProcessActivityNode`                  | `flow/FlowNode` conventions                                                               | Title, primary value, secondary value, fill saturation from frequency, tone glyphs for start/end/rework, tri-state selection styling (selected ring / neutral / dimmed) |
| `ProcessTransitionEdge`                | `flow/FlowWeightedEdge`, label pill, `FlowSelfLoopEdge`, back-edge variant                | One edge type, three renderings chosen from `isSelfLoop`/`isBackEdge`                                                                                                   |
| `AbstractionControls`                  | `ui/Slider` ×2, `ui/Switch` (invert), auto button                                         | View-only; emits `{ activities, paths }`; shows "12 activities, 41 paths hidden"                                                                                        |
| `MetricLayerSwitch`                    | `ui/ToggleGroup`, `ui/Select`                                                             | Frequency / Performance / Rework; node metric and edge metric, lock toggle                                                                                              |
| `useProcessExplorer`                   | core                                                                                      | Coordinator: applies filter intents, recomputes graph and variants, maintains tri-state selection (5.3)                                                                 |
| `ProcessKpiStrip`                      | `ui/MetricCard`, `charts/Sparkline`                                                       | Cases, events, variants, median TPT, rework %, conformance %                                                                                                            |
| `VariantExplorer`                      | `charts/marks` (unit chips), `ui/Checkbox`, `@tanstack/react-virtual`                     | Sequence chips coloured via core's `ActivityColorScale`, shared with `ProcessMap`; coverage bar; cumulative coverage slider                                             |
| `CaseTable`                            | `data/DataTable`, `data/FilterBar`, `to-csv`                                              | Case id, start, end, duration, #events, variant, conformance, attributes; a column configuration, not a table implementation                                            |
| `CaseTimeline`                         | `charts/Gantt` (+ gap bands)                                                              | One row per activity instance; waiting time as gap bands; parallel flags                                                                                                |
| `ProcessFilterBar`                     | `data/FilterBar` (+ count chip)                                                           | Filter chain breadcrumbs, removable, "excluded" count per chip                                                                                                          |
| `DottedChart`                          | `charts/ChartFrame` + canvas mark layer                                                   | Sort and time-mode props from bupaR                                                                                                                                     |
| `PerformanceSpectrum`                  | `charts/ChartFrame` + canvas mark layer                                                   | Segments × time; duration-class colour                                                                                                                                  |
| `ConformanceOverlay` + `ViolationList` | `ProcessMap` edge/node states, `ui/Table`                                                 | Three-colour convention; violation types with % of cases; KPI pair                                                                                                      |
| `HappyPathEditor`                      | `flow/CanvasShell` editable                                                               | Draw the reference sequence for conformance                                                                                                                             |
| `ProcessCompare`                       | two `ProcessMap`s or one superimposed                                                     | Green common / blue A / red B, plus per-side stats                                                                                                                      |
| `ProcessReplay`                        | `ProcessMap` + `animateMotion` tokens + `ui/Slider`                                       | Wave 4                                                                                                                                                                  |

### 5.3 Selection and filtering model

```ts
type SelectionState = "selected" | "associated" | "excluded";
interface ProcessSelection {
  activities?: Record<string, SelectionState>;
  transitions?: Record<string, SelectionState>;
  variants?: Record<string, SelectionState>;
  cases?: Set<string>;
}
interface FilterIntent { kind: "with" | "without" | "startsWith" | "endsWith" | "follower" | "variant" | "attribute"; ... }
```

Components never filter on their own; they render `selection` and emit `onFilterIntent`. `useProcessExplorer(log)` implements the local behaviour: applies intents through `filterLog`, recomputes graph and variants, and maintains the tri-state so excluded activities render dimmed instead of disappearing. When the host application has its own associative selection engine, it maps that engine's per-value state onto `SelectionState` and translates `onFilterIntent` into the engine's selection call. Same components, two engines. This is the single most important API decision because it is what makes the set usable both in a standalone prototype and embedded in a BI platform's mashup.

### 5.4 Encoding rules (to be written into the rule file)

Edge width encodes the edge metric, linear on min-max, clamped to `[1.5, 8]` px; node fill saturation encodes the node metric using the surface → primary ramp; performance uses one sequential ramp (RM-018 `resolvePalette("sequential")`) with the value always printed on the label. Self-loops render as a top arc; back-edges dashed. Start and end get the same glyph vocabulary as `FlowNode` tones. Never encode by colour alone; every graph has a `TableView` twin toggle (activities table, transitions table). TB default; LR available. Median default for durations, mean on request. Activity colours in `VariantExplorer` come from core's `ActivityColorScale`, seeded by frequency rank so the top eleven activities get distinct hues and the rest share an "other" hatch (series pattern fills, ADR 0011).

### 5.5 Archetype

New playbook `process-explorer`: `ProcessKpiStrip` on top, `ProcessMap` centre, `VariantExplorer` in a right rail, `ProcessFilterBar` above the map, `CaseTable` in a bottom drawer, `InspectorPanel` for activity details. This is the layout every vendor demo opens on. Registry block: `process-explorer-page`.

## 6. Layout and rendering decisions

Layered (Sugiyama) layout is the standard because process maps are near-DAGs with one dominant direction; dagre and ELK both produce the Graphviz-`dot` look analysts recognise. Start with `@dagrejs/dagre` — already in `flow`, small, fine for the ≤60 activities that survive abstraction. Its gaps: no self-loop layout (draw them ourselves), no edge routing (bezier/smooth-step is acceptable), weak compound nodes. Move to elkjs (EPL-2.0, web worker) when activity grouping, orthogonal routing or the Apromore-style backbone layout is wanted; keep it behind a dynamic import so `flow` consumers who never render a process map never download it. Cache layouts by `(graph hash, direction, abstraction)` so slider drags animate node positions rather than re-layout from scratch; debounce re-layout at ~80 ms.

Rendering ceiling: React Flow is comfortable to roughly 500–1000 DOM nodes _(secondary; community reports)_. Not binding — an abstracted DFG has tens of nodes. The dotted chart and performance spectrum are the views that hit tens of thousands of marks; render those on canvas inside `ChartFrame`, not SVG.

BPMN: do not adopt bpmn-js (its licence requires a visible watermark, incompatible with a design system). Render _discovered_ models as React Flow nodes (gateway/event/task node types) so tokens, selection and theming stay consistent. If an _imported_ BPMN 2.0 XML with diagram coordinates must be shown, `bpmn-visualization` (Apache-2.0, TypeScript) is the right engine, behind the same lazy boundary. Wave 4 at the earliest.

## 7. Embedding in BI platforms

Several process mining products ship as extensions inside an associative BI platform rather than as standalone tools (mpmX and process.science are the two established ones). They prove a design point that carries over: the event log is one table, activity nodes are field values, selecting one recolours every other chart, and excluded values stay visible in grey. No open-source directed-graph extension for that kind of platform was found, and the one open-source network chart in the space was archived in 2024.

Consequences for brand-ui: the set is complementary to those products, not a competitor — its job is presales mashups, prototypes and AI-assistant surfaces where a governed extension is overkill. Concretely: accept pre-aggregated `ProcessGraph`/`Variant[]` so a platform's aggregation engine (activity, next activity, count, median duration) can feed the map directly; expose the tri-state selection; ship `docs/examples/process-explorer-external-selection` showing how an external selection engine drives `ProcessMap`. The load-script side (predecessor/successor via a previous-row function, variant string via string concatenation over a case) is documentation in the playbook, not code.

## 8. Roadmap

Detailed items live in `roadmap/process-mining/` (RM-043 … RM-068), with the wave plan and the orchestrator prompt in that folder's README.

| Wave                     | Scope                                                                                                                                                                                                                                                                           | Rough size              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 0 — foundations          | ADR + third layer + package scaffold; `flow` primitives (weighted edge, label pill, self-loop, back-edge + layout metadata, `layered-tb`, continuous `Legend`); `charts` canvas mark layer and `Gantt` gap bands; `data` count chip                                             | 1–2 weeks, all parallel |
| 1 — MVP                  | `/core` (model, adapters flat/CSV, discovery, variants, abstraction, performance, rework, filter, scales, worker), `ProcessMap` + node + edge, `AbstractionControls`, `MetricLayerSwitch`, `useProcessExplorer`, `ProcessKpiStrip`, `TableView` twin, fixtures and test doubles | 3–4 weeks               |
| 2 — explore              | `VariantExplorer`, `CaseTable`, `CaseTimeline`, `ProcessFilterBar`, coordinated behaviour, `process-explorer` playbook + registry block, external-selection example                                                                                                             | 3 weeks                 |
| 3 — time and conformance | `DottedChart`, `PerformanceSpectrum`, `tokenReplay`, `ConformanceOverlay`, `ViolationList`, `HappyPathEditor`, XES adapter                                                                                                                                                      | 4 weeks                 |
| 4 — advanced             | `ProcessCompare`, `ProcessReplay`, OCEL adapter + OC-DFG mode, handover network, elkjs adapter, CLI/manifest/docs closure                                                                                                                                                       | 4+ weeks, by demand     |

Definition of done per wave is the repo's usual: `audit --strict` clean, both themes and all densities in Storybook, a11y baseline, manifest/inventory/llms regenerated, CHANGELOG entry, and the Storybook interaction tests green — a harness-green item that fails `test-storybook` is not done.

## 9. Risks and open questions

1. **Reuse discipline.** The temptation in a layer-3 package is to write "just a small bar" locally. Mitigation: `process:reuse:check` (mirror of `charts:reuse:check`) fails on any SVG primitive, table or slider defined inside `packages/process`; the rule file names the base-package home of every kind of thing.
2. **Core scope creep.** Discovery algorithms beyond DFG (Inductive Miner, alignments) are a research programme. Boundary: DFG, variants, abstraction, performance, rework, token replay against a DFG-lifted happy path. Anything needing Petri-net alignments is out of scope unless a backend provides it.
3. **Browser-side scale.** Raw logs above a few hundred thousand events should not be computed in the browser; the pre-aggregated input path is the answer, and the docs must say so.
4. **dagre limitations** may bite on rework-heavy processes (spaghetti under dagre's cycle breaking). Mitigation: wave-0 back-edge styling plus abstraction defaults; ELK adapter in wave 4.
5. **Colour budget.** `--chart-1..12` gives twelve categorical hues; variant explorers routinely show 20–40 activities. Plan: top eleven by frequency, the rest as "other" with a hatch pattern.
6. **Licensing hygiene.** Port algorithms from pm4js (BSD-3) with attribution in `ATTRIBUTION.md`; never copy from pm4py (AGPL) or Apromore (LGPL, archived).
7. **Two React Flow surfaces** (ADR 0018). The process map is an author-built analysis surface, so `flow`/`CanvasShell` is correct; the `ai` `Canvas` is not involved. The new ADR says so explicitly.
8. **Install weight.** A consumer of `components-process` pulls React Flow, visx and TanStack. Acceptable for its audience; the ADR records it, and `/core` stays importable without any of them.

## Sources

Commercial: Celonis docs (process-explorer, variant-explorer, conformance-checker, multi-object-process-explorer, guidelines-processexplorer at docs.celonis.com); UiPath docs (working-with-process-graphs, conformance-checking at docs.uipath.com/process-mining); SAP Learning "Analyzing process flows / conformance" (learning.sap.com); Apromore documentation (documentation.apromore.org discovery/discovermodel, conformancechecking/animatelogsprocessmap); Microsoft Learn Power Automate process mining (process-map, variants, root-cause-analysis, process-compare; OCPM release plan 2026 wave 1); Appian docs pm-5.9 models; IBM Process Mining 2.0 model-conformance and widget types; Fluxicon Disco book (fluxicon.com/book: mapview, simplification, reference); QPR ProcessAnalyzer wiki (Process_Flowchart); mindzie.com; Mehrwerk MPM paper (ceur-ws.org/Vol-2374/paper6.pdf), mpmx.com, help.mpmx.com; process.science product pages (process-science.com/products).

Open source and standards: pm4py docs and source (dfg visualizer, performance variant, dfg_filtering); pm4js-core DOCS.md and npm; bupaR/processmapR docs (frequency_maps, performance_maps, dotted_chart, trace_explorer); Inductive visual Miner manual (leemans.ch/publications/ivm.pdf); Performance Spectrum Miner (github.com/processmining-in-logistics/psm; multiprocessmining.org/2020/10/06/the-performance-spectrum); Fuzzy Mining (vdaalst.com/publications/p400.pdf); OC-PM (arxiv.org/pdf/2209.09725); bpmn-js licence (bpmn.io/license); bpmn-visualization (github.com/process-analytics/bpmn-visualization-js); elkjs (github.com/kieler/elkjs; eclipse.dev/elk options); dagre deprecation issue #469; React Flow docs (layouting, edge-labels, animating-edges, performance); d3-sankey; XES (tf-pm.org/resources/xes-standard/about-xes; IEEE 1849-2016); OCEL 2.0 specification (ocel-standard.org/2.0).

Literature: "Visual Analytics Meets Process Mining: Challenges and Opportunities" (Miksch et al., Utrecht preprint); "Previews, reviews, views beyond" (Process Science, 2026, doi 10.1007/s44311-026-00057-5); process mining question taxonomy (BISE 2025, doi 10.1007/s12599-025-00971-1); Cortado concurrency-aware variants (Schuster et al., Information Sciences 2023); web-based comparative process mining (arxiv 2204.00547); "Distilling Lasagna from Spaghetti" (ACM 2017).
