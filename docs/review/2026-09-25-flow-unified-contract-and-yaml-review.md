# Flow — one definition contract, harmonized with charts, and YAML-defined flows

Date: 2026-09-25 · Subject: `@elabs-ai/components-flow` 5.5.0 (`main` @ 6e38a398) and its in-repo consumers (`process`, registry blocks, CLI template), **harmonized with the charts unification plan** of the same day. The reference for how component properties are organized is an external set of chart-extension templates.

**Goal stated by the maintainer:** charts and flow follow **one logical approach**. Shareable components, props and defaults are centralized, and each component kind is described once. For flow, the end goal is that a whole flow can be defined in **YAML, including fully custom node components**, which needs one shared contract for what a custom component is. This is a review. It proposes and does not change code.

**Decisions this review builds on:**

- **From the charts plan (2026-09-25):**
  - **One source of truth.** Each chart gets one definition: data targets, defaults and grouped properties. The docs manifest, `ChartSpec`/`AutoChart`, the A2UI catalog and the `./test` double all read from it. There is no end-user property-panel editor for now.
  - **Rename with aliases.** Old names keep working for one minor, with a one-time warning, and are removed at 6.0.0.
- **Agreed between the two plans (2026-09-25, accepted by the maintainer):**
  - The shared definition base in §3 is adopted. The charts plan builds it once, as its foundation wave.
  - The charts ADR (planned as 0042, Proposed; not yet written) records the base. The flow ADR covers FlowSpec only.
  - Charts asked for three amendments, which are applied throughout this document:
    - Definitions are pure data, with no `component`.
    - Callback and `ReactNode` props are listed as `codeOnly`.
    - The shared `status` group is kept off chart containers.
- **For flow (asked 2026-09-25):**
  - **YAML is authored ahead of time** by people or coding agents. Live, agent-in-chat flows are deferred.
  - **Flow package only.** The in-chat agent graph in `@elabs-ai/components-ai` stays a separate canvas (ADR 0018).
  - **Same format as charts.** The way a component's properties are described is shared with charts and lives in `ui`.

---

## 0. How this was done

- **Flow.** Every file under `packages/flow/src` (≈115), the public barrel, the custom-node stories, the layout engines, and every consumer that builds `nodeTypes`/`edgeTypes`. Those are `packages/process`, `registry/blocks/{agent-designer-01,data-model-viewer-01,flow-builder,flow-canvas}`, `packages/cli/templates/flow-workspace.tsx`, and ai's lazy flow boundary.
- **Charts.** The charts unification plan and its verified findings brief (39 findings, F01–F39, from 8 readers, 1 synthesis and 8 skeptic verifiers). That brief is due to land as `docs/review/2026-09-25-charts-unification-review.md`, and F-numbers below refer to it. Where this review relies on a charts fact, the fact was re-checked in `packages/charts/src` (for example `warnChartOnce` in `packages/charts/src/charts/chart-breakpoint.ts:308` and `ChartContractSpec` in `packages/charts/src/test/contract.ts:107`).
- **Precedents in the repo.**
  - The A2UI catalog: spec, validator, JSON Schema, generated catalog and CLI.
  - The parked dashboard `TileRegistry`.
  - The viewer adapter registry.
  - `SchemaForm`/`fromJsonSchema` and `SpecPlayground` in `ui`.
  - ChartSpec/AutoChart.
- **Reference.** An external set of chart-extension templates the maintainer supplied (read-only, not part of this repo). The material that mattered was the bar, sankey and pie chart templates, their shared-commons and feature-module packages, the table templates' shared styling-panel helpers, and a spec-extraction pipeline.

## 1. Verdict

**Charts and flow have the same disease.** Each has good parts, but neither has a layer that describes a component kind once.

| Symptom                                    | Charts (F-numbers from the charts brief)                                                    | Flow (§2 below)                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Flat, self-contained prop/data types       | F01, F02: every container declares its own flat interface; existing mixins adopted unevenly | §2.1: every node/edge data type stands alone; no base type                  |
| Defaults live at destructuring sites       | F01, F36: literal defaults per container; seven documented defaults contradict the code     | §2.4: `172 × 40` ×3, `strokeWidth={1.5}` ×5                                 |
| Several hand-kept descriptions of the kind | F03: at least eight parallel descriptions of chart types drift                              | §2.1: type keys exist only in docstrings; eight hand-built `nodeTypes` maps |
| Same concept, different name/shape         | F04–F07, F11–F21: legend, tooltip, colour, formatting, loading, sizing, interaction names   | §2.2, §2.6: two tone vocabularies; `kind`/`title`/`handles`/state collide   |
| No data-role contract in public            | F15: the per-family role table exists only behind `./test`                                  | §2.3: no port contract; four port-id conventions                            |
| No editing layer                           | F39: no property-panel layer; `FormSpec` cannot express chart groups                        | §2.7: `InspectorPanel` knows no fields; every consumer hand-writes a form   |
| Docs miss inherited props                  | F10: the docs manifest ignores `extends`, so containers restate mixin props                 | Node/edge data types are not in the docs manifest at all                    |

