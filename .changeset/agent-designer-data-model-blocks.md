---
"@elabs-ai/components-cli": minor
---

Three new copy-own registry items, all built from custom React Flow nodes and edges on `@elabs-ai/components-flow`, and listed in the bundled manifest (`brand-ui search`, the MCP server):

- **`data-model-viewer-01`** — an entity-relationship view of a database. Tables are custom nodes with a row per column (key, nullability and personal-data marks), foreign keys are custom edges with crow’s-foot end marks that meet each table at the row of the column they are about. A table list by schema with search and per-schema visibility, an all-columns / keys-only / names-only switch, auto-layout, and an inspector with columns, followable relations, indexes and a readable `CREATE TABLE`. It renders a plain `DataModel` object; two samples ship (an order-to-cash schema and a star schema).
- **`agent-designer-01`** — a canvas for designing business agents. The flow (trigger, guardrail, agent, router, human approval, action) runs on solid arrows; under each agent hangs its equipment on square ports and dashed links: a model, skills, MCP servers with a switch per tool and “ask a person every time” on the tools that write, knowledge and memory. Searchable palette (drag, or click to equip the selected agent), an inspector form per node kind, design checks that point at the node they are about, a simulated test run that pauses at approvals, undo/redo and auto-layout. Three sample designs: support resolution, invoice processing, lead qualification. It edits plain data and calls no model.
- **`agent-studio-page`** — the use-case template around the designer, in the workspace shell: every design with how it ran this week, the designer flush in the shell, the skill library and the MCP servers with “used by” derived from the designs, and the runs, where a failed run opens `agent-trace-waterfall-01`.

`@elabs-ai/components-flow` also gains a `Flow/Custom Nodes` story set (stories only, no new exports): eight self-contained custom nodes — sectioned card, status states, labelled ports, node toolbar, editable fields, annotation, resizable, and the `footer` slot first — each following the three conventions `FlowNode` follows.
