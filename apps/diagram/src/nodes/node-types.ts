import type { NodeTypes } from "@xyflow/react";
// DG-05 — service / actor / datastore / queue / external / note imports
import { ARCH_NODE_TYPE } from "./arch-node-data";
import { ActorNode } from "./actor-node";
import { DatastoreNode } from "./datastore-node";
import { ExternalNode } from "./external-node";
import { NoteNode } from "./note-node";
import { QueueNode } from "./queue-node";
import { ServiceNode } from "./service-node";
// end DG-05
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
  // DG-05 — service / actor / datastore / queue / external / note nodes
  [ARCH_NODE_TYPE.service]: ServiceNode,
  [ARCH_NODE_TYPE.actor]: ActorNode,
  [ARCH_NODE_TYPE.datastore]: DatastoreNode,
  [ARCH_NODE_TYPE.queue]: QueueNode,
  [ARCH_NODE_TYPE.external]: ExternalNode,
  [ARCH_NODE_TYPE.note]: NoteNode,
  // end DG-05
  // DG-06 — zone boundaries (replaces the interim `group: FlowGroupNode` entry)
  [ZONE_NODE_TYPE]: ZoneNode,
  // end DG-06
} satisfies NodeTypes;