So the cure should be **the same cure, built once**: one small, React-free **definition base in `ui`** that both packages use. `defineChart` and `defineFlowNodeType`/`defineFlowEdgeType` become thin, package-specific wrappers around it. §3 is that shared contract. §4 applies it to flow, and §5 records what was agreed with the charts plan.

The YAML goal then needs no new concepts. A FlowSpec document refers to node definitions by `type`, the same way a ChartSpec refers to a chart definition by `type`.

## 2. Flow unification debt (worth fixing with or without YAML)

### 2.1 No base data types

Every data interface stands alone (`extends Record<string, unknown>`):

| Interface                 | Location                                            | Fields                                                                                                                     |
| ------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `FlowNodeData`            | `flow-node/flow-node.tsx:37`                        | `title`, `subtitle?`, `kind?` (eyebrow text), `icon?: ReactNode`, `tone?` (inline union), `handles?`, `footer?: ReactNode` |
| `FlowGroupNodeData`       | `flow-group-node/flow-group-node.tsx`               | `title`, `icon?`, `collapsed?`, `childCount?`, `tone?: FlowGroupTone` (union declared again at `:9`)                       |
| `FlowPlaceholderNodeData` | `flow-placeholder-node/flow-placeholder-node.tsx:6` | `label?` (**not** `title`), `onActivate?` (a function)                                                                     |
| `FlowWeightedEdgeData`    | `flow-weighted-edge/flow-weighted-edge.tsx`         | `weight`, `scaleGroup`, `value`, `valueDomain`, `label`, `secondaryLabel`, `path`, `variant`, `labelProps`, `tokens`, …    |
| `FlowSelfLoopEdgeData`    | `flow-self-loop-edge/flow-self-loop-edge.tsx`       | declares `weight`, `scaleGroup`, `label`, `secondaryLabel`, `labelProps`, `tokens` again; adds `loopRadius`, `loopLabel`   |
| `FlowButtonEdgeData`      | `flow-button-edge/flow-button-edge.tsx:5`           | `label?` (here it is an aria-label, not pill text), `onInsert?` (a function)                                               |
| `FloatingEdgeData`        | `flow-floating-edge/flow-floating-edge.tsx`         | `anchors?` (no `Flow` prefix)                                                                                              |

`FlowEdge`, `FlowSmartEdge` and `FlowFloatingEdge` have no `Brand*Edge` alias. The only type key with a constant is `FLOW_GROUP_NODE_TYPE = "group"`. The others (`brand`, `placeholder`, `button`, `smart`, `floating`, `weighted`, `self-loop`) exist only in docstrings. Eight consumer sites hand-build `nodeTypes`/`edgeTypes`, for example `packages/process/src/process-map/process-map.tsx:149-150` and `packages/cli/templates/flow-workspace.tsx:44`.

Some edges also depend on node data without saying so. `FlowSmartEdge` reads `data.handles` from whatever node it touches, and `FlowSelfLoopEdge` reads `data.title`.

### 2.2 Two tone vocabularies, four hand-rolled tone maps, no `cva`

- Flow uses `default | accent | success | warning | destructive`, declared twice (inline in `FlowNodeData`, and `FlowGroupTone`).
- `ui` uses `StatusTone = neutral | info | success | warning | destructive` (`packages/ui/src/components/status-badge/status-badge.tsx:72`), next to the seven-value `Status` enum. FlowNode borrows `STATUS_TONE_ICONS` but invents `accent` (a star).
- There are separate tone/status maps in `FlowNode` (`toneRing`/`toneIcon`/`toneIconColor`/`toneLabel`), `FlowGroupNode` (`toneMark`/`toneInk`), the custom-node story (`statusBorder`), agent-designer (`RUN_BORDER`) and process (`CONFORMANCE_STATE_ENCODING`).
- Flow has no `cva` anywhere, which conflicts with the conventions rule for any visual axis with more than one value.

