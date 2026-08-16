# Scenario 04 — ETL / Workflow Pipeline Canvas

**Archetype:** Flow / Canvas
**User type:** Data engineering or integration platform developer

---

## What's needed

A visual, node-and-edge pipeline editor for designing data flows: sources connect to
transforms connect to destinations. Users drag nodes onto a canvas, connect them, and
configure each node in a properties inspector. The developer wants the canvas to look
on-brand without fighting React Flow's defaults, and wants the inspector and node
types to be easy to define without low-level styling decisions.

**Components required:**

- `AppShell` — outer shell with sidebar for saved pipelines
- `CanvasShell` — the React Flow surface wrapper with token-driven background grid
- `FlowNode` — branded node with `kind` prop variants:
  - `source` — databases, files, APIs (green accent)
  - `transform` — filter, join, map, aggregate, enrich (blue accent)
  - `destination` — data warehouse, stream, file (purple accent)
  - `error` — nodes with validation issues (destructive tone)
- `FlowEdge` — directional edge connecting nodes
- `ZoomControls` — zoom in/out/fit buttons
- `Legend` — node type color key
- `InspectorPanel` — right-rail property editor for selected node
- `SplitPanel` — canvas (left, flex) + inspector (right, fixed width)
- `Select` / `Input` / `Switch` — property fields inside the inspector
- `Badge` — node status indicator (validated / error / running / complete)
- `EmptyState` — "drag a node to get started" on the canvas
- `Button` — run pipeline, save, reset

---

## How the user would define requirements

Ideal intake:

> "Build an ETL pipeline designer. The main area is a drag-and-drop canvas where
> users assemble data pipelines from three types of nodes:
>
> - Source nodes (green): PostgreSQL, S3, REST API, CSV file
> - Transform nodes (blue): Filter rows, Join datasets, Map fields, Aggregate, Enrich
> - Destination nodes (purple): BigQuery, Snowflake, S3, Webhook
>
> Nodes connect with directional arrows. Each node has a title, an icon representing
> its type, a status badge (idle/running/error/complete), and up to 3 connection ports.
>
> Clicking a node opens a properties inspector in a right panel. The inspector shows
> the node's name (editable), its type-specific config fields, and a validation status.
>
> Toolbar: zoom in/out/fit-to-screen, run pipeline button, save button.
> Sidebar: list of saved pipelines (load/duplicate/delete).
> Use blueprint theme."

**Key decisions the user SHOULD be asked:**

- Node type taxonomy (source / transform / destination, or custom)
- Inspector fields per node type (or "I'll define them in code after scaffolding")
- Whether the canvas is read-only (view) or editable (interactive)
- Theme

**Key decisions the user SHOULD NOT need to make:**

- How to register `nodeTypes={{ brand: FlowNode }}` with React Flow
- How `FlowNode`'s `kind` + `tone` props map to visual variants
- How `CanvasShell` handles the token-driven background grid
- How `SplitPanel` handles the canvas/inspector split and resize
- How node selection state flows from the canvas to the inspector
- How `useNodesState` + `useEdgesState` + `addEdge` wire together

---

## What's currently missing

### In the plugin

| Gap                      | Status                    | Covers                                                                                         |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------- |
| `new-app` skill          | **Not built** — #122, #55 | Guided intake of node type taxonomy + inspector fields                                         |
| Flow canvas scaffold     | **Not built** — #123, #55 | Generating node type registry + inspector wiring + split-panel layout                          |
| Flow canvas playbook     | **Not built** — #83, #66  | "Canvas App = CanvasShell + FlowNode nodeTypes + InspectorPanel + SplitPanel, wired like this" |
| Custom node type recipe  | **Not tracked**           | How to extend `FlowNode` with application-specific node types beyond the base `kind` variants  |
| Visual archetype preview | **Not built** — #57       | Showing the canvas archetype before scaffold                                                   |

### In the library / templates

| Gap                                                   | Status           | Detail                                                                                                                                    |
| ----------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Flow template doesn't show inspector wiring           | **Not tracked**  | `registry/templates/flow-workspace/page.tsx` has a basic canvas + panel but doesn't show how node selection drives inspector fields       |
| Node selection → inspector state pattern undocumented | **Not tracked**  | New users must figure out the `onNodesChange` → `selectedNode` → `InspectorPanel` pattern manually                                        |
| `FlowNode` kind × tone matrix not shown in one place  | **In Storybook** | The story exists but the template doesn't illustrate multiple node types in a real pipeline                                               |
| Blueprint theme + flow canvas interaction untested    | **Not tracked**  | Blueprint's hatch/grid interaction with the React Flow background grid is a known visual layering concern                                 |
| No multi-output port pattern                          | **Not tracked**  | `FlowNode` has ports but the pattern for a node with multiple named outputs (e.g. a filter with "pass" / "fail" branches) is undocumented |

### Structural gaps being addressed by open issues

| Gap                            | Issue    | Detail                                                                                                                                                                                             |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dual canvas surface documented | **#183** | Two React Flow canvases exist (`@qlik-coe-emea/qlabs-components-ai` Canvas + `@qlik-coe-emea/qlabs-components-flow` CanvasShell) with no ADR explaining the split — a new user picks the wrong one |

### Blocking GitHub issues for this scenario end-to-end

- **#55 VP-02** — new-app skill + flow canvas scaffold
- **#83 Playbooks** — flow canvas composition recipe
- **#66 WP-09** — playbooks as agent skills
- **#183** — dual canvas documentation (user must not pick the wrong one)
- **#57 VP-04** — visual archetype preview
- **#70 WP-13** — template quality (flow workspace template needs wiring annotations)
