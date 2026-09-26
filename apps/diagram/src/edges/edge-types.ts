import { DataFlowEdge } from "./data-flow-edge";
import { FLOW_EDGE_TYPE_KEY } from "./data-flow-edge-data";

/**
 * The app's edge types. Module-level on purpose: React Flow warns when `edgeTypes` is a
 * fresh object every render.
 */
export const archEdgeTypes = { [FLOW_EDGE_TYPE_KEY]: DataFlowEdge };
