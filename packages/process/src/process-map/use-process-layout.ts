"use client";

/**
 * useProcessLayout — the process map's cached, debounced dagre layout (RM-051).
 *
 * A process map is re-rendered constantly for reasons that do NOT move a node: switching
 * the metric from frequency to duration, selecting an activity, hovering a path. Laying
 * the graph out again for any of those is both wasteful and visually wrong — the picture
 * would twitch while the reader's eye is on it. So this hook separates two things the
 * naive version conflates:
 *
 * - **STRUCTURE** — which activities and transitions exist, and which way the graph runs.
 *   Only a change here can move a node, and only a change here runs dagre.
 * - **EVERYTHING ELSE** — metric, formatting, selection, rework badges. These rebuild the
 *   model (cheap, pure) and are re-applied onto the CACHED positions.
 *
 * The cache is keyed on `structureKey` (see `processGraphStructureKey`) plus the layout
 * direction, and it stores POSITIONS BY NODE ID rather than node objects — which is
 * exactly what lets a metric switch reuse a layout: the node objects are all new, their
 * ids are not.
 *
 * `layoutRuns` is returned so the "no second `layoutFlow` call for a metric-only change"
 * acceptance criterion is something a test can ASSERT rather than something a comment
 * claims.
 *
 * ## Debounce
 *
 * A structural change that arrives while another is still settling (dragging an
 * abstraction slider emits one graph per pointer move) is debounced by
 * {@link DEFAULT_LAYOUT_DEBOUNCE_MS}. The FIRST layout for a given hook instance is never
 * debounced — an empty canvas for 80 ms on mount is a worse trade than one extra dagre
 * run — so the debounce only ever delays a RE-layout.
 *
 * ## Motion
 *
 * Position deltas animate via a CSS transform transition on the React Flow node element
 * (see `PROCESS_MAP_NODE_MOTION_CLASS`), so nodes slide rather than re-mount, and the
 * whole thing is neutralized under `prefers-reduced-motion`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { XYPosition } from "@xyflow/react";
import { layoutFlow, type FlowLayoutDirection } from "@elabs-ai/components-flow";
import type { ProcessMapEdge, ProcessMapNode } from "./map-model";

/** How long a RE-layout waits for the structure to settle. */
export const DEFAULT_LAYOUT_DEBOUNCE_MS = 80;

/**
 * The class that animates node position deltas.
 *
 * React Flow writes `transform: translate(x, y)` onto its own node element, so the
 * transition has to live there — not on anything this package renders. The element is
 * addressed as `div[data-id]` rather than by React Flow's own `.react-flow__node` class
 * on purpose: that class contains underscores, which have to be backslash-escaped inside
 * a Tailwind arbitrary variant and would then be eaten by JavaScript string escaping the
 * moment the class string passes through `cn()`. Nodes are `div`s and edges are `g`s, so
 * the attribute form is both simpler and correctly scoped. Same reasoning as the ancestor
 * selector in `FlowNode`'s focus indicator.
 */
export const PROCESS_MAP_NODE_MOTION_CLASS =
  "[&_div[data-id]]:transition-transform [&_div[data-id]]:duration-base " +
  "[&_div[data-id]]:ease-standard motion-reduce:[&_div[data-id]]:transition-none";

/** One cached dagre result: where every node sits, plus the structure dagre reported. */
export interface ProcessLayoutSnapshot {
  positions: Record<string, XYPosition>;
  /** Node id → the handle side edges LEAVE from, as `layoutFlow` set it per direction. */
  sourcePosition: Record<string, ProcessMapNode["sourcePosition"]>;
  /** Node id → the handle side edges ENTER on. */
  targetPosition: Record<string, ProcessMapNode["targetPosition"]>;
  /** Edge ids running against the layout direction (`layoutFlow`'s `backEdges`). */
  backEdges: string[];
  /** Edge ids whose source equals their target (`layoutFlow`'s `selfLoops`). */
  selfLoops: string[];
  /** Wall-clock cost of the `layoutFlow` call that produced this, in milliseconds. */
  durationMs: number;
}

/** Inputs to {@link useProcessLayout}. */
export interface UseProcessLayoutOptions {
  nodes: ProcessMapNode[];
  edges: ProcessMapEdge[];
  /** Structure-only cache key — see `processGraphStructureKey`. NEVER include a metric. */
  structureKey: string;
  direction: FlowLayoutDirection;
  /** @default {@link DEFAULT_LAYOUT_DEBOUNCE_MS} */
  debounceMs?: number;
}

