"use client";

import { localPoint } from "@visx/event";
import { motion, useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  forwardRef,
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@elabs-ai/components-ui";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "../chart-a11y";
import type { ChartInteractionProps } from "../chart-datapoint";
import {
  ChartDatapointLayer,
  ChartDatapointProvider,
  type ChartDatapointTarget,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "../chart-datapoint-layer";
import { useChartValueFormatter } from "../chart-formatters";
import type { ChartValueFormat } from "../value-format";
import { HaloText } from "../../marks/halo-text";
import { ChartTooltipBox } from "../tooltip/tooltip-box";
import { ChartTooltipContent, type TooltipRow } from "../tooltip/tooltip-content";
import {
  computeTreemapLayout,
  type TreemapLayoutResult,
  type TreemapLeafDatum,
  type TreemapNode,
  type TreemapPalette,
  validateTreemapData,
} from "./treemap-layout";

export type { TreemapNode, TreemapPalette } from "./treemap-layout";

// ── Tunables (internal — not speculative props; a labelled tile needs both a
// minimum AREA and a minimum per-axis size, or a long thin sliver gets a label
// that overflows it) ─────────────────────────────────────────────────────────
const MIN_LABEL_WIDTH = 32;
const MIN_LABEL_HEIGHT = 16;
const DEFAULT_LABEL_MIN_AREA = 1200;
const LABEL_PADDING_X = 6;

export interface TreemapChartProps extends ChartInteractionProps {
  /** The hierarchy. A leaf needs a `value`; a parent's explicit `value` (if any)
   * must equal the sum of its children (dev-validated — see `validateTreemapData`). */
  data: TreemapNode;
  /** How many levels of rectangles to render. `1` = flat (root's children only,
   * no title bands). `2` = groups + leaves. Default `2`. */
  depth?: 1 | 2;
  /**
   * - `"mono"` (default) — one neutral shade for every leaf; groups separated
   *   only by the title band + gap.
   * - `"sequential"` — leaf shade encodes the leaf's own value.
   * - `"categorical"` — one hue per top-level group, ≤ 4 groups (else `"mono"`).
   */
  palette?: TreemapPalette;
  /** Paper seam between tiles, in px. Default `2`. */
  gap?: number;
  /** Hide a tile's label below this area (px²). Never shrinks type — a label
   * either renders at `text-chart-value`/`text-chart-source` size, or not at all. */
  labelMinArea?: number;
  /** Merge leaves under this share (0..1) of their parent's total into "Other".
   * `0` (default) = off — the unconditional 30-leaf cap still applies. */
  otherThreshold?: number;
  /**
   * When `true` (and `depth: 2`), clicking a group's title band zooms into
   * that group (its leaves fill the canvas, animated); a "Back" control
   * returns to the overview. Default `false` — a static chart has no click
   * handler beyond `onDatapointClick`.
   */
  drilldown?: boolean;
  /** How leaf values render in the tooltip. Default `"compact"`. */
  valueFormat?: ChartValueFormat;
  className?: string;
  style?: CSSProperties;
  /** Aspect ratio as "width / height". Default `"16 / 9"`. */
  aspectRatio?: string;
  /** Accessible name for the chart region (announces to AT on focus). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT. */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
}

interface TooltipState {
  leaf: TreemapLeafDatum;
  x: number;
  y: number;
}

/** So a non-interactive TreemapChart never re-registers keyboard targets. */
const EMPTY_TREEMAP_TARGETS: ChartDatapointTarget[] = [];

/** `path.join(" › ")` — "Work › Platform › CI". */
function pathLabel(path: string[]): string {
  return path.join(" › ");
}

function rectStyle(rect: { x0: number; y0: number; x1: number; y1: number }) {
  return {
    x: rect.x0,
    y: rect.y0,
    width: Math.max(0, rect.x1 - rect.x0),
    height: Math.max(0, rect.y1 - rect.y0),
  };
}

const TreemapChartBody = forwardRef<HTMLDivElement, TreemapChartProps>(function TreemapChartBody(
  {
    data,
    depth = 2,
    palette = "mono",
    gap = 2,
    labelMinArea = DEFAULT_LABEL_MIN_AREA,
    otherThreshold = 0,
    drilldown = false,
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
  }: TreemapChartProps,
  forwardedRef,
) {
  // Dev-only structural validation — throws synchronously on a bad tree shape,
  // memoized so a stable `data` reference is only re-validated when it changes.
  useMemo(() => {
    validateTreemapData(data);
  }, [data]);

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

  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel, accessibleDescription);

  const [sz, setSz] = useState({ w: 0, h: 0 });
  const measure = useCallback(() => {
    if (!internalRef.current) {
      return;
    }
    const { width: w, height: h } = internalRef.current.getBoundingClientRect();
    if (w > 0 && h > 0) {
      setSz({ w, h });
    }
  }, []);
  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (internalRef.current) {
      ro.observe(internalRef.current);
    }
    return () => ro.disconnect();
  }, [measure]);

  // Drilldown (#349-adjacent, RM-025): which top-level group (by index) is
  // currently zoomed in, if any. Only meaningful at depth: 2.
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const drilldownEnabled = drilldown && depth === 2;
  useEffect(() => {
    // A data/depth/drilldown change invalidates whichever group was focused.
    setActiveGroupIndex(null);
  }, [data, depth, drilldownEnabled]);

  const baseLayout = useMemo<TreemapLayoutResult>(
    () =>
      computeTreemapLayout(data, {
        width: sz.w,
        height: sz.h,
        depth,
        gap,
        palette,
        otherThreshold,
      }),
    [data, sz.w, sz.h, depth, gap, palette, otherThreshold],
  );

  const focusedGroupSource: TreemapNode | null =
    activeGroupIndex != null ? (data.children?.[activeGroupIndex] ?? null) : null;

  const drilledLayout = useMemo<TreemapLayoutResult | null>(() => {
    if (!focusedGroupSource) {
      return null;
    }
    const sub = computeTreemapLayout(focusedGroupSource, {
      width: sz.w,
      height: sz.h,
      depth: 1,
      gap,
      palette,
      otherThreshold,
    });
    // Re-anchor share to the GRAND total (the sub-layout's own "total" is only
    // the focused group's total) and restore the full path + group identity.
    const grandTotal = baseLayout.total || sub.total;
    const groupName = focusedGroupSource.name;
    const groupIndex = activeGroupIndex as number;
    return {
      groups: [],
      total: grandTotal,
      leaves: sub.leaves.map((leaf) => ({
        ...leaf,
        share: grandTotal > 0 ? leaf.value / grandTotal : 0,
        path: [groupName, leaf.name],
        groupName,
        groupIndex,
      })),
    };
  }, [
    focusedGroupSource,
    sz.w,
    sz.h,
    gap,
    palette,
    otherThreshold,
    baseLayout.total,
    activeGroupIndex,
  ]);

  const activeLayout = drilledLayout ?? baseLayout;

  // Drill-down affordance: zooming into a group is a GROUP-band affordance,
  // never a leaf one — `onDatapointClick` is the only leaf click handler
  // (RM-025 acceptance: "static story has no click handlers beyond
  // onDatapointClick"). Real <button>s, positioned over each band, so both
  // pointer and keyboard can zoom in (interaction-guidelines: a keyboard
  // target never lives inside the aria-hidden <svg>).
  const showGroupZoomControls =
    drilldownEnabled && activeGroupIndex == null && baseLayout.groups.length > 0;

  // Tooltip (hover only — keyboard activation goes through ChartDatapointLayer).
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const formatValue = useChartValueFormatter(valueFormat);
  const formatShare = useChartValueFormatter("percent");

  const handleLeafEnter = useCallback((leaf: TreemapLeafDatum, event: React.MouseEvent) => {
    const point = localPoint(event);
    setTooltip({ leaf, x: point?.x ?? 0, y: point?.y ?? 0 });
  }, []);
  const handleLeafMove = useCallback((leaf: TreemapLeafDatum, event: React.MouseEvent) => {
    const point = localPoint(event);
    setTooltip({ leaf, x: point?.x ?? 0, y: point?.y ?? 0 });
  }, []);
  const handleLeafLeave = useCallback(() => setTooltip(null), []);

  // Drill-down (RM-025) + the cross-family interaction contract (#349). Leaves
  // are the only keyboard targets; one arrow-key ROW per top-level group
  // (seriesIndex = groupIndex), matching "keyboard order = layout order".
  const datapointsEnabled = useChartDatapointsEnabled();
  const activateDatapoint = useActivateDatapoint();
  const leafTargets = useMemo(() => {
    if (!datapointsEnabled || activeLayout.leaves.length === 0) {
      return EMPTY_TREEMAP_TARGETS;
    }
    return activeLayout.leaves.map((leaf) => ({
      id: leaf.id,
      index: leaf.groupIndex,
      seriesIndex: leaf.groupIndex,
      datum: {
        name: leaf.name,
        value: leaf.value,
        share: leaf.share,
        path: leaf.path,
        isOther: leaf.isOther,
      },
      value: leaf.value,
      category: leaf.name,
      rect: padDatapointRect(rectStyle(leaf)),
    }));
  }, [activeLayout.leaves, datapointsEnabled]);
  useRegisterDatapointTargets("leaves", leafTargets);

  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 30 };

  const rootLabel = data.name;

  return (
    <div
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full select-none", className)}
      data-slot="treemap-chart"
      ref={ref}
      role={role}
      style={{ aspectRatio, ...style }}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel description={accessibleDescription} descId={descId} />
      {sz.w > 0 && sz.h > 0 && (
        <>
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
            height={sz.h}
            role="presentation"
            viewBox={`0 0 ${sz.w} ${sz.h}`}
            width={sz.w}
          >
            <rect fill="var(--chart-background)" height={sz.h} width={sz.w} x={0} y={0} />
            {depth === 2 &&
              activeLayout.groups.map((group) => {
                const box = rectStyle(group);
                const bandWidth = box.width;
                const showLabel =
                  bandWidth >= MIN_LABEL_WIDTH && group.bandHeight >= MIN_LABEL_HEIGHT;
                return (
                  <g data-slot="treemap-group" key={group.id}>
                    <motion.rect
                      animate={{ x: box.x, y: box.y, width: bandWidth, height: group.bandHeight }}
                      fill={group.color}
                      initial={false}
                      transition={transition}
                    />
                    {showLabel && (
                      <HaloText
                        className="text-chart-source uppercase"
                        data-slot="treemap-group-label"
                        dominantBaseline="middle"
                        textAnchor="start"
                        x={box.x + LABEL_PADDING_X}
                        y={box.y + group.bandHeight / 2}
                      >
                        {group.name}
                      </HaloText>
                    )}
                  </g>
                );
              })}
            {activeLayout.leaves.map((leaf) => {
              const box = rectStyle(leaf);
              const area = box.width * box.height;
              const showLabel =
                area >= labelMinArea &&
                box.width >= MIN_LABEL_WIDTH &&
                box.height >= MIN_LABEL_HEIGHT;
              const isActive = datapointsEnabled;
              return (
                <g data-slot="treemap-leaf" key={leaf.id}>
                  <motion.rect
                    animate={{ x: box.x, y: box.y, width: box.width, height: box.height }}
                    className={cn(isActive && "cursor-pointer")}
                    data-treemap-leaf-id={leaf.id}
                    fill={leaf.color}
                    initial={false}
                    onClick={
                      isActive
                        ? (event) => {
                            const target = leafTargets.find((t) => t.id === leaf.id);
                            if (target) {
                              activateDatapoint?.(target, event, "pointer");
                            }
                          }
                        : undefined
                    }
                    onMouseEnter={(event) => handleLeafEnter(leaf, event)}
                    onMouseLeave={handleLeafLeave}
                    onMouseMove={(event) => handleLeafMove(leaf, event)}
                    transition={transition}
                  />
                  {showLabel && (
                    <HaloText
                      className="text-chart-value"
                      data-slot="treemap-leaf-label"
                      dominantBaseline="middle"
                      textAnchor="start"
                      x={box.x + LABEL_PADDING_X}
                      y={box.y + box.height / 2}
                    >
                      {leaf.name}
                    </HaloText>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Group-zoom controls: real <button>s outside the aria-hidden SVG,
              positioned over each band. Pointer AND keyboard operable. */}
          {showGroupZoomControls && (
            <div className="pointer-events-none absolute inset-0" data-slot="treemap-zoom-layer">
              {baseLayout.groups.map((group, index) => {
                const box = rectStyle(group);
                return (
                  <button
                    aria-label={`Zoom into ${group.name}`}
                    className="pointer-events-auto absolute rounded-sm focus-ring"
                    data-slot="treemap-zoom-target"
                    key={group.id}
                    onClick={() => setActiveGroupIndex(index)}
                    style={{ left: box.x, top: box.y, width: box.width, height: group.bandHeight }}
                    type="button"
                  />
                );
              })}
            </div>
          )}

          {/* Back control — the only way OUT of a drilled-in view, a real
              <button> so it is reachable without a mouse. */}
          {drilldownEnabled && activeGroupIndex != null && (
            <button
              className="absolute top-2 left-2 z-10 rounded-md bg-card px-2.5 py-1 text-chart-source text-foreground shadow-ring-sm focus-ring"
              data-slot="treemap-back"
              onClick={() => setActiveGroupIndex(null)}
              type="button"
            >
              ← {rootLabel}
            </button>
          )}

          {tooltip && (
            <ChartTooltipBox
              containerHeight={sz.h}
              containerRef={internalRef}
              containerWidth={sz.w}
              visible
              x={tooltip.x}
              y={tooltip.y}
            >
              <ChartTooltipContent
                rows={
                  [
                    {
                      color: tooltip.leaf.color,
                      label: "Value",
                      value: formatValue(tooltip.leaf.value),
                    },
                    {
                      color: tooltip.leaf.color,
                      label: "Share",
                      value: formatShare(tooltip.leaf.share),
                    },
                  ] satisfies TooltipRow[]
                }
                title={pathLabel(tooltip.leaf.path)}
              />
            </ChartTooltipBox>
          )}

          <ChartDatapointLayer />
        </>
      )}
    </div>
  );
});

/**
 * `TreemapChart` — a two-level squarified treemap (RM-025). Area encodes
 * value straight from the `d3-hierarchy` layout (no sqrt); the default
 * `palette: "mono"` gives every leaf one shade, so groups are separated by
 * their title band + paper gap alone, never by colour.
 *
 * Token-driven, theme-safe, keyboard-operable: leaves register as
 * `ChartDatapointLayer` targets when `onDatapointClick`/`copyValueOnActivate`
 * is set (the shared cross-family interaction contract, #349); the optional
 * `drilldown` zoom is a SEPARATE, real-`<button>` affordance on each group's
 * title band, so a static chart never gains a click handler beyond
 * `onDatapointClick`.
 *
 * @dataShape a nested hierarchy sized by one measure
 * @avoidWhen the hierarchy has fewer than 2 levels — a flat bar chart is clearer
 */
export const TreemapChart = forwardRef<HTMLDivElement, TreemapChartProps>(
  function TreemapChart(props, ref) {
    const { copyValueOnActivate, datapointLabel, maxInteractiveDatapoints, onDatapointClick } =
      props;
    if (!onDatapointClick && !copyValueOnActivate) {
      return <TreemapChartBody {...props} ref={ref} />;
    }
    return (
      <ChartDatapointProvider
        copyValueOnActivate={copyValueOnActivate}
        datapointLabel={datapointLabel}
        maxInteractiveDatapoints={maxInteractiveDatapoints}
        onDatapointClick={onDatapointClick}
      >
        <TreemapChartBody {...props} ref={ref} />
      </ChartDatapointProvider>
    );
  },
);

TreemapChart.displayName = "TreemapChart";

export default TreemapChart;
