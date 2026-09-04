"use client";

/**
 * NetworkChart (RM-036) — a node-link graph in three layouts, one contract.
 *
 * Closes the seven network cards of the lieflat catalogue (G6, G11, B1, B2, L5,
 * L12, L6) with a single container: `layout="circular"` for a ring, `"force"`
 * for a settled cloud, `"arc"` for a bipartite colonnade. `@elabs-ai/components-flow`
 * is deliberately NOT reused — it is an author-built React Flow canvas, not a
 * data-driven graph, and charts must not import a sibling package.
 *
 * ## Three decisions worth knowing before changing this file
 *
 * 1. **Nothing ticks.** The force layout is solved synchronously, to a fixed
 *    tick budget, before React sees a coordinate — see `layouts/force.ts`. There
 *    is no simulation lifecycle to leak, no timer to make a test flaky, and
 *    nothing that moves under `prefers-reduced-motion`.
 * 2. **The keyboard path is outside the `<svg>`.** The chart body is
 *    `aria-hidden`, so datapoint targets are real `<button>`s in
 *    `ChartDatapointLayer`, a `pointer-events: none` positioned sibling — one
 *    tab stop, arrows to traverse, every hit box padded to 24×24. A `tabIndex`
 *    on a `<circle>` would be the axe `aria-hidden-focus` violation.
 * 3. **Emphasis is CSS, driven by one piece of state.** Pointer events are
 *    delegated from the SVG root, the provider holds a single `activeId`, and
 *    the blur is an `opacity-[…]` class on each `<g>`. No node owns state, and
 *    no per-frame style object is built.
 */

