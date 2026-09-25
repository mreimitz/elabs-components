---
"@elabs-ai/components-flow": minor
---

Flow nodes and edges now share one tone vocabulary, one card and one set of edge defaults.

**Tones.** A node's `tone` now takes the same values as `StatusBadge`: `neutral`, `info`, `success`, `warning` and `destructive`. `info` is new. A separate `emphasis: "featured"` marks a node as highlighted with a star, which is what `tone: "accent"` meant. `FlowNode`, `FlowGroupNode` and `useFlowGroups`' `groupNodes`/`groupSelection` take both. The old values still work until 6.0.0: `tone: "accent"` renders as `emphasis: "featured"` and `tone: "default"` as `tone: "neutral"`, each with a one-time console warning. `FlowGroupTone` is deprecated in favour of `FlowToneInput`.

**Building custom nodes.** New `FlowNodeCard` (the node box with the tone border, the selection ring and the keyboard focus outline), `FlowPort` (a connector dot whose id follows `in:<port>` / `out:<port>` via `flowPortId`), `FlowToneIndicator` (the tone glyph, the featured star and their screen-reader names) and `flowToneVariants` (the tone classes, for your own markup). `FlowNodeBaseData`, `FLOW_NODE_TYPE` and `FLOW_EDGE_TYPE` name the shared data fields and the built-in type keys.

**Edges.** Every built-in edge now shows selection the same way: the line turns the ring colour and gets 1.5px thicker. Before, only the weighted and self-loop edges did. `FlowEdgePath` takes `selected`, and its `stroke`/`strokeWidth` are now optional; the defaults live in `FLOW_EDGE_DEFAULTS`. New `FlowEdgeLabel` places HTML on an edge. `FloatingEdgeData` is renamed `FlowFloatingEdgeData` (the old name stays until 6.0.0). New `BrandFlowEdge`, `BrandFlowSmartEdge`, `BrandFlowFloatingEdge` and `FlowWeightedEdgeBaseData` types.

**Placeholder node.** `FlowPlaceholderNode` reads `data.title`. `data.label` still works until 6.0.0, with a one-time warning.

**Translation.** The zoom buttons, the group expand/collapse and child-count text, the placeholder's "Add node", and the default names of the button, self-loop and back edges can now be translated through `LocaleProvider`. The English text is unchanged.

**Smaller fixes.** Group nodes no longer redraw on every change elsewhere on the canvas, and they now show the keyboard focus outline. `FlowGroupNode`, `FlowPlaceholderNode`, `CanvasShell`, `InspectorPanel`, `Legend`, `ZoomControls` and `HelperLines` carry a `data-slot` on their root. The scale `Legend` uses the standard focus ring, and the categorical `Legend`'s item labels use the `meta` type role (same size, medium weight).