This is the flow twin of charts' colour and palette drift (F06, F32).

### 2.3 No primitives for custom nodes

- **The handle class string is copied** in `flow-node.tsx`, `flow-placeholder-node.tsx`, `flow-group-node.tsx` and `custom-nodes.stories.tsx`. The blocks have drifted from it: agent-designer uses `!size-2.5`, and data-model-viewer uses a 1px invisible anchor.
- **The card class is copied** in FlowNode, the custom-node story (`nodeCardClassName`) and agent-designer's `card()`.
- **`FlowGroupNode` is missing the proxied focus indicator** (`[[data-id]:focus-visible_&]:focus-ring-static`). The only node in flow that has it is `FlowNode`.
- **Port handle ids follow four conventions:** `in:x`/`out:x` in the story, `in`/`out`/`port:kind` in agent-designer, `${column}:${side}` in data-model-viewer, and bare side names in FlowNode.
- **The "custom node contract" is a story docblock:** three conventions at `packages/flow/src/custom-nodes/custom-nodes.stories.tsx:10-21`.

### 2.4 Copy-paste geometry and edge boilerplate

- **The side→`Position` map is defined twice:** `flow-node/flow-node.tsx:116-121` and `flow-smart-edge/smart-edge-geometry.ts:16-29`.
- **The node-size fallback `172 × 40` plus a size helper appears three times:** `flow-layout/flow-layout.ts:71`, `flow-layout/layout-graph.ts:40` and `flow-layout/layout-flow-elk.ts:111`. Helper-lines' `nodeRect` and smart-edge's `toRect` are variants of it.
- **Edge boilerplate is repeated.** `strokeWidth={1.5}` is hard-coded in five edge files (`flow-edge`, `flow-button-edge`, `flow-smart-edge`, `flow-floating-edge`, `flow-edge-tokens`), even though `DEFAULT_EDGE_WIDTH_RANGE` exists. This is the same pattern as charts' literal `animationDuration = 1100` beside an unused constant (F18).
- **There are three edge-label renderers:** `EdgeLabelPill`, FlowButtonEdge's own `EdgeLabelRenderer` block, and agent-designer's label div.
- **"Selected" looks different per edge.** Weighted and self-loop switch to `--ring` and get 1.5px wider. FlowEdge, Smart, Floating and Button ignore `selected`. The blocks use `--flow-edge-strong`.

### 2.5 Data that cannot be serialized

These fields block both YAML and any save/load round trip:

- `icon` and `footer` are `ReactNode`.
- `onActivate` (placeholder) and `onInsert` (button edge) are **functions stored in `data`**. That forces consumers to re-attach handlers after every state change (`registry/blocks/flow-builder/flow-builder.tsx`).
- `use-flow-groups/group-operations.ts:56` (`COLLAPSED_STATE_KEY`) stores whole node and edge objects inside a group's `data` while it is collapsed.

### 2.6 Name collisions