/** What {@link useProcessLayout} answers. */
export interface UseProcessLayoutResult {
  /** `nodes`, positioned. Identity changes whenever `nodes` does, so metrics stay live. */
  nodes: ProcessMapNode[];
  /** Edge ids `layoutFlow` reported as running backwards, for the back-edge shape. */
  backEdgeIds: ReadonlySet<string>;
  /** Edge ids `layoutFlow` withheld as self-loops. */
  selfLoopIds: ReadonlySet<string>;
  /** How many times `layoutFlow` has actually run for this hook instance. */
  layoutRuns: number;
  /** Cost of the most recent `layoutFlow` call, in milliseconds. `0` before the first. */
  lastLayoutMs: number;
  /** True between a structural change and the debounced layout that answers it. */
  pending: boolean;
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

/** Snapshot a `layoutFlow` result into the id-keyed shape the cache stores. */
function toSnapshot(
  result: ReturnType<typeof layoutFlow<ProcessMapNode, ProcessMapEdge>>,
  durationMs: number,
): ProcessLayoutSnapshot {
  const positions: Record<string, XYPosition> = {};
  const sourcePosition: ProcessLayoutSnapshot["sourcePosition"] = {};
  const targetPosition: ProcessLayoutSnapshot["targetPosition"] = {};
  for (const node of result.nodes) {
    positions[node.id] = node.position;
    sourcePosition[node.id] = node.sourcePosition;
    targetPosition[node.id] = node.targetPosition;
  }
  return {
    positions,
    sourcePosition,
    targetPosition,
    backEdges: result.backEdges,
    selfLoops: result.selfLoops,
    durationMs,
  };
}

/** Apply a cached snapshot to a fresh set of nodes, matching on id. */
export function applyLayoutSnapshot(
  nodes: ProcessMapNode[],
  snapshot: ProcessLayoutSnapshot,
): ProcessMapNode[] {
  return nodes.map((node) => {
    const position = snapshot.positions[node.id];
    if (!position) return node;
    return {
      ...node,
      position,
      sourcePosition: snapshot.sourcePosition[node.id],
      targetPosition: snapshot.targetPosition[node.id],
    };
  });
}

/**
 * Lay a process graph out, reusing a cached layout whenever the structure is unchanged.
 *
 * @see {@link UseProcessLayoutResult.layoutRuns} — the observable proof that a metric-only
 * change does not re-run dagre.
 */
export function useProcessLayout({
  nodes,
  edges,
  structureKey,
  direction,
  debounceMs = DEFAULT_LAYOUT_DEBOUNCE_MS,
}: UseProcessLayoutOptions): UseProcessLayoutResult {
  const cacheKey = `${structureKey}::${direction}`;
  const cache = useRef(new Map<string, ProcessLayoutSnapshot>());
  const runs = useRef(0);
  // The layout the render below reads. Held in state (not a ref) because producing a new
  // one must re-render; keyed so a cache hit for a DIFFERENT key is never mistaken for a
  // hit for this one.
  const [applied, setApplied] = useState<{ key: string; snapshot: ProcessLayoutSnapshot } | null>(
    null,
  );

  const compute = useCallback(
    (key: string, currentNodes: ProcessMapNode[], currentEdges: ProcessMapEdge[]) => {
      const started = performance.now();
      const result = layoutFlow<ProcessMapNode, ProcessMapEdge>(currentNodes, currentEdges, {
        direction,
      });
      const snapshot = toSnapshot(result, performance.now() - started);
      runs.current += 1;
      cache.current.set(key, snapshot);
      setApplied({ key, snapshot });
    },
    [direction],
  );

  // The nodes/edges the (possibly debounced) layout should run against. Held in a ref so
  // the effect below depends on the STRUCTURE key alone — re-running it whenever a metric
  // produced new node objects is precisely the bug the cache exists to prevent.
  const latest = useRef({ nodes, edges });
  latest.current = { nodes, edges };

  const cachedForKey = cache.current.get(cacheKey);
  const hasLayout = applied?.key === cacheKey || cachedForKey !== undefined;

  useEffect(() => {
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setApplied((current) =>
        current?.key === cacheKey ? current : { key: cacheKey, snapshot: cached },
      );
      return;
    }
    if (latest.current.nodes.length === 0) {
      setApplied({
        key: cacheKey,
        snapshot: {
          positions: {},
          sourcePosition: {},
          targetPosition: {},
          backEdges: [],
          selfLoops: [],
          durationMs: 0,
        },
      });
      return;
    }
    // First layout of this hook instance renders immediately; a RE-layout waits for the
    // structure to settle (an abstraction slider emits one graph per pointer move).
    if (runs.current === 0 || debounceMs <= 0) {
      compute(cacheKey, latest.current.nodes, latest.current.edges);
      return;
    }
    const timer = setTimeout(
      () => compute(cacheKey, latest.current.nodes, latest.current.edges),
      debounceMs,
    );
    return () => clearTimeout(timer);
  }, [cacheKey, compute, debounceMs]);

  const snapshot = applied?.key === cacheKey ? applied.snapshot : cachedForKey;

  const positionedNodes = useMemo(
    () => (snapshot ? applyLayoutSnapshot(nodes, snapshot) : nodes),
    [nodes, snapshot],
  );

  const backEdgeIds = useMemo(
    () => (snapshot ? new Set(snapshot.backEdges) : EMPTY_SET),
    [snapshot],
  );
  const selfLoopIds = useMemo(
    () => (snapshot ? new Set(snapshot.selfLoops) : EMPTY_SET),
    [snapshot],
  );

  return {
    nodes: positionedNodes,
    backEdgeIds,
    selfLoopIds,
    layoutRuns: runs.current,
    lastLayoutMs: snapshot?.durationMs ?? 0,
    pending: !hasLayout && nodes.length > 0,
  };
}
