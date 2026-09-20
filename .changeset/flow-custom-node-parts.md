---
"@elabs-ai/components-flow": minor
---

`@elabs-ai/components-flow` now re-exports the engine parts a custom node or edge is built from, so you can write your own node types against this package alone, with no second, direct dependency on `@xyflow/react` that could drift from the version the package is built on: `Handle`, `NodeToolbar`, `NodeResizer`, `EdgeLabelRenderer`, `getBezierPath`, `getSmoothStepPath`, `getStraightPath`, `MarkerType`, `ConnectionMode` and `useUpdateNodeInternals`, plus the types `HandleProps`, `NodeChange`, `EdgeChange` and `OnSelectionChangeParams`. Nothing changes for code that imports these from `@xyflow/react`.

The `Flow/Custom Nodes` stories and the `data-model-viewer-01` and `agent-designer-01` registry blocks import from `@elabs-ai/components-flow` only; `@xyflow/react` is no longer among those two blocks’ own dependencies.
