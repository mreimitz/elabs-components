import { useMemo } from "react";
import { useNodeConnections, useNodeId } from "@xyflow/react";

/**
 * An unconnected port stays hidden until it can be used: while its node is under the
 * pointer (hovered, dragged, or where a connection being drawn may end) or has keyboard
 * focus, and while it is the start or end of that connection (maintainer ruling
 * 2026-09-27: four dots on every node are noise in a static diagram).
 *
 * Keyed on React Flow's own handle classes: `connectionindicator` is set only while the
 * port can start or end a connection, so presentation mode (nothing connectable) shows no
 * dot on hover, and a connection drag shows only the ports it may end on.
 * `opacity-0`, never `hidden`: React Flow measures every handle's box when the node mounts,
 * and a port with no box could not take an edge drawn to it later. The node is matched as
 * `[data-id]` (React Flow's node wrapper), not `.react-flow__node`: an arbitrary variant
 * reads `_` as a space, and the escaped `\_` does not survive a JS string (as in `FlowNode`).
 *
 * P4: library gap — `FlowPort` has no `showOn` mode (harvest inventory H-71,
 * docs/findings/DG-05-node-primitives.md §3); this is that mode, done from outside.
 */
export const IDLE_PORT_CLASS =
  "opacity-0 [[data-id]:hover_&.connectionindicator]:opacity-100 [[data-id]:focus-visible_&.connectionindicator]:opacity-100 [&.connectingfrom]:opacity-100 [&.connectingto]:opacity-100";

/**
 * The handle ids of this node that an edge names as its end. An edge that names no handle
 * (one that attaches to a zone's border, or one a folded zone reroutes) is drawn along its
 * own route, not from a port, so it lights none.
 */
export function useConnectedPorts(): ReadonlySet<string> {
  const id = useNodeId();
  const connections = useNodeConnections();
  return useMemo(() => {
    const connected = new Set<string>();
    for (const connection of connections) {
      if (connection.source === id && connection.sourceHandle) {
        connected.add(connection.sourceHandle);
      }
      if (connection.target === id && connection.targetHandle) {
        connected.add(connection.targetHandle);
      }
    }
    return connected;
  }, [connections, id]);
}
