import { useMemo } from "react";
import type { Node } from "@xyflow/react";

/**
 * Give every node an accessible NAME by default.
 *
 * React Flow renders a focusable node as `role="group"` and names it only from
 * `node.ariaLabel` on the node OBJECT — never from the node component, which renders
 * inside that wrapper and has no channel to it. `role="group"` does not take its name from
 * content, so a node without `ariaLabel` is an unnamed group: a screen reader announces
 * the "Press Enter or Space to select this node…" description with no word about WHICH
 * node it is on (issue 536). Unlike edges ("Edge from a to b"), React Flow has no default.
 *
 * The default is the node's visible heading, `data.title` (`FlowNode`'s and
 * `FlowGroupNode`'s title), when it is a non-empty string. A caller-set `ariaLabel` always
 * wins. `data.label` is deliberately NOT a fallback: `FlowPlaceholderNode` spends it on its
 * inner button's name, and naming the wrapper the same would announce it twice.
 */
export function defaultNodeAriaLabel(node: Node): string | undefined {
  if (node.ariaLabel !== undefined) return node.ariaLabel;
  const title = (node.data as { title?: unknown } | undefined)?.title;
  return typeof title === "string" && title.trim() !== "" ? title : undefined;
}

/** `nodes` with {@link defaultNodeAriaLabel} applied. Same identity when nothing changed. */
export function useNamedNodes<NodeType extends Node>(
  nodes: NodeType[] | undefined,
): NodeType[] | undefined {
  return useMemo(() => {
    if (!nodes) return nodes;
    let changed = false;
    const next = nodes.map((node) => {
      const ariaLabel = defaultNodeAriaLabel(node);
      if (ariaLabel === node.ariaLabel) return node;
      changed = true;
      return { ...node, ariaLabel };
    });
    return changed ? next : nodes;
  }, [nodes]);
}
