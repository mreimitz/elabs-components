import type { Edge, Node } from "@elabs-ai/components-flow";
import { ARCH_NODE_TYPE, type ArchNodeData } from "../nodes/arch-node-data";
import { FLOW_EDGE_TYPE_KEY, type DataFlowEdgeData } from "../edges/data-flow-edge-data";
import { edgeAriaLabel, edgeMarkers } from "../edges/edge-style";

/**
 * DG-20 step 8 — a MOCKED collapsed composite node (plan V3: a `use: components/<path>`
 * instance drawn collapsed), placed in the lakehouse example so the maintainer can review the
 * look before DG-22 builds the real thing. Nothing here is the composite feature: no
 * `use:`, no drill-down, no resolution — one extra node and two flows added to the graph the
 * canvas draws, only when the page URL carries `?composite-mock`.
 */

/** The query flag that turns the mock on. */
export const COMPOSITE_MOCK_PARAM = "composite-mock";

/** A labelled port on the composite's border (plan V4: "a small labelled port"). */
export interface CompositeMockPort {
  /** The `FlowPort` port name; the handle id is `in:<port>` / `out:<port>`. */
  port: string;
  label: string;
}

/** What a composite adds to an ordinary architecture node's data. */
export interface CompositeMockData {
  /** How many nodes the collapsed component holds. */
  count: number;
  input: CompositeMockPort;
  output: CompositeMockPort;
}

export type CompositeMockNodeData = ArchNodeData & { composite: CompositeMockData };

export function isCompositeMock(data: ArchNodeData): data is CompositeMockNodeData {
  return "composite" in data && typeof (data as CompositeMockNodeData).composite === "object";
}

const MOCK_ID = "mock-semantic-layer";
/** Where it goes in `lakehouse-aws.yaml`: inside the AWS account, between curated S3 and Snowflake. */
const PARENT_ID = "aws";
const FROM_ID = "s3-curated";
const TO_ID = "snow-wh";

const MOCK_DATA: CompositeMockNodeData = {
  title: "Semantic layer",
  subtitle: "components/semantic-layer",
  icon: "lucide/layers",
  composite: {
    count: 12,
    // The standard `in`/`out` pair: the layout rewrites handles to the arch definition's
    // port names (`followZoneDirection`), so a named `in:tables` handle would lose its edge.
    // Real named ports are DG-22's (findings §2, "Composite mock").
    input: { port: "in", label: "tables" },
    output: { port: "out", label: "marts" },
  },
};

function flow(
  id: string,
  source: string,
  target: string,
  handles: { sourceHandle: string; targetHandle: string },
  data: DataFlowEdgeData,
  names: [string, string],
): Edge {
  return {
    id,
    source,
    target,
    ...handles,
    type: FLOW_EDGE_TYPE_KEY,
    data: data as Record<string, unknown>,
    ariaLabel: edgeAriaLabel(names[0], names[1], data),
    ...edgeMarkers(data.kind, data.direction),
  };
}

function isOn(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has(COMPOSITE_MOCK_PARAM);
}

/**
 * The graph with the mock added — or the graph unchanged when the flag is off or the graph
 * is not the lakehouse example (its anchors are missing).
 */
export function withCompositeMock<G extends { nodes: Node[]; edges: Edge[] }>(graph: G): G {
  if (!isOn()) return graph;
  const ids = new Set(graph.nodes.map((node) => node.id));
  if (ids.has(MOCK_ID) || !ids.has(PARENT_ID) || !ids.has(FROM_ID) || !ids.has(TO_ID)) {
    return graph;
  }
  const node: Node = {
    id: MOCK_ID,
    type: ARCH_NODE_TYPE.service,
    parentId: PARENT_ID,
    extent: "parent",
    position: { x: 0, y: 0 },
    data: MOCK_DATA as unknown as Record<string, unknown>,
    ariaLabel: `${MOCK_DATA.title}, component of ${MOCK_DATA.composite.count} nodes`,
  };
  const { input, output } = MOCK_DATA.composite;
  const edges = [
    flow(
      `${MOCK_ID}-in`,
      FROM_ID,
      MOCK_ID,
      { sourceHandle: "out:out", targetHandle: `in:${input.port}` },
      { kind: "data", label: "Curated tables" },
      ["S3 — curated", MOCK_DATA.title],
    ),
    flow(
      `${MOCK_ID}-out`,
      MOCK_ID,
      TO_ID,
      { sourceHandle: `out:${output.port}`, targetHandle: "in:in" },
      { kind: "data", label: "Marts" },
      [MOCK_DATA.title, "Snowflake warehouse"],
    ),
  ];
  return { ...graph, nodes: [...graph.nodes, node], edges: [...graph.edges, ...edges] };
}