| Name      | Meanings in use                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`    | Eyebrow text in `FlowNodeData`; the type discriminator in agent-designer                                                                       |
| `title`   | Flow nodes; `name` in agent-designer; `label` in the placeholder and in the home fixture                                                       |
| `handles` | `{source?: Side[], target?: Side[]}` in flow; `{source: boolean, target: boolean}` in ai's `Node` (`packages/ai/src/node.tsx:19`)              |
| state     | `tone`; `status` (story); `runStatus` + `issue` (agent-designer); `selectionState` (process); `dimmed`/`lit`/`highlighted` (data-model-viewer) |
| `variant` | Weighted edge forward/back; Legend categorical/scale                                                                                           |

### 2.7 The inspector is an empty box

`InspectorPanel` is a pure container (`inspector-panel/inspector-panel.tsx`) that knows no fields. Every consumer hand-writes the form:

- the stories use a hand-written `<dl>`
- flow-builder's `NodeInspector` keeps a local `TONES` array
- agent-designer's `NodeInspector` (`registry/blocks/agent-designer-01/inspector.tsx:490`) branches on `data.kind` thirteen times

`ui` already ships `SchemaForm` + `fromJsonSchema` (`packages/ui/src/components/schema-form/from-json-schema.ts:308`), but nothing in flow uses them.

### 2.8 Smaller gaps

- **`data-slot` is missing on the root** of `FlowGroupNode`, `FlowPlaceholderNode`, `CanvasShell`, `InspectorPanel` and `Legend`. The last two run as known failures (`scripts/check/contract-known-failures.json:15-16`).
- **Hard-coded English:** tone labels, group aria text, "Add node", "Insert node on edge", self-loop and back-edge names, and the ZoomControls labels. Only `InspectorPanel` uses `t()`. Charts has the same gap (F29).
- **Group re-renders:** `FlowGroupNode` calls `useNodes()` (`flow-group-node.tsx:77`), so every group re-renders on every node change. The weighted edge deliberately avoids this pattern.
- **ADR 0018 is out of date:** it still lists `@xyflow/react` as a regular dependency, but it is a peer.

## 3. The shared contract: one definition base for charts and flow

### 3.1 What we take from the reference, and what we leave

Both reviews read the same reference and reached the same conclusions.

**Taken:**

- **Four concerns kept apart per component kind:** stored defaults, the data-shape contract (data targets), the editing metadata, and the render component. The render component reads only resolved values.
- **A default is declared once.** The reference declares its bar-chart grouping default twice, in the defaults file and in the panel field, and the two drift.
- **Composition by reference.** Shared groups are composed and overridden by key, never copied.
- **Pure predicates** for applicability (`appliesWhen`), tiers (essential/advanced), pure normalizers, versioning with migration adapters, and a completeness test over the catalog.

**Left behind**, per the charts brief's "not transferable" list:

- engine query paths and expressions
- soft properties
- host capability negotiation
- mutating hooks, which become pure `normalize` functions here
- string-keyed `uses:` templates, which become **typed group modules** here

### 3.2 The base, in `ui`

The base is React-free: types, pure helpers and generators. It lives in `ui` because charts and flow are both layer 2, may not import each other, and both already depend on `ui`. The same arrangement exists today for `ui`'s colour-scale helper (`packages/ui/src/lib/color-scale.ts`), which charts and maps share.

```ts
// A prop group: one concern, declared once. Used by charts AND flow.
export const headerGroup = definePropGroup({
  id: "header",
  fields: {
    title: field.string({ tier: "essential", description: "Primary label." }),
    subtitle: field.string({ tier: "advanced" }),
    description: field.string({ tier: "advanced" }),
  },
});
// → headerGroup.defaults   (as const, satisfies Required<HeaderProps>)
// → headerGroup.resolve(props, ctx)
// → headerGroup.schema     (JSON Schema fragment)