import {
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  forwardRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@elabs-ai/components-ui";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "../chart-a11y";
import type { ChartPalette } from "../chart-context";
import type { ChartDatapoint, ChartInteractionProps } from "../chart-datapoint";
import {
  ChartDatapointLayer,
  ChartDatapointProvider,
  type ChartDatapointTarget,
  padDatapointRect,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "../chart-datapoint-layer";
import { useChartValueFormatter } from "../chart-formatters";
import { ChartTooltipBox } from "../tooltip/tooltip-box";
import { ChartTooltipContent, type TooltipRow } from "../tooltip/tooltip-content";
import type { ChartValueFormat } from "../value-format";
import { NetworkChartProvider, type NetworkEmphasis } from "./network-context";
import {
  computeNetworkLayout,
  danglingLinks,
  NETWORK_DEFAULT_MAX_NODES,
  networkSummary,
  resolveLitIds,
} from "./network-layout";
import { NetworkLinks } from "./network-link";
import { NetworkNodes } from "./network-node";
import type {
  NetworkLayout,
  NetworkLinkDatum,
  NetworkNodeDatum,
  NetworkNodeLayout,
  NetworkPoint,
} from "./network-types";

export type {
  NetworkLayout,
  NetworkLinkDatum,
  NetworkLinkLayout,
  NetworkNodeDatum,
  NetworkNodeLayout,
} from "./network-types";

/** The datum a `NetworkChart` datapoint carries into `onDatapointClick`. */
export interface NetworkDatapointDatum extends NetworkNodeDatum {
  /** Number of incident links. */
  degree: number;
  /** The number that sized the node: `value ?? degree`. */
  weight: number;
}

export interface NetworkChartProps extends ChartInteractionProps<NetworkDatapointDatum> {
  /** The graph's nodes. `id` is the identity `links` reference. */
  nodes: NetworkNodeDatum[];
  /** The graph's edges. An endpoint naming an unknown node is dropped (dev warning). */
  links: NetworkLinkDatum[];
  /**
   * - `"force"` — a settled force-directed cloud (G11, B2).
   * - `"circular"` — one ring, chords bundled toward the centre (G6, B1).
   * - `"arc"` — bipartite ownership: two columns, hairline béziers (L12).
   */
  layout: NetworkLayout;
  /**
   * `"value"` (default) — AREA is proportional to the node's weight, i.e. radius
   * ∝ √weight. A number pins every node to that radius.
   *
   * "Weight" is the node's own `value`, or its DEGREE when it has none — which
   * is what gives a colonnade "hub radius ∝ link count" for free.
   */
  nodeSize?: "value" | number;
  /**
   * Draw a node's label only when its weight reaches this (lieflat B1's rule for
   * a 60-node ring). Omit to label every node — right for ≤ ~15 nodes, unreadable
   * above it.
   */
  labelThreshold?: number;
  /**
   * `"adjacency"` (default) — hovering or focusing a node keeps it and its
   * neighbours lit and blurs the rest. `"none"` disables it.
   */
  emphasis?: NetworkEmphasis;
  /**
   * `force` only: let the pointer pull a node out of place. It springs back to
   * its settled position on release — the layout is the answer, the drag is a
   * way to look under a cluster. Ignored (with a dev warning) on the other two
   * layouts, which have no free positions to give.
   */
  draggable?: boolean;
  /**
   * Colour family. Default: `"categorical"` at or under six groups, `"mono"`
   * above — past six, a hue per group names nothing.
   */
  palette?: ChartPalette;
  /** Dev-warning threshold on node count. Default 200. NOT a cap. */
  maxNodes?: number;
  /** `force` only: changes the starting cloud, and so which arrangement is found. */
  seed?: number;
  /** How node values render in the tooltip. Default `"compact"`. */
  valueFormat?: ChartValueFormat;
  className?: string;
  style?: CSSProperties;
  /** Aspect ratio as "width / height". Default `"16 / 9"`. */
  aspectRatio?: string;
  /**
   * Accessible name for the chart region. Defaults to the auto summary —
   * `"Network, 60 nodes, 140 links, 5 groups"` — because the counts are exactly
   * what an `aria-hidden` SVG withholds.
   */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT. */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
}

interface TooltipState {
  node: NetworkNodeLayout;
  x: number;
  y: number;
}

const ZERO_OFFSET: NetworkPoint = { x: 0, y: 0 };
const EMPTY_TARGETS: ChartDatapointTarget[] = [];

/** Messages already logged, so a re-rendering chart does not re-log every frame. */
const warnedMessages = new Set<string>();
function warnOnce(message: string): void {
  if (process.env.NODE_ENV === "production" || warnedMessages.has(message)) return;
  warnedMessages.add(message);
  console.warn(message);
}

/**
 * The default accessible name of a node's keyboard target.
 *
 * Degree is in the NAME, not only in the visual tooltip: "reach every node and
 * read its degree" has to hold for a screen-reader user too, and a tooltip they
 * never see does not deliver it.
 */
export function defaultNetworkDatapointLabel(
  point: Omit<ChartDatapoint<NetworkDatapointDatum>, "source">,
): string {
  const datum = point.datum;
  const parts = [datum.label ?? datum.id];
  if (datum.group !== undefined) parts.push(datum.group);
  if (Number.isFinite(datum.value)) parts.push(`value ${datum.value}`);
  parts.push(`${datum.degree} ${datum.degree === 1 ? "link" : "links"}`);
  return parts.join(", ");
}

const NetworkChartBody = forwardRef<HTMLDivElement, NetworkChartProps>(function NetworkChartBody(
  {
    nodes,
    links,
    layout,
    nodeSize = "value",
    labelThreshold,
    emphasis = "adjacency",
    draggable = false,
    palette,
    maxNodes = NETWORK_DEFAULT_MAX_NODES,
    seed,
    valueFormat = "compact",
    className,
    style,
    aspectRatio = "16 / 9",
    accessibleLabel,
    accessibleDescription,
    onDatapointClick: _onDatapointClick,
    copyValueOnActivate: _copyValueOnActivate,
    datapointLabel: _datapointLabel,
    maxInteractiveDatapoints: _maxInteractiveDatapoints,
  }: NetworkChartProps,
  forwardedRef,
) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [forwardedRef],
  );

  // ── Dev diagnostics ───────────────────────────────────────────────────────
  useEffect(() => {
    if (nodes.length > maxNodes) {
      warnOnce(
        `[brand-ui/charts] NetworkChart has ${nodes.length} nodes, past the ${maxNodes}-node ` +
          "readability threshold. Every node still renders and stays keyboard-reachable; " +
          "consider aggregating satellites into their hub, or raise maxNodes deliberately.",
      );
    }
    const dangling = danglingLinks(nodes, links);
    if (dangling.length > 0) {
      warnOnce(
        `[brand-ui/charts] NetworkChart dropped ${dangling.length} link(s) whose endpoints name ` +
          `no node — first: "${dangling[0]?.source}" to "${dangling[0]?.target}".`,
      );
    }
    if (draggable && layout !== "force") {
      warnOnce(
        `[brand-ui/charts] NetworkChart draggable is ignored on layout="${layout}" — only the ` +
          "force layout has free positions to pull a node out of.",
      );
    }
  }, [draggable, layout, links, maxNodes, nodes]);

  // ── Measurement ───────────────────────────────────────────────────────────
  const [size, setSize] = useState({ w: 0, h: 0 });
  const measure = useCallback(() => {
    if (!internalRef.current) return;
    const { width, height } = internalRef.current.getBoundingClientRect();
    if (width > 0 && height > 0) setSize({ w: width, h: height });
  }, []);
  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (internalRef.current) observer.observe(internalRef.current);
    return () => observer.disconnect();
  }, [measure]);

  // ── Layout (pure, synchronous, memoised on data identity + size) ──────────
  const resolved = useMemo(
    () =>
      computeNetworkLayout(nodes, links, {
        width: size.w,
        height: size.h,
        layout,
        nodeSize,
        palette,
        paletteExplicit: palette !== undefined,
        seed,
      }),
    [nodes, links, size.w, size.h, layout, nodeSize, palette, seed],
  );

  // ── Emphasis + tooltip (ONE piece of state; the blur itself is CSS) ───────
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const litIds = useMemo(
    () => resolveLitIds(activeId, emphasis, resolved.adjacency),
    [activeId, emphasis, resolved.adjacency],
  );
  const nodeById = useMemo(
    () => new Map(resolved.nodes.map((node) => [node.id, node])),
    [resolved.nodes],
  );

  const activate = useCallback(
    (id: string | null) => {
      setActiveId(id);
      const node = id === null ? undefined : nodeById.get(id);
      setTooltip(node ? { node, x: node.x, y: node.y } : null);
    },
    [nodeById],
  );

  const nodeIdFromEvent = useCallback((target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null;
    return target.closest("[data-network-node-id]")?.getAttribute("data-network-node-id") ?? null;
  }, []);

  // ── Drag (force only) ─────────────────────────────────────────────────────
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<NetworkPoint>(ZERO_OFFSET);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const dragEnabled = draggable && layout === "force";

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!dragEnabled) return;
      const id = nodeIdFromEvent(event.target);
      if (!id) return;
      dragOrigin.current = { x: event.clientX, y: event.clientY };
      setDragId(id);
      setDragOffset(ZERO_OFFSET);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [dragEnabled, nodeIdFromEvent],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      // The viewBox is 1:1 with the container box, so a client-space delta IS a
      // user-space delta — no `getBoundingClientRect` per pointer move.
      if (dragId && dragOrigin.current) {
        setDragOffset({
          x: event.clientX - dragOrigin.current.x,
          y: event.clientY - dragOrigin.current.y,
        });
        return;
      }
      const id = nodeIdFromEvent(event.target);
      if (id !== activeId) activate(id);
    },
    [activate, activeId, dragId, nodeIdFromEvent],
  );

  const endDrag = useCallback(() => {
    if (!dragId) return;
    dragOrigin.current = null;
    // Clearing the offset IS the spring-back: the node's `<g>` carries a
    // `transition-[opacity,transform]` class, so the browser animates it home
    // (and `motion-reduce:transition-none` snaps it home instead).
    setDragId(null);
    setDragOffset(ZERO_OFFSET);
  }, [dragId]);

  const handlePointerLeave = useCallback(() => {
    endDrag();
    activate(null);
  }, [activate, endDrag]);

  // ── Keyboard emphasis ─────────────────────────────────────────────────────
  // `ChartDatapointLayer`'s buttons are DOM descendants of this container and
  // carry `data-target-id` (its documented stable seam), and focus events
  // bubble — so keyboard focus lights the same neighbourhood and raises the same
  // tooltip the pointer does, with no second code path.
  const handleFocus = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>) => {
      const id = (event.target as HTMLElement).dataset?.targetId;
      if (id && nodeById.has(id)) activate(id);
    },
    [activate, nodeById],
  );
  const handleBlur = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      activate(null);
    },
    [activate],
  );

  // ── Keyboard targets ──────────────────────────────────────────────────────
  const datapointsEnabled = useChartDatapointsEnabled();
  const targets = useMemo<ChartDatapointTarget[]>(() => {
    if (!datapointsEnabled || resolved.nodes.length === 0) return EMPTY_TARGETS;
    return resolved.nodes.map((node) => ({
      id: node.id,
      index: node.index,
      // One arrow-key row: keyboard order IS layout order (RM-036's rule), so
      // Left/Right walks the graph in the order it was drawn.
      seriesIndex: 0,
      datum: {
        id: node.id,
        label: node.label,
        value: node.value,
        group: node.group,
        degree: node.degree,
        weight: node.weight,
      },
      value: node.value,
      category: node.label ?? node.id,
      rect: padDatapointRect({
        x: node.x - node.r,
        y: node.y - node.r,
        width: node.r * 2,
        height: node.r * 2,
      }),
    }));
  }, [datapointsEnabled, resolved.nodes]);
  useRegisterDatapointTargets("nodes", targets);

  // ── Chrome ────────────────────────────────────────────────────────────────
  const summary = useMemo(
    () => networkSummary(resolved.nodes.length, resolved.links.length, resolved.groups.length),
    [resolved.groups.length, resolved.links.length, resolved.nodes.length],
  );
  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel ?? summary, accessibleDescription);

  const formatValue = useChartValueFormatter(valueFormat);

  const contextValue = useMemo(
    () => ({
      layout: resolved,
      emphasis,
      activeId,
      litIds,
      labelThreshold,
      dragId,
      dragOffset,
    }),
    [activeId, dragId, dragOffset, emphasis, labelThreshold, litIds, resolved],
  );

  const tooltipRows: TooltipRow[] = tooltip
    ? [
        ...(Number.isFinite(tooltip.node.value)
          ? [
              {
                color: tooltip.node.color,
                label: "Value",
                value: formatValue(tooltip.node.value as number),
              },
            ]
          : []),
        { color: tooltip.node.color, label: "Degree", value: String(tooltip.node.degree) },
        ...(tooltip.node.group === undefined
          ? []
          : [{ color: tooltip.node.color, label: "Group", value: tooltip.node.group }]),
      ]
    : [];

  return (
    <div
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full select-none", className)}
      data-slot="network-chart"
      onBlur={handleBlur}
      onFocus={handleFocus}
      ref={ref}
      role={role}
      style={{ aspectRatio, ...style }}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={accessibleDescription} />
      {size.w > 0 && size.h > 0 && (
        <NetworkChartProvider {...contextValue}>
          <svg
            aria-hidden="true"
            className={cn("absolute inset-0 h-full w-full", dragEnabled && "cursor-grab")}
            data-slot="network-chart-body"
            height={size.h}
            onPointerDown={handlePointerDown}
            onPointerLeave={handlePointerLeave}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            role="presentation"
            viewBox={`0 0 ${size.w} ${size.h}`}
            width={size.w}
          >
            <NetworkLinks />
            <NetworkNodes />
          </svg>

          {tooltip && (
            <ChartTooltipBox
              containerHeight={size.h}
              containerRef={internalRef}
              containerWidth={size.w}
              visible
              x={tooltip.x}
              y={tooltip.y}
            >
              <ChartTooltipContent
                rows={tooltipRows}
                title={tooltip.node.label ?? tooltip.node.id}
              />
            </ChartTooltipBox>
          )}

          <ChartDatapointLayer />
        </NetworkChartProvider>
      )}
    </div>
  );
});

