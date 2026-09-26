import type { NodeTypes } from "@xyflow/react";
// DG-06 — zone imports
import { ZONE_NODE_TYPE } from "./zone-data";
import { ZoneNode } from "./zone-node";
// end DG-06

/**
 * The app's custom node components, keyed by their `arch/*` type. Declared once at module
 * level: React Flow warns when `nodeTypes` is a fresh object every render. Each item adds
 * its entries in its own delimited section.
 */
export const archNodeTypes = {
  // DG-06 — zone boundaries
  [ZONE_NODE_TYPE]: ZoneNode,
  // end DG-06
} satisfies NodeTypes;