// A component definition: identity + groups + own fields + targets + lifecycle.
// Pure data plus pure functions — no component, no React, no engine import.
export interface ComponentDefinition<TProps, TCtx, TTargets> {
  id: string; // what a document's `type:` refers to
  version: number;
  label: string;
  description: string;
  groups: readonly PropGroup[]; // typed modules, never string keys
  fields: FieldMap<TProps>; // own props, same field vocabulary
  codeOnly?: readonly (keyof TProps & string)[]; // callbacks, ReactNode, render* — no field kind
  defaults?: Partial<TProps>; // per-kind overrides of group defaults
  targets: TTargets; // charts: data roles · flow: ports
  normalize?: (props: TProps, ctx: TCtx) => TProps; // pure
  aliases?: Record<string, string>; // rename-with-aliases, warn once, removed at 6.0.0
  migrate?: (props: unknown, fromVersion: number) => unknown;
}
```

**A definition is a pure, React-free module.** It never holds the component. The component is bound separately:

- in charts, in a registry module that only `AutoChart` and the A2UI catalog import;
- in flow, in `createFlowRegistry` entries `{ definition, component }` (§4.2).

There are two reasons. Charts' `./test` double may never import an engine (the `charts-test-double` check rule). And a consumer that imports one chart or one node must not pull in every component. Icon names follow the same split: the name lives in the definition, and the icon map lives in the registry.

**Code-only props** are callbacks and `ReactNode`/`render*` props: `onDatapointClick`, `formatValue`, `children`, and flow's `footer`. They have no field kind. The definition lists them by name in `codeOnly`, so the completeness gate can still prove that every TS prop is accounted for, and the generators skip them. Flow's `onActivate`/`onInsert` become declared events instead (§4.1).

**The field vocabulary** is one small set of kinds: `string | number | integer | boolean | enum | color | responsive | object | array`. Each field carries `default` (a value, or a pure function of context), `min`/`max`, `description`, `tier` (`essential | advanced`), `appliesWhen(props, ctx)` and `deprecated`. The kinds deliberately include `color`, `responsive` and object arrays. Charts needs them (F39: `palette`, `plotHeight`, `series[]`, `analytics[]`), and flow needs them too (ports, edge colour).

**One resolution order:** user prop > the kind's `defaults` override > the group default > the theme token. This is `resolveProps(definition, props, ctx)`, which is memoized in the component, so render code only ever sees resolved values.

**Target descriptors share a shape:** `{ id, label, description, min, max }`. Charts' data roles extend it with the field role (`x`, `series`, `group`), seeded from `ChartContractSpec` (`packages/charts/src/test/contract.ts:107`). Flow's ports extend it with `side`, `direction` and `accepts`.

**The generators, written once, read any definition:**

- JSON Schema: validation, and editor autocomplete for YAML.
- Docs-manifest rows, with group provenance. This fixes F10 for both packages, because the manifest reads definitions instead of TS `extends`.
- A2UI catalog entries.
- `FormSpec` for `SchemaForm`. It is built when flow's inspector needs it; charts defers its editor.

**One spec convention for documents:**

- A document names a definition by `type`.
- Validators never throw and return `{ ok, value, issues }`, where each issue is `{ path, code, message }`. That is the shape `ui`'s `SpecPlaygroundError` already uses (`packages/ui/src/components/spec-playground/spec-playground.tsx:30`), so both specs plug into `SpecPlayground` unchanged.

**Guards that lock it together**, following the house pattern already used for `CHART_TYPES`:

- **Field metadata is locked to the TS prop type** by `satisfies` plus a type test.
- **A completeness test** checks four things:
  - every TS prop of a kind is a field, a group field or `codeOnly`;
  - every kind has defaults and targets;
  - every registry entry binds a component;
  - every example document validates.
- **`warnChartOnce` generalizes** to a `ui` `warnOnce`, which the alias layer uses in both packages.

### 3.3 Shared groups versus package groups

Only groups that both packages genuinely use live in `ui`. The rest stay home.

| Group                                                                     | Lives in | Used by                                                  |
| ------------------------------------------------------------------------- | -------- | -------------------------------------------------------- |
| `header` (title, subtitle, description)                                   | `ui`     | chart frames/specs; flow nodes, groups                   |
| `a11y` (accessibleLabel, accessibleDescription)                           | `ui`     | every chart family (F02, F30); flow canvas, nodes, edges |
| `status` (`StatusTone`/`Status`, plus a second channel)                   | `ui`     | chart marks/cards; flow nodes, groups, edges             |
| legend, tooltip, axes, colour, value labels, navigator, selection, motion | charts   | chart kinds (the charts plan's taxonomy)                 |
| ports, handles, card, edge stroke, edge label, size                       | flow     | flow node and edge kinds                                 |

A group moves into `ui` only when a second package needs it, the same rule the conventions already apply to subpaths.

**Watch the name `status`.** On chart containers, `status` is already the documented loading alias (`"loading" | "ready"`, conventions.md "Loading & streaming states"). So the shared `status` group (`StatusTone`) is **never applied to chart containers**. Charts uses it only on surfaces that carry a tone (marks, cards). Flow nodes, groups and edges have no loading alias, so on flow `status` always means the tone. Nobody should wire both meanings onto one component.

## 4. Flow on the shared contract

### 4.1 The custom-component contract

`defineFlowNodeType` is `ComponentDefinition` plus the three things only a canvas has: ports as targets, capabilities, and events. Built-ins are declared through the **same** helper, so a custom type can do everything a built-in can. A custom component is two pieces: a pure definition, and the React component bound to it in the registry.

```ts
// risk-score.definition.ts — pure data; imported by validators, schema generators, tests
export const riskScoreNode = defineFlowNodeType({
  id: "acme/risk-score", // namespaced for custom types; YAML `type:` refers to it
  version: 1,
  label: "Risk score",
  description: "Scores an input and flags anything above the threshold.",
  icon: "gauge", // a name; the icon map lives in the registry
  groups: [headerGroup, statusGroup], // from ui, shared with charts
  fields: {
    threshold: field.number({ default: 0.5, min: 0, max: 1, tier: "essential" }),
  },
  targets: {
    // ports: the flow extension of the shared target shape
    in: { direction: "input", side: "left", accepts: ["score"], max: 1 },
    out: { direction: "output", side: "right" },
  },
  capabilities: { deletable: true, connectable: true, resizable: false, duplicable: true },
  events: ["activate"], // routed to the host's onAction, never a function in data
  migrate: (data, fromVersion) => data,
});

