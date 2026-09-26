/**
 * NetworkChart definition (ADR 0042 §5, RM-176). Kind defaults match the destructuring
 * of `NetworkChartBody` (`charts/network/network-chart.tsx`). `palette` has no kind
 * default: the component leaves it unset and resolves it from the group count itself
 * (categorical at or under six groups, mono above).
 *
 * Pure: the ui definition base and pure modules at runtime, everything else by `import type`.
 */

import { a11yGroup, field } from "@elabs-ai/components-ui/definition";

import { chartStateGroup } from "../charts/props/chart-state";
import { interactionCommons } from "../charts/props/commons";
import { frameSizeGroup } from "../charts/props/frame-size";
import type { NetworkChartProps } from "../charts/network/network-chart";
import { paletteGroup } from "../charts/props/palette";
import { valueFormatGroup } from "../charts/props/value-format";
import { aspectRatioField, classNameField } from "./cartesian-fields";
import { defineChart } from "./define-chart";
import { messagesGroup } from "../charts/props/messages";

/** `network-layout.ts`'s own constant — copied rather than imported, since that module
 * pulls in React/d3-force/@visx at runtime and definitions must stay pure (ADR 0042 §11). */
const NETWORK_DEFAULT_MAX_NODES = 200;

export const NETWORK_CHART = /* @__PURE__ */ defineChart<NetworkChartProps>()({
  id: "NetworkChart",
  version: 1,
  label: "Network graph",
  description: "A graph of nodes and edges, laid out as force, ring or bipartite arcs.",
  specTypes: [],
  groups: [messagesGroup, a11yGroup, interactionCommons.group, chartStateGroup],
  fields: {
    nodes: field.array({
      of: field.object({
        fields: {
          id: field.string({ required: true }),
          label: field.string(),
          value: field.number(),
          group: field.string(),
        },
        open: true,
      }),
      required: true,
      tier: "essential",
      description: "The graph's nodes.",
    }),
    links: field.array({
      of: field.object({
        fields: {
          source: field.string({ required: true }),
          target: field.string({ required: true }),
          value: field.number(),
        },
      }),
      required: true,
      tier: "essential",
      description: "The graph's edges.",
    }),
    layout: field.enum({
      values: ["force", "circular", "arc"],
      required: true,
      tier: "essential",
      description: "force: a settled cloud. circular: one ring. arc: two bipartite columns.",
    }),
    nodeSize: field.union({
      of: [field.enum({ values: ["value"] }), field.number()],
      tier: "advanced",
      description: "value: area proportional to weight. A number pins every node to that radius.",
    }),
    labelThreshold: field.number({
      tier: "advanced",
      description: "Label only nodes at or above this weight. Omit to label every node.",
    }),
    emphasis: field.enum({
      values: ["adjacency", "none"],
      tier: "advanced",
      description: "adjacency: hover/focus keeps a node and its neighbours lit.",
    }),
    draggable: field.boolean({
      tier: "advanced",
      description: "force only: let the pointer pull a node out of place.",
    }),
    palette: paletteGroup.fields.palette,
    maxNodes: field.number({
      tier: "advanced",
      description: "Dev-warning threshold on node count. Not a cap.",
    }),
    seed: field.number({
      tier: "advanced",
      description: "force only: changes the starting cloud.",
    }),
    valueFormat: valueFormatGroup.fields.valueFormat,
    className: classNameField,
    aspectRatio: aspectRatioField,
    plotHeight: frameSizeGroup.fields.plotHeight,
  },
  codeOnly: ["style", ...interactionCommons.codeOnly],
  defaults: {
    nodeSize: "value",
    emphasis: "adjacency",
    draggable: false,
    maxNodes: NETWORK_DEFAULT_MAX_NODES,
    valueFormat: "compact",
  },
  targets: [],
  contract: {
    dataProp: "nodes",
    dataKind: "array",
    requiredProps: ["nodes", "links", "layout"],
    itemRequiredKeys: ["id"],
    itemNumericKeys: ["value"],
    numericProps: ["labelThreshold", "maxNodes", "seed"],
    edgeProp: { prop: "links" },
  },
});
