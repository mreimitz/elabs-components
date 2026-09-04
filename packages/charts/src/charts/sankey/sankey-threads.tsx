"use client";

/**
 * `SankeyThreadLinks` — the `mode="threads"` per-record renderer (RM-037,
 * lieflat B3 `big-threads.html`).
 *
 * `SankeyLink` draws one aggregate edge per node PAIR (`d3-sankey`'s own
 * link set). This module draws one polyline per RECORD instead — a route can
 * cross more than two node columns (source › via › destination) — while
 * reusing the exact same node x0/x1/y0/y1 the aggregate layout already
 * computed, so both modes share positions (`SankeyChart` derives that layout
 * from an aggregated hop-count of every thread; see `deriveAggregateLinksForThreads`).
 *
 * Interaction mirrors the rest of the package's #349 contract: a transparent
 * 9px "fat hit-twin" path carries the POINTER interaction (hover + click to
 * pin), and the KEYBOARD path is the sibling `ChartDatapointLayer` — nothing
 * inside this `aria-hidden` `<svg>` ever becomes focusable. `SankeyChart`
 * mounts the provider/layer; this file only registers targets into it.
 */

import type { SankeyNode as SankeyNodeType } from "d3-sankey";
import { useMemo } from "react";
import { cn } from "@elabs-ai/components-ui";
import {
  type ChartDatapointTarget,
  padDatapointRect,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "../chart-datapoint-layer";
import { intFmt } from "../chart-formatters";
import { ChartTooltipBox } from "../tooltip/tooltip-box";
import { ChartTooltipContent } from "../tooltip/tooltip-content";
import { getDefaultNodeColor } from "./sankey-link";
import { type SankeyLinkDatum, type SankeyNodeDatum, useSankey } from "./sankey-context";

const ROUTE_SEPARATOR = " › "; // "source › via › destination"

/** A node "id" in threads mode is its `name` — the only stable string
 *  identifier `SankeyNodeDatum` carries. */
export function buildNodeNameIndex(nodes: { name: string }[]): Map<string, number> {
  const map = new Map<string, number>();
  nodes.forEach((node, index) => map.set(node.name, index));
  return map;
}

/**
 * Resolves one record's ordered node-index route.
 *
 * `path` (ordered node names) wins when present and every name resolves;
 * otherwise the record falls back to its plain `source`/`target` pair — a
 * single-hop thread, so a `mode="threads"` chart with no `path` on any link
 * still renders (just with no multi-hop routes). Returns `null` when a name
 * in `path` cannot be resolved against `nodes`, so callers can skip a
 * malformed record instead of drawing a broken/undefined route.
 */
export function resolveThreadRoute(
  link: SankeyLinkDatum,
  nameToIndex: Map<string, number>,
): number[] | null {
  if (link.path && link.path.length >= 2) {
    const indices = link.path.map((name) => nameToIndex.get(name));
    if (indices.some((index) => index === undefined)) {
      return null;
    }
    return indices as number[];
  }
  if (typeof link.source === "number" && typeof link.target === "number") {
    return [link.source, link.target];
  }
  return null;
}

/**
 * Threads-mode LAYOUT input. Expands every record's route into consecutive
 * hop pairs and sums values per pair, so `sankey()` can size and position
 * node columns exactly as it would for a normal aggregate graph — "both
 * modes share positions" (RM-037). Per-record detail is rendered separately
 * by `SankeyThreadLinks`; this function only ever feeds the layout engine.
 *
 * Pure and side-effect-free — safe to call on every render inside a `useMemo`.
 */
export function deriveAggregateLinksForThreads(
  nodes: SankeyNodeDatum[],
  links: SankeyLinkDatum[],
): SankeyLinkDatum[] {
  const nameToIndex = buildNodeNameIndex(nodes);
  const totals = new Map<string, number>();
  for (const link of links) {
    const route = resolveThreadRoute(link, nameToIndex);
    if (!route) {
      continue;
    }
    for (let i = 0; i < route.length - 1; i++) {
      const key = `${route[i]}->${route[i + 1]}`;
      totals.set(key, (totals.get(key) ?? 0) + link.value);
    }
  }
  return Array.from(totals.entries()).map(([key, value]) => {
    const [source, target] = key.split("->").map(Number) as [number, number];
    return { source, target, value };
  });
}

export interface ResolvedThread {
  id: string;
  /** Index into the ORIGINAL `data.links` array — the thread's stable identity. */
  index: number;
  link: SankeyLinkDatum;
  route: number[];
}

function resolveThreads(
  links: SankeyLinkDatum[],
  nameToIndex: Map<string, number>,
): ResolvedThread[] {
  const resolved: ResolvedThread[] = [];
  links.forEach((link, index) => {
    const route = resolveThreadRoute(link, nameToIndex);
    if (route) {
      resolved.push({ id: `thread:${index}`, index, link, route });
    }
  });
  return resolved;
}

function nodeSlotKey(threadId: string, nodeIndex: number): string {
  return `${threadId}@${nodeIndex}`;
}

/**
 * Per-(thread, node) vertical slot (a `[0, 1)` fraction of the node's
 * height) for every thread that touches that node — keeps overlapping
 * routes visually separated instead of stacking on the node's exact center.
 * Keyed by `nodeSlotKey` (not just thread id) since one thread visits
 * several node columns and generally needs a DIFFERENT slot at each. Order
 * is the threads' own array order, which is deterministic given the same
 * input.
 */
export function computeNodeSlots(threads: ResolvedThread[]): Map<string, number> {
  const perNode = new Map<number, string[]>();
  for (const thread of threads) {
    for (const nodeIndex of thread.route) {
      const ids = perNode.get(nodeIndex) ?? [];
      ids.push(thread.id);
      perNode.set(nodeIndex, ids);
    }
  }
  const slots = new Map<string, number>();
  for (const [nodeIndex, ids] of perNode) {
    ids.forEach((id, position) => {
      slots.set(nodeSlotKey(id, nodeIndex), (position + 0.5) / ids.length);
    });
  }
  return slots;
}

interface ThreadAnchor {
  x: number;
  y: number;
}

/**
 * Ordered anchor points a thread's polyline passes through: the route's
 * node-column edges, entering at `x0` and leaving at `x1` for every
 * intermediate node so the drawn line visibly threads THROUGH the node body.
 */
function buildThreadAnchors(
  route: number[],
  threadId: string,
  nodes: SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum>[],
  slots: Map<string, number>,
): ThreadAnchor[] | null {
  const anchors: ThreadAnchor[] = [];
  for (let i = 0; i < route.length; i++) {
    const nodeIndex = route[i] as number;
    const node = nodes[nodeIndex];
    if (!node) {
      return null;
    }
    const slot = slots.get(nodeSlotKey(threadId, nodeIndex)) ?? 0.5;
    const y0 = node.y0 ?? 0;
    const y1 = node.y1 ?? 0;
    const y = y0 + slot * (y1 - y0);
    const isFirst = i === 0;
    const isLast = i === route.length - 1;
    if (isFirst) {
      anchors.push({ x: node.x1 ?? 0, y });
    } else if (isLast) {
      anchors.push({ x: node.x0 ?? 0, y });
    } else {
      anchors.push({ x: node.x0 ?? 0, y });
      anchors.push({ x: node.x1 ?? 0, y });
    }
  }
  return anchors;
}

/**
 * One `M` + cubic/line path string through every anchor: a horizontal
 * S-curve between columns (matching `sankeyLinkHorizontal`'s own curvature),
 * a straight pass-through within one node (identical `y`, so no needless
 * curve is drawn where the line is already flat).
 */
export function anchorsToPath(anchors: ThreadAnchor[]): string {
  const first = anchors[0];
  if (!first) {
    return "";
  }
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1] as ThreadAnchor;
    const b = anchors[i] as ThreadAnchor;
    if (a.y === b.y) {
      d += ` L ${b.x} ${b.y}`;
    } else {
      const midX = (a.x + b.x) / 2;
      d += ` C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
    }
  }
  return d;
}

/**
 * lieflat B3's per-route encoding: stroke `max(.6, v*.14)`, opacity
 * `.06 + min(.2, v*.012)` — thin enough that a hundred overlapping routes
 * still read as texture ("atmosphere"), not a wall of ink.
 */
export function threadStrokeWidth(value: number): number {
  return Math.max(0.6, value * 0.14);
}

export function threadBaseOpacity(value: number): number {
  return 0.06 + Math.min(0.2, value * 0.012);
}

/** "source › via › destination" — also the accessible name's `category` field. */
export function threadRouteLabel(
  route: number[],
  nodes: SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum>[],
): string {
  return route.map((index) => nodes[index]?.name ?? `Node ${index}`).join(ROUTE_SEPARATOR);
}

export interface SankeyThreadLinksProps {
  /** Stroke color per thread. Default: the route's source node's palette color. */
  getThreadColor?: (
    route: number[],
    nodes: SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum>[],
  ) => string;
  /** Opacity applied to every OTHER thread while one is hovered, focused or pinned. Default: 0.035 */
  fadedOpacity?: number;
  /** Fat hit-twin stroke width in px (the invisible pointer hit area). Default: 9 */
  hitTwinWidth?: number;
  /** Additional class name for the thread group. */
  className?: string;
}

const EMPTY_TARGETS: ChartDatapointTarget[] = [];

export function SankeyThreadLinks({
  getThreadColor,
  fadedOpacity = 0.035,
  hitTwinWidth = 9,
  className,
}: SankeyThreadLinksProps) {
  const {
    nodes,
    threads: threadLinks,
    mode,
    hoveredNodeIndex,
    hoveredLinkIndex,
    setHoveredLinkIndex,
    pinnedLinkIndex,
    setPinnedLinkIndex,
    containerRef,
    width,
    height,
    mousePos,
  } = useSankey();
  const datapointsEnabled = useChartDatapointsEnabled();

  const nameToIndex = useMemo(() => buildNodeNameIndex(nodes), [nodes]);
  const resolvedThreads = useMemo(
    () => resolveThreads(threadLinks, nameToIndex),
    [threadLinks, nameToIndex],
  );
  const slots = useMemo(() => computeNodeSlots(resolvedThreads), [resolvedThreads]);

  const threadGeometry = useMemo(() => {
    const out: { thread: ResolvedThread; anchors: ThreadAnchor[]; path: string }[] = [];
    for (const thread of resolvedThreads) {
      const anchors = buildThreadAnchors(thread.route, thread.id, nodes, slots);
      if (anchors && anchors.length > 0) {
        out.push({ thread, anchors, path: anchorsToPath(anchors) });
      }
    }
    return out;
  }, [resolvedThreads, nodes, slots]);

  const datapointTargets = useMemo<ChartDatapointTarget[]>(() => {
    if (!datapointsEnabled) {
      return EMPTY_TARGETS;
    }
    return threadGeometry.map(({ thread, anchors }) => {
      const first = anchors[0] as ThreadAnchor;
      const last = anchors[anchors.length - 1] as ThreadAnchor;
      const cx = (first.x + last.x) / 2;
      const cy = (first.y + last.y) / 2;
      return {
        id: thread.id,
        index: thread.index,
        seriesIndex: 0,
        datum: thread.link as unknown as Record<string, unknown>,
        value: thread.link.value,
        category: threadRouteLabel(thread.route, nodes),
        rect: padDatapointRect({ x: cx, y: cy, width: 0, height: 0 }),
      };
    });
  }, [datapointsEnabled, threadGeometry, nodes]);
  useRegisterDatapointTargets("threads", datapointTargets);

  const isAnyActive =
    hoveredLinkIndex !== null || hoveredNodeIndex !== null || pinnedLinkIndex !== null;

  const activeIndex = hoveredLinkIndex ?? pinnedLinkIndex;
  const activeGeometry =
    activeIndex !== null ? threadGeometry.find((g) => g.thread.index === activeIndex) : undefined;

  return (
    <g className={cn("sankey-threads", className)} data-mode={mode}>
      {threadGeometry.map(({ thread, path }) => {
        const isActive =
          pinnedLinkIndex === thread.index ||
          hoveredLinkIndex === thread.index ||
          (hoveredNodeIndex !== null && thread.route.includes(hoveredNodeIndex));
        const isFaded = isAnyActive && !isActive;
        const opacity = isActive
          ? 1
          : isFaded
            ? fadedOpacity
            : threadBaseOpacity(thread.link.value);
        const sourceNode = nodes[thread.route[0] as number];
        const color = getThreadColor
          ? getThreadColor(thread.route, nodes)
          : sourceNode
            ? getDefaultNodeColor(sourceNode)
            : "var(--chart-1)";
        const pinned = pinnedLinkIndex === thread.index;

        return (
          <g data-pinned={pinned || undefined} data-thread-id={thread.id} key={thread.id}>
            {/* Visible thread — no pointer events; the hit-twin below carries them. */}
            <path
              d={path}
              fill="none"
              opacity={opacity}
              pointerEvents="none"
              stroke={color}
              strokeWidth={threadStrokeWidth(thread.link.value)}
              style={{ transition: "opacity var(--t-fast) var(--ease-standard)" }}
            />
            {/* Fat invisible hit-twin (#349 pointer half): 9px stroke, hit-tested
                on the stroke only so overlapping routes don't fight for clicks. */}
            <path
              aria-hidden="true"
              d={path}
              fill="none"
              onClick={(event) => {
                event.stopPropagation();
                setPinnedLinkIndex((prev) => (prev === thread.index ? null : thread.index));
              }}
              onMouseEnter={() => setHoveredLinkIndex(thread.index)}
              onMouseLeave={() => {
                if (hoveredLinkIndex === thread.index) {
                  setHoveredLinkIndex(null);
                }
              }}
              stroke="transparent"
              strokeWidth={hitTwinWidth}
              style={{ cursor: "pointer", pointerEvents: "stroke" }}
            />
          </g>
        );
      })}

      {activeGeometry ? (
        <ThreadTooltip
          containerRef={containerRef}
          height={height}
          mousePos={mousePos}
          nodes={nodes}
          thread={activeGeometry.thread}
          width={width}
        />
      ) : null}
    </g>
  );
}

SankeyThreadLinks.displayName = "SankeyThreadLinks";

/**
 * The threads-mode "route" tooltip body (RM-037): source › via › destination
 * plus value. Self-contained rather than a `SankeyTooltip` extension — kept
 * local to this file/mode so `SankeyTooltip`'s node/link tooltip is untouched.
 */
function ThreadTooltip({
  thread,
  nodes,
  containerRef,
  width,
  height,
  mousePos,
}: {
  thread: ResolvedThread;
  nodes: SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum>[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  width: number;
  height: number;
  mousePos: { x: number; y: number } | null;
}) {
  const x = mousePos ? mousePos.x : 0;
  const y = mousePos ? mousePos.y : 0;
  const swatchNode = nodes[thread.route[0] as number] ?? nodes[0];
  return (
    // ChartTooltipBox portals to `containerRef.current` (see tooltip-box.tsx),
    // so — same as `SankeyTooltip` today — it is safe to mount directly as an
    // SVG child even though it renders no SVG element of its own.
    <ChartTooltipBox
      containerHeight={height}
      containerRef={containerRef}
      containerWidth={width}
      visible
      x={x}
      y={y}
    >
      <ChartTooltipContent
        rows={[
          {
            color: swatchNode ? getDefaultNodeColor(swatchNode) : "var(--chart-1)",
            label: "Value",
            value: intFmt(thread.link.value),
          },
        ]}
        title={threadRouteLabel(thread.route, nodes)}
      />
    </ChartTooltipBox>
  );
}

export default SankeyThreadLinks;