// acme-flow-types.tsx — the only module that imports the component
export const acmeFlowTypes = [{ definition: riskScoreNode, component: RiskScoreNode }];
```

The built-in `brand` node's definition lists `codeOnly: ["footer"]`. Code users keep the `ReactNode` footer row, and YAML simply cannot express it.

`defineFlowEdgeType` is the same, minus ports, plus `path` (`bezier | smoothstep | straight`).

### 4.2 Registry

`createFlowRegistry([...builtInFlowTypes, ...hostTypes], { icons })` takes `{ definition, component }` entries. It returns `{ nodeTypes, edgeTypes, get(id), definitions(), schema() }`.

- `nodeTypes`/`edgeTypes` are the maps React Flow needs.
- `definitions()` hands the pure half to the spec core (§4.4), which therefore never sees a component.
- Later entries win, following the tile-registry and viewer-registry precedent.
- It is passed as a prop, not held in a module global.
- `process` exports its own `processFlowTypes`, and registry blocks export theirs.
- This retires the eight hand-built `nodeTypes`/`edgeTypes` sites and gives flow a default map it has never had.

This is the flow counterpart of the charts plan's chart registry. Both are built on the same `ComponentDefinition`, so a later dashboard or A2UI surface can hold chart kinds and flow kinds side by side.

### 4.3 Primitives for custom nodes

- **`FlowNodeCard`** makes the card the node box. It carries the proxied focus indicator and a separate `selected` ring. `FlowGroupNode` gets its missing focus indicator for free.
- **`FlowPort`** carries the measurement-anchor class, the standard size and the `in:<id>`/`out:<id>` id convention. It is rendered from the definition's port targets.
- **`flowToneVariants`** is one `cva` with two separate axes, used by FlowNode, FlowGroupNode and every custom node:
  - **the tone**, driven by the shared `status` group;
  - **a flow-only emphasis** that replaces today's `accent`. It is a "featured" look that says nothing about status and keeps its star glyph as the non-colour channel.

  Emphasis lives in a flow group, not in `ui`'s `status`. Its prop name should line up with the name charts settles on for emphasis (F21), so the two packages do not end up with a third meaning.

- **One edge group** (stroke width, selected style, label pill) with its defaults declared once. All edges draw through `FlowEdgePath`.
- **Renames follow the charts policy:**
  - the placeholder's `label` becomes `title`
  - `FloatingEdgeData` becomes `FlowFloatingEdgeData`
  - flow's status tones map onto `StatusTone` (`default` → `neutral`), and `tone: "accent"` becomes the emphasis option

  Each old name keeps working for one minor with a one-time warning and is removed at 6.0.0.

### 4.4 Spec core: React-free, under a `/spec` subpath

The subpath satisfies ADR 0006: it has a lighter dependency tree (no React, no React Flow) and a real consumer (build-time and CLI validation).

```yaml
# yaml-language-server: $schema=./flow-spec.v1.schema.json
flow: "1"
title: Order pipeline
layout: { engine: dagre, direction: LR } # or elk | none (then every node needs a position)
nodes:
  - id: ingest
    type: brand
    data: { title: Ingest, subtitle: Source, status: info, icon: database }
  - id: score
    type: acme/risk-score # host-registered custom component
    data: { title: Risk, threshold: 0.8 }
    on: { activate: { name: open-score, payload: { id: score } } }
  - id: approvals
    type: group
    data: { title: Approvals }
  - id: review
    type: brand
    parent: approvals
    data: { title: Manual review }
edges:
  - id: e1
    source: ingest
    target: score
    sourcePort: out
    targetPort: in
    type: weighted
    data: { weight: 12, label: 12k }