/**
 * `NetworkChart` — a node-link graph in three layouts (RM-036).
 *
 * Token-driven, theme-safe, deterministic and keyboard-operable. See the module
 * header for the three decisions that shape it: the force layout is SOLVED, not
 * animated; the keyboard path lives outside the `aria-hidden` SVG; adjacency
 * emphasis is a CSS class driven by one piece of state.
 *
 * The container follows the package's `role="figure"` a11y convention
 * (`chart-a11y.tsx`) rather than a bare `role="img"`, so a reader can still
 * reach the datapoint targets inside it; the summary string RM-036 asks for
 * (`"Network, 60 nodes, 140 links, 5 groups"`) is the default accessible name.
 */
export const NetworkChart = forwardRef<HTMLDivElement, NetworkChartProps>(
  function NetworkChart(props, ref) {
    const { copyValueOnActivate, datapointLabel, maxInteractiveDatapoints, onDatapointClick } =
      props;
    if (!onDatapointClick && !copyValueOnActivate) {
      return <NetworkChartBody {...props} ref={ref} />;
    }
    return (
      <ChartDatapointProvider
        copyValueOnActivate={copyValueOnActivate}
        datapointLabel={
          (datapointLabel ?? defaultNetworkDatapointLabel) as unknown as ChartDatapointProviderLabel
        }
        maxInteractiveDatapoints={maxInteractiveDatapoints}
        onDatapointClick={onDatapointClick as unknown as ChartDatapointProviderHandler}
      >
        <NetworkChartBody {...props} ref={ref} />
      </ChartDatapointProvider>
    );
  },
);

/**
 * The provider's props are typed against the DEFAULT datum
 * (`Record<string, unknown>`), while this family's payload is a
 * `NetworkDatapointDatum` — a strictly NARROWER object, which makes the handler
 * position contravariant and the two directions non-overlapping to `tsc`. The
 * casts through `unknown` are that one variance step, named here rather than
 * hidden at the call site: the runtime shape is exactly what `targets` above
 * builds, so the narrowing is sound.
 */
type ChartDatapointProviderLabel = React.ComponentProps<
  typeof ChartDatapointProvider
>["datapointLabel"];
type ChartDatapointProviderHandler = React.ComponentProps<
  typeof ChartDatapointProvider
>["onDatapointClick"];

NetworkChart.displayName = "NetworkChart";

export default NetworkChart;
