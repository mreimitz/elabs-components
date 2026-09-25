import { useMemo, useState } from "react";
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
 * wins. A `"placeholder"` node gets no default: `FlowPlaceholderNode` spends `data.title`
 * (and the deprecated `data.label`) on its inner button's name, and naming the wrapper the
 * same would announce it twice — and put a second element with that name in front of the
 * button.
 */
export function defaultNodeAriaLabel(node: Node): string | undefined {
  if (node.ariaLabel !== undefined) return node.ariaLabel;
  if (node.type === "placeholder") return undefined;
  const title = (node.data as { title?: unknown } | undefined)?.title;
  return typeof title === "string" && title.trim() !== "" ? title : undefined;
}

/**
 * `nodes` with {@link defaultNodeAriaLabel} applied. Same array identity when nothing
 * changed, and — the part a controlled canvas depends on — the same OUTPUT object for
 * every input node object it has already seen.
 *
 * A `useNodesState` canvas hands over a new array on every drag frame, with only the
 * dragged node replaced. React Flow re-adopts (and re-renders) a node only when the object
 * it receives is not the one it adopted last time, so copying every titled node on every
 * array change would re-render the whole canvas per frame and hand `getNodes()` callers a
 * fresh object for nodes that never changed. The cache is keyed by the input node object:
 * an untouched node maps to the very same named copy; only a replaced node is re-copied.
 */
export function useNamedNodes<NodeType extends Node>(
  nodes: NodeType[] | undefined,
): NodeType[] | undefined {
  // A lazily created, never-replaced cache: state rather than a ref so render may read it.
  const [named] = useState(() => new WeakMap<NodeType, NodeType>());
  return useMemo(() => {
    if (!nodes) return nodes;
    let changed = false;
    const next = nodes.map((node) => {
      const cached = named.get(node);
      if (cached) {
        changed ||= cached !== node;
        return cached;
      }
      const ariaLabel = defaultNodeAriaLabel(node);
      const output = ariaLabel === node.ariaLabel ? node : { ...node, ariaLabel };
      named.set(node, output);
      changed ||= output !== node;
      return output;
    });
    return changed ? next : nodes;
  }, [named, nodes]);
}