```

The core exposes:

Every function here takes **definitions**, never components, so the subpath stays free of React.

- **`validateFlowSpec(input, definitions)`** follows the shared spec convention (§3.2). It checks unknown types, data against each type's fields and groups, duplicate ids, dangling edges, port limits and `accepts`, and unknown parents.
- **`normalizeFlowSpec(spec, definitions)`** runs `resolveProps` per node and edge, applies aliases and `migrate`, and assigns missing ids. An unknown type is a warning, as the dashboard does it.
- **`buildFlowSpecSchema(definitions)`** uses the shared JSON Schema generator, with one definition per registered type. A YAML file then gets autocomplete and validation in any editor through `$schema`.
- **`toReactFlow(spec, definitions)` / `fromReactFlow(nodes, edges)`** handle the round trip, so an edited canvas saves back to YAML.
- **`parseFlowYaml(text)`** uses the `yaml` package (a new, free dependency) instead of the editor package's `js-yaml`, because it keeps source positions. Every parse error and every validation issue `path` maps back to a line and column, so an error reads `line 14: threshold must be ≤ 1` (maintainer decision, §7).

**YAML never carries code.** A "fully custom component" is a host-registered `type` whose `data` is validated against that definition. The component is code the app registers; the YAML only names it. This is D2's "data, never code" rule, and it keeps the spec safe to load from anywhere.

**Other things that stay out of `data`:**

- **Icons are names**, resolved through an icon map the host supplies to the registry. This avoids a Lucide barrel, which the conventions forbid.
- **Group collapse** stays runtime view state and is never written into `data`.

### 4.5 Renderer and inspector

- **`FlowSpecCanvas`** takes `{ spec, registry, onAction, onChange }` and composes `CanvasShell`. It is its own component rather than a mode flag on `CanvasShell`. It runs layout from `spec.layout` through the existing `layoutFlow`/`layoutFlowElk`.
- **`FlowNodeInspector`** renders the selected node's definition through the shared `FormSpec` generator and `SchemaForm`, inside `InspectorPanel`. Essential fields come first and advanced ones sit behind a disclosure, and `appliesWhen` hides fields that do not apply. This replaces the hand-written inspectors, including agent-designer's 13-branch chain. Flow is the first consumer of the generator; charts can reuse it whenever it wants an editor.
- **Events** go from `on.<event>` to the host's `onAction(action, { node, event })`. This replaces `onActivate`/`onInsert` stored in data.

## 5. Agreed with the charts plan (2026-09-25)

The charts session adopted the seven points below, and the maintainer accepted them. The charts plan builds the base once, as its foundation wave.

1. **`defineChart` is built on the shared `ComponentDefinition` in `ui`**, not as a charts-only type. `dataTargets` is charts' extension of the shared target shape, seeded from `ChartContractSpec`.
2. **Chart prop groups use `definePropGroup`**, and `header`, `a11y` and `status` are in `ui` from day one.
3. **The field vocabulary includes `color`, `responsive` and object arrays** (F39).
4. **There is one `resolveProps`** with one resolution order: user > kind override > group default > theme token.
5. **`ChartSpec` validation adopts the shared issue shape** `{ path, code, message }`. It never throws, returns `{ ok, value, issues }`, and `ChartSpec` gains a version.
6. **The docs-manifest fix for F10 reads definitions**, so it covers flow's node and edge data as well.
7. **`warnChartOnce` becomes the `ui` `warnOnce`**, and the rename-with-aliases layer is shared.

**Charts' three amendments**, which this document now mirrors:

- **No `component` on a definition** (§3.2). Components are bound in a registry, so the charts test double and single-component imports stay engine-free. The same applies to icon maps.
- **`codeOnly`** lists callback and `ReactNode` props by name (§3.2).
- **The `status` name clash:** the shared `status` group is kept off chart containers (§3.3).

**Acceptance test for the shared base:** before it merges, it must express one chart (`BarChart`, with its data roles) **and** one flow node (`FlowNode`, with its ports). If either needs a special case in the base, the base is wrong.

## 6. Phased path

This is a recommendation only; no roadmap items have been filed. The base comes first because both packages depend on it.

| Phase                  | Delivers                                                                                                                                                                                                                                                                                                                                      | Depends on      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **A · Shared base**    | Built by the charts plan's foundation wave: the `ui` definition base (§3.2): `definePropGroup`, `field.*`, `ComponentDefinition` (with `codeOnly`, no `component`), `resolveProps`, the issue shape, `warnOnce`, the JSON Schema and manifest generators; the `header`/`a11y`/`status` groups; the acceptance test (one chart, one flow node) | —               |
| **0 · Flow unify**     | §2 fixes that don't need the base: `FlowNodeCard`/`FlowPort`, one `cva` for tone, edge defaults, geometry dedupes, `data-slot`, i18n strings, group re-render fix                                                                                                                                                                             | — (can run now) |
| **1 · Flow contract**  | `defineFlowNodeType`/`defineFlowEdgeType` on the base; `createFlowRegistry`; built-ins re-registered; renames with aliases                                                                                                                                                                                                                    | A, 0            |
| **2 · Flow spec core** | FlowSpec v1, validate, normalize, JSON Schema, the round trip, `parseFlowYaml`, the `/spec` subpath                                                                                                                                                                                                                                           | 1               |
| **3 · Flow rendering** | `FlowSpecCanvas`; the `FormSpec` generator in `ui` plus `FlowNodeInspector`; events in place of functions in data                                                                                                                                                                                                                             | 2               |
| **4 · Proof**          | Re-express `agent-designer-01` (12 custom node kinds plus its palette catalog) as YAML plus registered types; a "Flow from YAML" story; `process` exports `processFlowTypes`                                                                                                                                                                  | 3               |

Phase A is the charts plan's foundation wave. Its ADR (planned as 0042) records the base, and a separate flow ADR (Proposed) records FlowSpec v1 before Phase 2. Flow's Phase 0 can run in parallel now. Flow's Phase 1 waits for Phase A to merge.

**Phase 4 is the acceptance test for the flow track.** If agent-designer can be expressed as a YAML file plus registered types with no escape hatches, the contract is sufficient.

## 7. Open points

_Resolved 2026-09-25:_

- **Phase A:** the charts plan builds it. The charts ADR (planned as 0042) records the base, and the flow ADR covers FlowSpec only.
- **`accent`:** decided by the maintainer. It stays a separate, flow-only emphasis ("featured", with its star glyph as the WCAG 1.4.1 second channel). It is not folded into `info`, and it stays out of the shared `status` group (§4.3).
- **YAML error line numbers:** decided by the maintainer. Errors point to the exact line. `parseFlowYaml` uses the `yaml` package, which keeps source positions, so validation issue paths (`nodes[3].data.threshold`) map back to a line and column, not only parse errors (§4.4).
- **YAML for charts:** decided by the maintainer. Yes, but after flow YAML works (after Phase 4). The YAML parse-and-locate step is written generically so that it can move to the shared layer then, and `ChartSpec` becomes authorable in YAML too.

Still open:

1. **Live, agent-generated flows** are deferred. The shared A2UI generator makes a later `FlowSpecCanvas` catalog entry cheap, but it would need streaming-tolerant validation like A2UI's `invalidNodePaths`.
2. **ai's in-chat canvas** stays out of scope (ADR 0018). Its `handles` shape and edge endpoint convention keep diverging. That is accepted for now and worth recording in the flow ADR.

## Appendix: key files

- **Flow:** `packages/flow/src/index.ts`, `flow-node/flow-node.tsx`, `flow-group-node/flow-group-node.tsx`, `flow-placeholder-node/flow-placeholder-node.tsx`, `flow-button-edge/flow-button-edge.tsx`, `flow-weighted-edge/flow-weighted-edge.tsx`, `flow-self-loop-edge/flow-self-loop-edge.tsx`, `flow-smart-edge/smart-edge-geometry.ts`, `flow-layout/{flow-layout,layout-graph,layout-flow-elk}.ts`, `use-flow-groups/group-operations.ts`, `inspector-panel/inspector-panel.tsx`, `custom-nodes/custom-nodes.stories.tsx`.
- **Flow consumers:** `packages/process/src/process-map/process-map.tsx`, `registry/blocks/agent-designer-01/{nodes,edges,inspector}.tsx`, `registry/blocks/agent-designer-01/data/catalog.ts`, `registry/blocks/flow-builder/flow-builder.tsx`, `packages/cli/templates/flow-workspace.tsx`.
- **Charts (harmonization anchors):** `packages/charts/src/auto-chart/chart-spec.ts`, `packages/charts/src/auto-chart/infer-chart-type.ts`, `packages/charts/src/test/contract.ts`, `packages/charts/src/test/doubles.tsx`, `packages/charts/src/charts/chart-breakpoint.ts`.
- **Shared-layer anchors in `ui`:** `packages/ui/src/lib/color-scale.ts`, `packages/ui/src/components/spec-playground/spec-playground.tsx`, `packages/ui/src/components/schema-form/{schema-form-spec,from-json-schema}.ts`, `packages/ui/src/components/status-badge/status-badge.tsx`.
- **Precedents:** `packages/ai/src/a2ui/core/{spec,validate,schema}.ts`, `packages/ai/src/a2ui/ui-catalog.tsx`, `parked/dashboard-pack/charts-dashboard/dashboard-sheet/tile-registry.ts`, `packages/viewer/src/core/registry.ts`, `packages/cli/lib/docgen.mjs`.
- **ADRs:** 0006 (subpath exports), 0007 (presentation-layer scope), 0018 (two React Flow canvases), 0024 (viewer registry), 0034 (process as layer 3), 0037 (dashboard spec + tile registry, parked), 0039 (chart responsive contract).
- **Reference chart templates:** external and read-only, deliberately not linked from this repo.
