/**
 * TreeChart definition (ADR 0042 §5, RM-176; frame-size + status, RM-184). Kind defaults
 * match the destructuring of `TreeChartBody` (`charts/tree-chart.tsx`);
 * `nodeSize`/`nodeWidth`/`nodeHeight`'s defaults are that module's own constants, written as
 * their values because that module is not pure. `zoomRange`, `defaultExpandedDepth` and
 * `collapseDepth` have no kind default: each is left bare in the destructuring (resolved, or
 * left unset, deeper in the component).
 *
 * `TreeChartProps<TData>` is used at its default `TData = unknown`. No interaction commons
 * beyond `ChartInteractionProps` itself — no selection props exist on this family.
 *
 * `status` (not the full `chartStateGroup`): `data` is one required root object, never an
 * array, so there is no data shape an `empty` state could describe — a root with no
 * children is still a real, one-node tree, not "nothing to plot". `plotHeight` is likewise
 * referenced individually (`frameSizeGroup.fields.plotHeight`), not the whole `frame-size`
 * group, matching Treemap/Network/ParallelCoordinates' own precedent for a family that
 * declares only part of a group.
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { chartStateGroup } from "../charts/props/chart-state";
import { interactionCommons } from "../charts/props/commons";
import { frameSizeGroup } from "../charts/props/frame-size";
import type { TreeChartProps } from "../charts/tree-chart";
import { looseFieldFor } from "../charts/props/typed-field";
import { classNameField } from "./cartesian-fields";
import { defineChart } from "./define-chart";

/** `tree-chart.tsx`'s own layout constants — not exported, and that module renders
 * JSX, so the values are copied rather than imported. */
const DEFAULT_NODE_SIZE = 7;
const DEFAULT_NODE_BOX_WIDTH = 160;
const DEFAULT_NODE_BOX_HEIGHT = 72;

export const TREE_CHART = /* @__PURE__ */ defineChart<TreeChartProps>()({
  id: "TreeChart",
  version: 1,
  label: "Tree",
  description: "A hierarchy of membership only, as a node-link tree.",
  specTypes: [],
  groups: [a11yGroup, interactionCommons.group],
  fields: {
    data: looseFieldFor<TreeChartProps["data"]>()(
      field.object({
        fields: { name: field.string({ required: true }) },
        open: true,
        required: true,
        tier: "essential",
        description: "The hierarchy. Nodes need no value: membership only.",
      }),
    ),
    orientation: field.enum({
      values: ["lr", "tb"],
      tier: "essential",
      description: "Left-to-right or top-to-bottom.",
    }),
    nodeSize: field.number({
      unit: "px",
      tier: "advanced",
      description: "Node dot diameter. Ignored with renderNode.",
    }),
    palette: field.enum({
      values: ["mono", "categorical"],
      tier: "essential",
      description: "mono shades by depth; categorical shades by top-level branch.",
    }),
    collapsible: field.boolean({
      tier: "essential",
      description: "Branches open and close. Off draws every branch open, statically.",
    }),
    expandedIds: field.array({
      of: field.string(),
      tier: "advanced",
      description: "Open branches, by node id (controlled).",
    }),
    defaultExpandedIds: field.array({
      of: field.string(),
      tier: "advanced",
      description: "Open branches on first render (uncontrolled).",
    }),
    defaultExpandedDepth: field.number({
      tier: "advanced",
      description: "Branches shallower than this depth start open.",
    }),
    collapseDepth: field.number({
      tier: "advanced",
      deprecated: { since: "5.0.0", replacement: "defaultExpandedDepth", removeIn: "6.0.0" },
      description: "Use defaultExpandedDepth.",
    }),
    zoomable: field.boolean({
      tier: "advanced",
      description: "A pannable, pinch-zoomable canvas viewport.",
    }),
    zoomRange: field.array({
      of: field.number(),
      min: 2,
      max: 2,
      tier: "advanced",
      description: "The zoom range with zoomable: [min, max].",
    }),
    defaultZoom: field.number({ tier: "advanced", description: "The zoom on first render." }),
    minimap: field.boolean({ tier: "advanced", description: "A minimap in the corner." }),
    nodeWidth: field.number({
      unit: "px",
      tier: "advanced",
      description: "Custom node box width. Only used with renderNode.",
    }),
    nodeHeight: field.number({
      unit: "px",
      tier: "advanced",
      description: "Custom node box height. Only used with renderNode.",
    }),
    align: field.enum({
      values: ["start", "center"],
      tier: "advanced",
      description: "Where the tree sits when smaller than its container.",
    }),
    className: classNameField,
    plotHeight: frameSizeGroup.fields.plotHeight,
    status: chartStateGroup.fields.status,
  },
  codeOnly: [
    "onExpandedChange",
    "renderNode",
    "renderLink",
    "onZoomChange",
    ...interactionCommons.codeOnly,
  ],
  defaults: {
    orientation: "lr",
    nodeSize: DEFAULT_NODE_SIZE,
    palette: "mono",
    collapsible: true,
    zoomable: false,
    defaultZoom: 1,
    minimap: false,
    nodeWidth: DEFAULT_NODE_BOX_WIDTH,
    nodeHeight: DEFAULT_NODE_BOX_HEIGHT,
    align: "start",
  },
  targets: [],
  contract: {
    dataKind: "tree",
    requiredProps: ["data"],
    numericProps: ["nodeSize", "nodeWidth", "nodeHeight", "collapseDepth"],
  },
});
