/** Public surface of the in-app FlowSpec core (review §4.4). P4 swaps this folder for flow's `/spec`. */
export * from "./types";
export { validateFlowSpec } from "./validate";
export { pickPort, toReactFlow, type ReactFlowGraph } from "./to-react-flow";
export { fromReactFlow } from "./from-react-flow";
