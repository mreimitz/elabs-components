---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-ui": minor
---

`TreeChart` branches now open and close. The tree still starts fully expanded, so a chart you already render looks the same on first paint. Click a branch to close or open it; with an `onDatapointClick` handler, a click on the node drills in as before and the dot does the toggling. From the keyboard, Tab into the tree (the tree itself adds one Tab stop, even without a handler) and use the arrow keys, Space and Enter as in any tree view. A closed branch shows its direct-child count as `Platform (3)` and gets a ring around its dot, so it does not rely on colour alone. Every change animates: nodes grow out of their parent and fold back into it, and opening a branch scrolls its new children into view. Orientation, data and size changes animate the same way, and reduced motion snaps straight to the new layout.

To keep the old static chart, pass `collapsible={false}`. It draws exactly as before, including the `+k` pill from `collapseDepth`, and its click payload keeps `index` as the node's depth. One correction reaches it: with `collapseDepth`, member counts in accessible names, tooltips and the click payload's `descendantLeafCount` now count the real leaves under a node; before, each `+k` pill counted as a single leaf. `renderNode` needs the collapsible chart: with `collapsible={false}` it is ignored (with a warning in development) and the default dots are drawn.

`collapseDepth` is deprecated. On a collapsible chart it now means the same as `defaultExpandedDepth`: branches at that depth start closed and show `(n)`, instead of being replaced by a `+k` pill.

New props:

- `renderNode` draws each node as your own content, such as a small card, inside a fixed `nodeWidth` × `nodeHeight` box (default 160 × 72). Links attach to the box edges and the chart adds its own open/close pill. The content is presentational: keep it free of focusable elements and restate what it shows through `datapointLabel`.
- `expandedIds` with `onExpandedChange` control which branches are open. `defaultExpandedIds` or `defaultExpandedDepth` set the starting state instead.
- `align="center"` centres the tree in a larger container. A tree bigger than its container scrolls, never clips, and opens centred on its root; "Expand all" and orientation switches stay centred on it.
- `TreeNode` accepts an optional `id` (a stable identity for expand state and animation) and a `data` payload that is handed back to `renderNode` and, on the collapsible chart, to `datapointLabel` and `onDatapointClick`.

The default accessible name of a branch now states its direct children, plus its leaf count when that is different: `Engineering, 2 children, 5 members` instead of `Engineering, 5 members`. Open or closed is announced through `aria-expanded`, not the name. `collapsible={false}` keeps the old wording.

`ChartDatapointProvider` takes a new `disabled` prop: it provides nothing, exactly as if it were absent, so a chart can keep one element tree whether or not a handler is set. `TreeChart` uses it, so adding `onDatapointClick` later no longer resets the open branches.

`@elabs-ai/components-ui` adds the `charts.treeChart.expand` and `charts.treeChart.collapse` locale messages. They name the pointer toggle, which appears when the chart also has an `onDatapointClick` handler.
