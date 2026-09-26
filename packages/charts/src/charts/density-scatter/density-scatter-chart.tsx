"use client";

/**
 * density-scatter-chart.tsx — `DensityScatterChart`: a point plot for
 * 10⁵–10⁶ rows with zones on the axes and a zoom-dependent level of detail.
 *
 * ## The model
 *
 * Every point is always drawn as a dot. Its colour is the density around it
 * (light where sparse, deep where dense — lightness on the class hue, never a
 * second hue), and dots are slightly translucent, so at full zoom-out 10⁵ of
 * them fuse into a solid gradient shape and zooming in spreads the same dots
 * apart. There is nothing to switch between; the transition is continuous by
 * construction. Density is measured by binning in SCREEN pixels (`bin.ts`), so
 * the level of detail follows the zoom for free.
 *
 * ## Layers (bottom → top)
 *
 * 1. `bg` canvas — plot ground, a faint density underlay (opacity-capped so it
 *    never reads as a blur; it fades on its own as zoom thins the cells).
 * 2. points canvas — WebGL point sprites (`points-renderer.ts`), Canvas-2D
 *    fallback. Positions upload once; one byte per point per frame.
 * 3. SVG overlay — grid, zone outlines, the committed selection shapes and
 *    the live gesture. `pointer-events: none`; crisp and themed.
 * 4. HTML — axis ticks/titles, the zone tags (real buttons), keyboard range
 *    sliders in the gutters, the tooltip, the live region.
 *
 * ## Accessibility (the canvas contract, RM-046)
 *
 * Pixels are invisible to AT, so the chart states what they convey: an auto
 * summary (`accessibleDescription` default) with the point count, both extents
 * and the zone shares; a polite live region for selection changes; real
 * `<button>` zone tags; `role="slider"` thumbs for the axis ranges (the
 * keyboard path to the same intersection a pointer reaches by dragging the
 * axis gutters). The lasso is a pointer gesture; its result is reachable by
 * keyboard through the two ranges.
 *
 * ## Selection (ADR 0040)
 *
 * The intersection selection (`selection.ts`) is the chart's own state,
 * controlled or uncontrolled. Every committed gesture ALSO emits one
 * `ChartSelectionIntent` (range / lasso / click-on-zone) with the modifier
 * mode, so a host engine can take over. Gestures mount only with
 * `selectionGestures`; the DOM is otherwise byte-identical.
 */

import {
  forwardRef,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLayoutMeasure } from "../layout-size";
import { cn, useControllableState } from "@elabs-ai/components-ui";
import { resolveTokenColor } from "@elabs-ai/components-tokens";
import { CHART_HAIRLINE_WIDTH } from "../../chart-hairline";
import { ChartA11yLabel, useChartA11yContainerProps } from "../chart-a11y";
import {
  ChartPlotRoot,
  type ChartPlotHeight,
  DEFAULT_CHART_PLOT_HEIGHT,
  type Responsive,
} from "../chart-breakpoint";
import { useChartInteractionPolicy } from "../chart-config-context";
import type { ChartLegendEntry, Margin } from "../chart-context";
import { CHART_TOUCH_ACTION } from "../gestures/touch-action";
import { type ContainerLegendProp, useContainerLegend } from "../legend/use-container-legend";
import { legendWantsValues } from "../legend/legend-values";
import type {
  ChartSelectionGesture,
  ChartSelectionIntent,
  ChartSelectionMode,
} from "../selection/types";
import { ChartTooltipBox, ChartTooltipContent, type TooltipRow } from "../tooltip";
import type { ChartTooltipRect } from "../tooltip/tooltip-box";
import { useContainerSelection } from "../selection/container-selection";
import {
  type BinGrid,
  binPoints,
  cellAt,
  cellDensity,
  createBinGrid,
  densityLevels,
  dominantClass,
  smoothField,
} from "./bin";
import { columnExtent, toDensityColumns } from "./columns";
import {
  type ColorRamp,
  createPointsRenderer,
  mixRgb,
  parseRgb,
  type PointsRenderer,
  type Rgb,
  rgbString,
} from "./points-renderer";
import { countSelected, resolveSelection, toggleZoneConstraint, withConstraint } from "./selection";
import {
  DENSITY_OUTSIDE_ID,
  type DensityOverlayContext,
  type DensityColorBy,
  type DensityOutsideZone,
  type DensityPlotBox,
  type DensityPoints,
  type DensityScatterData,
  type DensityScatterSelection,
  type DensityView,
  type DensityZone,
} from "./types";
import { useDensityView } from "./use-density-view";
import { classifyZones, countClasses, zoneOutline } from "./zones";

// ── Props ───────────────────────────────────────────────────────────────────

export interface DensityScatterLabels {
  /** Axis-gutter hint and slider group name. Default "Along x". */
  xRange?: string;
  yRange?: string;
  from?: string;
  to?: string;
  /** Tooltip heading for a dense cell. `{n}` is the count. */
  cluster?: string;
  point?: string;
  /** The tooltip row for the mean of the value column. */
  mean?: string;
  /** Live-region template: `{selected}` and `{total}`. */
  selected?: string;
  /** Zone tag accessible name: `{zone}`. */
  selectZone?: string;
  clearSelection?: string;
  resetView?: string;
  /** Legend label for the outside class. */
  outside?: string;
  notSelected?: string;
}

const DEFAULT_LABELS: Required<DensityScatterLabels> = {
  xRange: "x range",
  yRange: "y range",
  from: "from",
  to: "to",
  cluster: "Cluster · {n} points",
  point: "Point",
  mean: "mean",
  selected: "{selected} of {total} points selected",
  selectZone: "Select zone {zone}",
  clearSelection: "Clear selection",
  resetView: "Reset view",
  outside: "Outside",
  notSelected: "not selected",
};

export interface DensityFrameStats {
  /** Points inside the window (not hidden). */
  visible: number;
  /** Visible AND selected. */
  selected: number;
  /** Max raw count in one cell. */
  maxPerCell: number;
  /** Bin + upload time, ms. */
  ms: number;
  renderer: PointsRenderer["kind"];
}

export interface DensityScatterChartProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onSelect" | "onSelectionChange"
> {
  /** Columnar (preferred past ~50k) or rows. */
  data: DensityScatterData;
  /** Row key for x when `data` is rows. Default `"x"`. Also the intent `field` for x ranges. */
  xKey?: string;
  /** Row key for y when `data` is rows. Default `"y"`. */
  yKey?: string;
  /** Row keys lifted as numeric columns (rows input only). */
  valueKeys?: readonly string[];
  /** Row keys lifted as categorical columns (rows input only). */
  categoryKeys?: readonly string[];
  /** Zones on the axes, inner → outer. */
  zones?: readonly DensityZone[];
  /** Label/colour for points matching no zone. */
  outside?: DensityOutsideZone;
  /** What colours the dots. Default `{ kind: "zone" }` (or `"density"` without zones). */
  colorBy?: DensityColorBy;
  /**
   * The value column whose cell mean the tooltip reports (a `colorBy: value`
   * uses its own key). Unset: no mean row.
   */
  valueKey?: string;
  /** Bin size in CSS px. Default 5. Smaller = finer colour field, more cells. */
  cellSize?: number;
  /**
   * Underlay threshold (points per cell) — a faint body under dense areas.
   * `0` turns it off. Default 4.
   */
  underlay?: number;
  /** Dot radius in CSS px at the home view; grows slightly with zoom. Default 1.35. */
  pointRadius?: number;
  /**
   * Wheel zoom + drag pan. Default `true`. Off, whatever this says, under a
   * host policy with `active: false` (`ChartConfigProvider` `interactions`).
   */
  zoom?: boolean;
  /** The full-data window. Default: the data extent padded 3%. */
  domain?: Partial<DensityView>;
  view?: DensityView;
  defaultView?: DensityView;
  onViewChange?: (view: DensityView) => void;
  selection?: DensityScatterSelection;
  defaultSelection?: DensityScatterSelection;
  onSelectionChange?: (selection: DensityScatterSelection) => void;
  /**
   * Gestures to enable (ADR 0040). `"range"`: drag on an axis gutter (one
   * axis), or — with the toolbar's Range tool — a drag in the plot that sets
   * the x AND the y range at once; keyboard: `role="slider"` thumbs in each
   * gutter. `"lasso"`: the toolbar's Lasso tool, freehand in the plot. The
   * toolbar (`ChartSelectionToolbar`: Pointer / Range / Lasso) mounts above
   * the plot, or in `ChartFrame`'s action slot when framed. Unset: no gesture
   * layer, no toolbar, DOM byte-identical.
   */
  selectionGestures?: readonly ChartSelectionGesture[];
  /** Fires one intent per committed gesture. */
  onSelectionIntent?: (intent: ChartSelectionIntent) => void;
  /** Field name carried in x-range intents. Default `xKey`. */
  selectionField?: string;
  /** Y-range intents carry this field. Default `yKey`. */
  selectionFieldY?: string;
  /** `"auto"` (default): the toolbar shows when gestures are listed; `"none"` hides it. */
  selectionToolbar?: "auto" | "none";
  /**
   * Container legend (RM-118). `true` → `{ interactive: "toggle" }`.
   * `{ values: true }` prints each entry's point count (per zone, category or
   * the one density/value class).
   */
  legend?: ContainerLegendProp;
  /** Axis titles. */
  xLabel?: ReactNode;
  yLabel?: ReactNode;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  formatValue?: (value: number) => string;
  plotHeight?: Responsive<ChartPlotHeight>;
  aspectRatio?: string;
  margin?: Partial<Margin>;
  accessibleLabel?: string;
  accessibleDescription?: string;
  labels?: DensityScatterLabels;
  /** Per-frame statistics (stories, diagnostics). */
  onFrame?: (stats: DensityFrameStats) => void;
  /** Force the Canvas-2D path (tests, screenshots). */
  renderer?: "webgl" | "canvas2d";
  /**
   * In-plot zone tags (named buttons that select a zone). Default `true`.
   */
  zoneTags?: boolean;
  /**
   * A host layer drawn over the plot (above the zone outlines, below the
   * tooltip) — e.g. an editor for the zones. It receives the current window,
   * the plot box and both projections; it re-renders on every view change.
   * Pointer events reach the chart unless the layer handles them itself.
   */
  renderOverlay?: (context: DensityOverlayContext) => ReactNode;
  /** Hidden classes, controlled. Keys are zone ids / category labels. */
  hiddenKeys?: ReadonlySet<string>;
  onHiddenKeysChange?: (keys: ReadonlySet<string>) => void;
}

const DEFAULT_MARGIN: Margin = { top: 12, right: 12, bottom: 40, left: 56 };
const DEFAULT_ZONE_TOKENS = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
  "--chart-7",
  "--chart-8",
  "--chart-9",
  "--chart-10",
  "--chart-11",
  "--chart-12",
];
const OUTSIDE_TOKEN = "--chart-mono-4";
const DENSITY_TOKEN = "--chart-mono-7";
const SEQ_LO_TOKEN = "--chart-seq-1";
const SEQ_HI_TOKEN = "--chart-seq-7";
const CLUSTER_TOOLTIP_FROM = 4;
const MAX_CATEGORY_CLASSES = 12;
const EMPTY_KEYS: ReadonlySet<string> = new Set();

const nf = new Intl.NumberFormat();
const defaultFormat = (v: number) =>
  Math.abs(v) >= 1000
    ? nf.format(Math.round(v))
    : Math.abs(v) < 1 && v !== 0
      ? v.toFixed(2)
      : String(Math.round(v * 10) / 10);

function tokenName(color: string): string | null {
  const m = /^var\(\s*(--[\w-]+)\s*\)$/.exec(color.trim());
  if (m) return m[1]!;
  if (color.trim().startsWith("--")) return color.trim();
  return null;
}

function niceStep(span: number, target: number): number {
  const raw = span / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function ticks(lo: number, hi: number, count: number): number[] {
  const step = niceStep(hi - lo, count);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step)
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

function modeFor(event: {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): ChartSelectionMode {
  if (event.ctrlKey || event.metaKey) return "toggle";
  if (event.shiftKey) return "add";
  return "replace";
}

// ── Component ───────────────────────────────────────────────────────────────

/**
 * @dataShape hundreds of thousands of rows of two continuous measures — where the points pile up, and which zone each falls in
 * @avoidWhen under ~20k rows — use ScatterChart, which keeps labels, shapes and per-point marks
 */
export const DensityScatterChart = forwardRef<HTMLDivElement, DensityScatterChartProps>(
  function DensityScatterChart(
    {
      data,
      xKey = "x",
      yKey = "y",
      valueKeys,
      categoryKeys,
      zones = [],
      outside,
      colorBy,
      valueKey,
      cellSize = 5,
      underlay = 4,
      pointRadius = 1.35,
      zoom = true,
      domain,
      view: viewProp,
      defaultView,
      onViewChange,
      selection: selectionProp,
      defaultSelection,
      onSelectionChange,
      selectionGestures,
      onSelectionIntent,
      selectionField,
      selectionFieldY,
      selectionToolbar,
      legend,
      xLabel,
      yLabel,
      formatX = defaultFormat,
      formatY = defaultFormat,
      formatValue = defaultFormat,
      plotHeight,
      aspectRatio,
      margin: marginProp,
      accessibleLabel,
      accessibleDescription,
      labels: labelsProp,
      onFrame,
      renderer: rendererPref = "webgl",
      hiddenKeys: hiddenKeysProp,
      onHiddenKeysChange,
      zoneTags: showZoneTags = true,
      renderOverlay,
      className,
      style,
      ...props
    },
    forwardedRef,
  ) {
    const labels = { ...DEFAULT_LABELS, ...labelsProp };
    const margin = { ...DEFAULT_MARGIN, ...marginProp };
    const hasZones = zones.length > 0;
    // Keyed by value, not identity: an inline `colorBy={{ … }}` must not re-upload the points.
    const colorByKey = JSON.stringify(colorBy ?? null);
    const resolvedColorBy = useMemo<DensityColorBy>(
      () =>
        (JSON.parse(colorByKey) as DensityColorBy | null) ??
        (hasZones ? { kind: "zone" } : { kind: "density" }),
      [colorByKey, hasZones],
    );

    // ── Data → typed arrays (once per identity) ─────────────────────────────
    const warnedRef = useRef(false);
    const points = useMemo<DensityPoints>(
      () =>
        toDensityColumns(data, {
          xKey,
          yKey,
          valueKeys: [
            ...(valueKeys ?? []),
            ...(valueKey ? [valueKey] : []),
            ...(resolvedColorBy.kind === "value" ? [resolvedColorBy.key] : []),
          ],
          categoryKeys: [
            ...(categoryKeys ?? []),
            ...(resolvedColorBy.kind === "category" ? [resolvedColorBy.key] : []),
          ],
          warn: (message) => {
            if (!warnedRef.current && process.env.NODE_ENV !== "production") {
              warnedRef.current = true;
              console.warn(message);
            }
          },
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- key lists are read once per data identity
      [data, xKey, yKey],
    );
    const positions = useMemo(() => {
      const out = new Float32Array(points.n * 2);
      for (let i = 0; i < points.n; i++) {
        out[i * 2] = points.x[i]!;
        out[i * 2 + 1] = points.y[i]!;
      }
      return out;
    }, [points]);

    const zoneOrder = useMemo(() => zones.map((z) => z.id), [zones]);
    const zoneCls = useMemo(() => classifyZones(points, zones), [points, zones]);
    const zoneCounts = useMemo(
      () => countClasses(zoneCls, zones.length + 1),
      [zoneCls, zones.length],
    );

    // What the renderer paints by: the class array + the legend classes.
    const paint = useMemo(() => {
      if (resolvedColorBy.kind === "zone" && zones.length) {
        return {
          cls: zoneCls,
          classes: [
            ...zones.map((z) => ({ key: z.id, label: z.label, color: z.color })),
            {
              key: DENSITY_OUTSIDE_ID,
              label: outside?.label ?? labels.outside,
              color: outside?.color ?? `var(${OUTSIDE_TOKEN})`,
            },
          ],
          tMin: 0.32,
        };
      }
      if (resolvedColorBy.kind === "category") {
        const cat = points.categories[resolvedColorBy.key];
        if (cat) {
          const n = Math.min(cat.labels.length, MAX_CATEGORY_CLASSES);
          const cls = new Uint8Array(points.n);
          for (let i = 0; i < points.n; i++) cls[i] = Math.min(cat.codes[i]!, n);
          const classes = cat.labels.slice(0, n).map((label, k) => ({
            key: label,
            label,
            color: `var(${DEFAULT_ZONE_TOKENS[k % 12]})`,
          }));
          if (cat.labels.length > n)
            classes.push({ key: "__other", label: "Other", color: `var(${OUTSIDE_TOKEN})` });
          return { cls, classes, tMin: 0.32 };
        }
      }
      if (resolvedColorBy.kind === "value") {
        return {
          cls: new Uint8Array(points.n),
          classes: [{ key: "__value", label: resolvedColorBy.key, color: `var(${SEQ_HI_TOKEN})` }],
          tMin: 0,
        };
      }
      return {
        cls: new Uint8Array(points.n),
        classes: [{ key: "__density", label: "Density", color: `var(${DENSITY_TOKEN})` }],
        tMin: 0.32,
      };
    }, [resolvedColorBy, zones, zoneCls, points, outside, labels.outside]);
    const isValueMode = resolvedColorBy.kind === "value";
    const valueColumn = isValueMode
      ? points.values[resolvedColorBy.key]
      : valueKey
        ? points.values[valueKey]
        : undefined;
    const valueDomain = useMemo<[number, number]>(() => {
      if (resolvedColorBy.kind === "value" && resolvedColorBy.domain) return resolvedColorBy.domain;
      return (valueColumn && columnExtent(valueColumn)) ?? [0, 1];
    }, [resolvedColorBy, valueColumn]);
    /** Static levels for value colouring (never per frame). */
    const valueLevels = useMemo(() => {
      if (!isValueMode || !valueColumn) return null;
      const out = new Uint8Array(points.n);
      const [lo, hi] = valueDomain;
      const f = 255 / Math.max(hi - lo, Number.EPSILON);
      for (let i = 0; i < points.n; i++)
        out[i] = Math.min(255, Math.max(0, (valueColumn[i]! - lo) * f)) | 0;
      return out;
    }, [isValueMode, valueColumn, points.n, valueDomain]);

    // ── Home window ─────────────────────────────────────────────────────────
    // Keyed by value: an inline `domain={{ … }}` must not rebuild the window each render.
    const domainKey = JSON.stringify(domain ?? null);
    const home = useMemo<DensityView>(() => {
      const domain = JSON.parse(domainKey) as Partial<DensityView> | null;
      const ex = columnExtent(points.x) ?? [0, 1];
      const ey = columnExtent(points.y) ?? [0, 1];
      const padX = (ex[1] - ex[0] || 1) * 0.03;
      const padY = (ey[1] - ey[0] || 1) * 0.03;
      return {
        x0: domain?.x0 ?? ex[0] - padX,
        x1: domain?.x1 ?? ex[1] + padX,
        y0: domain?.y0 ?? ey[0] - padY,
        y1: domain?.y1 ?? ey[1] + padY,
      };
    }, [points, domainKey]);
    const viewApi = useDensityView({ home, view: viewProp, defaultView, onViewChange });
    const { view } = viewApi;

    // ── Selection state ─────────────────────────────────────────────────────
    const [selectionState, setSelection] = useControllableState<DensityScatterSelection>(
      selectionProp,
      defaultSelection ?? {},
      onSelectionChange,
    );
    const selection: DensityScatterSelection | undefined = selectionState;
    // A FRESH byte array per selection change: identity is what tells the frame
    // (and the GPU upload) that the selection moved — never an in-place mutation.
    const { selectedBytes, hasSel } = useMemo(() => {
      const out = new Uint8Array(points.n);
      const has = resolveSelection(points, zoneCls, zoneOrder, selection, out);
      return { selectedBytes: out, hasSel: has };
    }, [points, zoneCls, zoneOrder, selection]);

    // ── Hidden classes (legend toggles) ─────────────────────────────────────
    const [hiddenKeys, setHidden] = useControllableState<ReadonlySet<string>>(
      hiddenKeysProp,
      EMPTY_KEYS,
      onHiddenKeysChange,
    );
    const hiddenFlags = useMemo(
      () => paint.classes.map((c) => hiddenKeys.has(c.key)),
      [paint.classes, hiddenKeys],
    );

    // ── Layout ──────────────────────────────────────────────────────────────
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [measureRef, bounds] = useLayoutMeasure();
    const width = Math.round(bounds.width);
    const height = Math.round(bounds.height);
    const box = useMemo<DensityPlotBox>(
      () => ({
        left: margin.left,
        top: margin.top,
        width: Math.max(0, width - margin.left - margin.right),
        height: Math.max(0, height - margin.top - margin.bottom),
      }),
      [width, height, margin.left, margin.right, margin.top, margin.bottom],
    );
    const setRootRef = useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        measureRef(node);
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef, measureRef],
    );

    // ── Colours (resolved from tokens, re-read on theme change) ─────────────
    const [themeTick, setThemeTick] = useState(0);
    useEffect(() => {
      if (typeof document === "undefined") return;
      const observer = new MutationObserver(() => setThemeTick((t) => t + 1));
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class", "style"],
      });
      const mq =
        typeof window.matchMedia === "function"
          ? window.matchMedia("(prefers-color-scheme: dark)")
          : null;
      const onChange = () => setThemeTick((t) => t + 1);
      mq?.addEventListener?.("change", onChange);
      return () => {
        observer.disconnect();
        mq?.removeEventListener?.("change", onChange);
      };
    }, []);
    const probeRef = useRef<CanvasRenderingContext2D | null | undefined>(undefined);
    const resolveRgb = useCallback((color: string, fallback: Rgb): Rgb => {
      const el = rootRef.current;
      const name = tokenName(color);
      const css = name ? resolveTokenColor(name, { el: el ?? undefined, fallback: "" }) : color;
      // No computed value (jsdom, a detached root): the fallback, without a
      // canvas probe a `var()` string could never satisfy anyway.
      if (!css) return fallback;
      if (probeRef.current === undefined) {
        try {
          probeRef.current = document.createElement("canvas").getContext("2d");
        } catch {
          probeRef.current = null;
        }
      }
      return parseRgb(css || color, probeRef.current) ?? fallback;
    }, []);
    const colors = useMemo(() => {
      // Ground first: every ramp's sparse end is the class hue pulled toward it.
      const ground = resolveRgb(`var(--chart-background)`, [255, 255, 255]);
      const ramps: ColorRamp[] = paint.classes.map((c) => {
        const hi = resolveRgb(c.color, [64, 64, 64]);
        return { lo: mixRgb(hi, ground, 0.72), hi };
      });
      if (isValueMode) {
        const lo = resolveRgb(`var(${SEQ_LO_TOKEN})`, [220, 235, 240]);
        const hi = resolveRgb(`var(${SEQ_HI_TOKEN})`, [10, 90, 110]);
        ramps[0] = { lo, hi };
      }
      const outlines = paint.classes.map((c) => rgbString(resolveRgb(c.color, [64, 64, 64])));
      return { ground, ramps, outlines };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- themeTick forces a re-read
    }, [paint.classes, isValueMode, resolveRgb, themeTick, width]);

    // ── Renderer + bins ─────────────────────────────────────────────────────
    const bgRef = useRef<HTMLCanvasElement | null>(null);
    const ptsRef = useRef<HTMLCanvasElement | null>(null);
    const rendererRef = useRef<PointsRenderer | null>(null);
    const gridRef = useRef<BinGrid | null>(null);
    const levelsRef = useRef<Uint8Array>(new Uint8Array(0));
    const offRef = useRef<HTMLCanvasElement | null>(null);
    const [rendererKind, setRendererKind] = useState<PointsRenderer["kind"]>("none");
    // The renderer is bound to one <canvas> ELEMENT. The plot subtree can remount
    // (a container legend or selection wrapper appearing re-parents it), so the
    // canvas is tracked as state and every renderer gets a generation number that
    // re-uploads points/selection and re-sizes the backing stores.
    const [ptsCanvas, setPtsCanvas] = useState<HTMLCanvasElement | null>(null);
    const [rendererGen, setRendererGen] = useState(0);
    const setPtsRef = useCallback((node: HTMLCanvasElement | null) => {
      ptsRef.current = node;
      setPtsCanvas(node);
    }, []);
    const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;

    useEffect(() => {
      const canvas = ptsCanvas;
      if (!canvas) return;
      const r = createPointsRenderer(canvas, rendererPref);
      rendererRef.current = r;
      setRendererKind(r.kind);
      setRendererGen((g) => g + 1);
      return () => {
        r.dispose();
        if (rendererRef.current === r) rendererRef.current = null;
      };
    }, [rendererPref, ptsCanvas]);

    useEffect(() => {
      rendererRef.current?.setPoints(positions, paint.cls);
      levelsRef.current = new Uint8Array(points.n);
      if (valueLevels) rendererRef.current?.setLevels(valueLevels);
    }, [positions, paint.cls, points.n, valueLevels, rendererGen]);

    useEffect(() => {
      rendererRef.current?.setSelected(selectedBytes);
    }, [selectedBytes, rendererGen]);

    const [frameStats, setFrameStats] = useState<DensityFrameStats | null>(null);
    const onFrameRef = useRef(onFrame);
    onFrameRef.current = onFrame;

    // The frame. Everything it reads is a ref or a memoised value.
    const draw = useCallback(() => {
      const bg = bgRef.current;
      const r = rendererRef.current;
      if (!bg || !r || box.width <= 0 || box.height <= 0) return;
      const t0 = performance.now();
      const grid = createBinGrid(box, cellSize, paint.classes.length, gridRef.current ?? undefined);
      gridRef.current = grid;
      const input = {
        x: points.x,
        y: points.y,
        n: points.n,
        cls: paint.cls,
        hidden: hiddenFlags,
        selected: hasSel ? selectedBytes : null,
        value: valueColumn,
        view,
        box,
      };
      binPoints(grid, input);
      smoothField(grid);
      if (!isValueMode) {
        densityLevels(grid, input, levelsRef.current);
        r.setLevels(levelsRef.current);
      }

      // Background: ground + underlay.
      const ctx = bg.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        if (underlay > 0 && grid.smoothMax > 0) {
          const off = (offRef.current ??= document.createElement("canvas"));
          off.width = grid.cols;
          off.height = grid.rows;
          const octx = off.getContext("2d");
          // A 2D stub without ImageData (jsdom) simply skips the underlay.
          const img =
            octx && typeof octx.createImageData === "function"
              ? octx.createImageData(grid.cols, grid.rows)
              : null;
          if (octx && img && img.data) {
            const d = img.data;
            const cells = grid.cols * grid.rows;
            const threshold = underlay * 0.5;
            for (let idx = 0; idx < cells; idx++) {
              const s = grid.smooth[idx]!;
              if (s < threshold) continue;
              const dens = cellDensity(grid, idx);
              let ramp: ColorRamp;
              let t: number;
              if (isValueMode && valueColumn) {
                ramp = colors.ramps[0]!;
                const c = grid.counts[idx]!;
                const mean = c ? grid.sums[idx]! / c : valueDomain[0];
                t = Math.min(
                  1,
                  Math.max(
                    0,
                    (mean - valueDomain[0]) /
                      Math.max(valueDomain[1] - valueDomain[0], Number.EPSILON),
                  ),
                );
              } else {
                ramp = colors.ramps[dominantClass(grid, idx)] ?? colors.ramps[0]!;
                t = 0.45 + 0.55 * dens;
              }
              const a = Math.min(1, (s - threshold) / underlay);
              const o = idx * 4;
              d[o] = ramp.lo[0] + (ramp.hi[0] - ramp.lo[0]) * t;
              d[o + 1] = ramp.lo[1] + (ramp.hi[1] - ramp.lo[1]) * t;
              d[o + 2] = ramp.lo[2] + (ramp.hi[2] - ramp.lo[2]) * t;
              d[o + 3] = 255 * 0.28 * a * dens;
            }
            octx.putImageData(img, 0, 0);
            ctx.save();
            ctx.beginPath();
            ctx.rect(box.left, box.top, box.width, box.height);
            ctx.clip();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(off, box.left, box.top, grid.cols * cellSize, grid.rows * cellSize);
            ctx.restore();
          }
        }
      }

      const zoomK = Math.log2((home.x1 - home.x0) / (view.x1 - view.x0));
      const radius = Math.min(pointRadius * 2.4, Math.max(pointRadius, pointRadius + 0.32 * zoomK));
      const alpha = grid.visible > 120_000 ? 0.6 : grid.visible > 40_000 ? 0.72 : 0.86;
      r.draw({
        view,
        box,
        width,
        height,
        dpr,
        radius,
        alpha,
        ramps: colors.ramps,
        hidden: hiddenFlags,
        hasSelection: hasSel,
        tMin: paint.tMin,
      });
      const stats: DensityFrameStats = {
        visible: grid.visible,
        selected: grid.selected,
        maxPerCell: grid.max,
        ms: performance.now() - t0,
        renderer: r.kind,
      };
      onFrameRef.current?.(stats);
      setFrameStats((prev) =>
        prev && prev.visible === stats.visible && prev.selected === stats.selected ? prev : stats,
      );
    }, [
      box,
      cellSize,
      paint,
      points,
      hiddenFlags,
      hasSel,
      selectedBytes,
      valueColumn,
      view,
      isValueMode,
      dpr,
      width,
      height,
      underlay,
      colors,
      valueDomain,
      home,
      pointRadius,
    ]);

    // Size the backing stores, then draw (one rAF per change burst).
    const rafRef = useRef(0);
    useEffect(() => {
      for (const c of [bgRef.current, ptsRef.current]) {
        if (!c) continue;
        const w = Math.round(width * dpr);
        const h = Math.round(height * dpr);
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
      }
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(rafRef.current);
    }, [draw, width, height, dpr, rendererGen]);

    // ── Gestures + the selection session (RM-145 toolbar) ───────────────────
    // RM-167: pan / wheel zoom / reset are the host's `active` layer; a
    // selection gesture needs `active` (the drag) AND `select` (the commit);
    // a zone tag, a modified legend click and Esc commit, so they need `select`.
    const { active: activeLayer, select: selectLayer } = useChartInteractionPolicy();
    const zoomOn = zoom && activeLayer;
    const gestures = new Set(activeLayer && selectLayer ? (selectionGestures ?? []) : []);
    const rangeOn = gestures.has("range");
    // The session is enabled by the gesture list alone: the intersection
    // selection is this chart's own state, so a host handler is optional —
    // the session forwards every intent to it when present.
    const onSelectionIntentRef = useRef(onSelectionIntent);
    onSelectionIntentRef.current = onSelectionIntent;
    const forwardIntent = useCallback(
      (intent: ChartSelectionIntent) => onSelectionIntentRef.current?.(intent),
      [],
    );
    const selectedTotal = useMemo(
      () => (hasSel ? countSelected(selectedBytes) : 0),
      [hasSel, selectedBytes],
    );
    const selectionHost = useMemo(() => ({ selectedCount: selectedTotal }), [selectedTotal]);
    const containerSelection = useContainerSelection(
      {
        selectionGestures,
        onSelectionIntent: selectionGestures?.length ? forwardIntent : undefined,
        selectionField: selectionField ?? xKey,
        selectionToolbar,
      },
      xKey,
      selectionHost,
    );
    const tool = containerSelection.session.enabled ? containerSelection.session.mode : "pointer";
    const lassoOn = tool === "lasso" && gestures.has("lasso");
    // Range / Rectangle tool: a drag in the plot sets BOTH ranges at once.
    const rectOn = (tool === "range" || tool === "rect") && rangeOn;
    type Drag =
      | { kind: "pan"; startX: number; startY: number; from: DensityView }
      | { kind: "xaxis"; a: number; b: number }
      | { kind: "yaxis"; a: number; b: number }
      | { kind: "rect"; x0: number; y0: number; x1: number; y1: number }
      | { kind: "lasso"; pts: [number, number][] };
    const [drag, setDrag] = useState<Drag | null>(null);
    const dragRef = useRef<Drag | null>(null);
    const setDragBoth = (d: Drag | null) => {
      dragRef.current = d;
      setDrag(d);
    };
    const local = (e: { clientX: number; clientY: number }) => {
      const rect = rootRef.current?.getBoundingClientRect();
      return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
    };
    const emit = useCallback(
      (
        intent: Omit<ChartSelectionIntent, "datapoints" | "source"> & {
          source?: "pointer" | "keyboard";
        },
      ) => {
        const full: ChartSelectionIntent = { datapoints: [], source: "pointer", ...intent };
        // With gestures the session owns the intent (toolbar count, confirm
        // mode); without them (zone tags, legend) it goes straight to the host.
        if (containerSelection.session.enabled) containerSelection.session.receive(full);
        else onSelectionIntentRef.current?.(full);
      },
      [containerSelection.session],
    );

    const commitRange = (
      axis: "x" | "y",
      a: number,
      b: number,
      mode: ChartSelectionMode,
      source: "pointer" | "keyboard",
    ) => {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      setSelection(withConstraint(selection, axis === "x" ? { x: [lo, hi] } : { y: [lo, hi] }));
      emit({
        field: axis === "x" ? (selectionField ?? xKey) : (selectionFieldY ?? yKey),
        values: [lo, hi],
        mode,
        gesture: { kind: "range", axis, from: lo, to: hi },
        source,
      });
    };
    const clearRange = (axis: "x" | "y") =>
      setSelection(withConstraint(selection, axis === "x" ? { x: undefined } : { y: undefined }));

    const onPlotPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const { x, y } = local(e);
      e.currentTarget.setPointerCapture(e.pointerId);
      setTip(null);
      if (lassoOn) setDragBoth({ kind: "lasso", pts: [[x, y]] });
      else if (rectOn) setDragBoth({ kind: "rect", x0: x, y0: y, x1: x, y1: y });
      else if (zoomOn)
        setDragBoth({ kind: "pan", startX: e.clientX, startY: e.clientY, from: view });
    };
    const onPlotPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      const { x, y } = local(e);
      if (d?.kind === "pan") {
        viewApi.set(viewApi.panned(d.from, e.clientX - d.startX, e.clientY - d.startY, box));
        return;
      }
      if (d?.kind === "lasso") {
        const last = d.pts[d.pts.length - 1]!;
        if (Math.hypot(x - last[0], y - last[1]) > 3)
          setDragBoth({ kind: "lasso", pts: [...d.pts, [x, y]] });
        return;
      }
      if (d?.kind === "rect") {
        setDragBoth({
          ...d,
          x1: Math.min(Math.max(x, box.left), box.left + box.width),
          y1: Math.min(Math.max(y, box.top), box.top + box.height),
        });
        return;
      }
      hover(x, y);
    };
    const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d) return;
      setDragBoth(null);
      const mode = modeFor(e);
      if (d.kind === "lasso") {
        if (d.pts.length >= 3) {
          const path = d.pts.map(([px, py]) => viewApi.toData(px, py, box));
          setSelection(withConstraint(selection, { lasso: path }));
          emit({
            field: selectionField ?? xKey,
            values: [],
            mode,
            gesture: { kind: "lasso", path: path.map(([px, py]) => ({ x: px, y: py })) },
          });
        }
      } else if (d.kind === "rect") {
        if (Math.abs(d.x1 - d.x0) >= 3 && Math.abs(d.y1 - d.y0) >= 3) {
          const [ax, ay] = viewApi.toData(d.x0, d.y0, box);
          const [bx, by] = viewApi.toData(d.x1, d.y1, box);
          const xr: [number, number] = [Math.min(ax, bx), Math.max(ax, bx)];
          const yr: [number, number] = [Math.min(ay, by), Math.max(ay, by)];
          setSelection(withConstraint(selection, { x: xr, y: yr }));
          emit({
            field: selectionField ?? xKey,
            values: [xr[0], xr[1]],
            mode,
            gesture: { kind: "rect", x: xr, y: yr },
          });
        }
      } else if (d.kind === "xaxis") {
        if (Math.abs(d.b - d.a) >= 3)
          commitRange(
            "x",
            viewApi.toData(d.a, 0, box)[0],
            viewApi.toData(d.b, 0, box)[0],
            mode,
            "pointer",
          );
        else clearRange("x");
      } else if (d.kind === "yaxis") {
        if (Math.abs(d.b - d.a) >= 3)
          commitRange(
            "y",
            viewApi.toData(0, d.a, box)[1],
            viewApi.toData(0, d.b, box)[1],
            mode,
            "pointer",
          );
        else clearRange("y");
      }
    };
    const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
      if (!zoomOn) return;
      e.preventDefault();
      const { x, y } = local(e);
      viewApi.zoomAt(Math.exp(e.deltaY * 0.0018), x, y, box);
      setTip(null);
    };
    // Wheel listeners must be non-passive to preventDefault page scroll.
    const plotAreaRef = useRef<HTMLDivElement | null>(null);
    const onWheelRef = useRef(onWheel);
    onWheelRef.current = onWheel;
    useEffect(() => {
      const el = plotAreaRef.current;
      if (!el) return;
      const handler = (e: WheelEvent) =>
        onWheelRef.current(e as unknown as React.WheelEvent<HTMLDivElement>);
      el.addEventListener("wheel", handler, { passive: false });
      return () => el.removeEventListener("wheel", handler);
    }, []);

    const onGutterPointerDown = (axis: "x" | "y") => (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!rangeOn || e.button !== 0) return;
      const { x, y } = local(e);
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragBoth(axis === "x" ? { kind: "xaxis", a: x, b: x } : { kind: "yaxis", a: y, b: y });
    };
    const onGutterPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      const { x, y } = local(e);
      if (d?.kind === "xaxis")
        setDragBoth({ ...d, b: Math.min(Math.max(x, box.left), box.left + box.width) });
      else if (d?.kind === "yaxis")
        setDragBoth({ ...d, b: Math.min(Math.max(y, box.top), box.top + box.height) });
    };

    // ── Hover tooltip (LOD-aware) ───────────────────────────────────────────
    const [tip, setTip] = useState<{
      x: number;
      y: number;
      node: ReactNode;
      mark: ChartTooltipRect;
    } | null>(null);
    const hover = (px: number, py: number) => {
      const grid = gridRef.current;
      if (!grid) return;
      const idx = cellAt(grid, box, px, py);
      const count = idx < 0 ? 0 : grid.counts[idx]!;
      if (!count) {
        setTip(null);
        return;
      }
      const [dx, dy] = viewApi.toData(px, py, box);
      const xName = typeof xLabel === "string" ? xLabel : "x";
      const yName = typeof yLabel === "string" ? yLabel : "y";
      const valueName =
        resolvedColorBy.kind === "value" ? resolvedColorBy.key : (valueKey ?? labels.mean);
      let node: ReactNode;
      if (count >= CLUSTER_TOOLTIP_FROM) {
        const base = idx * grid.classCount;
        const rows: TooltipRow[] = [];
        if (paint.classes.length > 1) {
          paint.classes.forEach((c, k) => {
            const share = grid.classCounts[base + k]!;
            if (share)
              rows.push({
                color: colors.outlines[k]!,
                label: c.label,
                value: `${Math.round((100 * share) / count)} %`,
              });
          });
        }
        if (valueColumn)
          rows.push({
            color: "transparent",
            label: `${labels.mean} ${valueName}`,
            value: formatValue(grid.sums[idx]! / count),
          });
        rows.push({ color: "transparent", label: xName, value: formatX(dx), muted: true });
        rows.push({ color: "transparent", label: yName, value: formatY(dy), muted: true });
        node = (
          <ChartTooltipContent
            rows={rows}
            title={labels.cluster.replace("{n}", nf.format(count))}
          />
        );
      } else {
        const i = grid.firstIndex[idx]!;
        const k = paint.cls[i]!;
        const rows: TooltipRow[] = [];
        if (paint.classes.length > 1)
          rows.push({
            color: colors.outlines[k]!,
            label: paint.classes[k]?.label ?? "",
            value: "",
          });
        rows.push({ color: "transparent", label: xName, value: formatX(points.x[i]!) });
        rows.push({ color: "transparent", label: yName, value: formatY(points.y[i]!) });
        if (valueColumn)
          rows.push({
            color: "transparent",
            label: valueName,
            value: formatValue(valueColumn[i]!),
          });
        const title = `${labels.point}${count > 1 ? ` · 1/${count}` : ""}${
          hasSel && !selectedBytes[i] ? ` · ${labels.notSelected}` : ""
        }`;
        node = <ChartTooltipContent rows={rows} title={title} />;
      }
      // The hovered grid cell in container px: the hit area for a cluster AND a lone point.
      const mark = {
        x: box.left + (idx % grid.cols) * grid.cell,
        y: box.top + Math.floor(idx / grid.cols) * grid.cell,
        width: grid.cell,
        height: grid.cell,
      };
      setTip({ x: px, y: py, node, mark });
    };

    // ── Legend (RM-118): hide/show via the engine; Shift/Ctrl+click selects ─
    // F09: `legend={{ values: true }}` prints each class's point count. It is
    // counted only then: one pass over every point.
    const legendValues = legendWantsValues(legend);
    const legendItems = useMemo<ChartLegendEntry[]>(() => {
      const counts = legendValues ? countClasses(paint.cls, paint.classes.length) : null;
      const hideOutside = outside?.legend === false;
      return paint.classes.flatMap((c, k) =>
        hideOutside && c.key === DENSITY_OUTSIDE_ID
          ? []
          : [
              {
                key: c.key,
                label: c.label,
                color: c.color,
                kind: "color" as const,
                ...(counts ? { value: counts[k] } : {}),
              },
            ],
      );
    }, [paint.classes, paint.cls, legendValues, outside?.legend]);
    const legendConfig: ContainerLegendProp | undefined =
      legend === true
        ? { interactive: "toggle" }
        : legend && typeof legend === "object"
          ? { interactive: "toggle", ...legend }
          : legend;
    const pendingToggleRef = useRef<string | null>(null);
    const containerLegend = useContainerLegend({
      legend: legendConfig,
      items: legendItems,
      hiddenKeys,
      onToggleKey: (key) => {
        // Deferred: `ChartLegend` calls `onItemClick` (with the event) right after.
        pendingToggleRef.current = key;
      },
      onItemClick: (key, event) => {
        const pending = pendingToggleRef.current;
        pendingToggleRef.current = null;
        const zoneKey = paint.classes.find(
          (c) => c.key === key && !(c.key === DENSITY_OUTSIDE_ID && outside?.selectable === false),
        )?.key;
        if (
          (event.shiftKey || event.ctrlKey || event.metaKey) &&
          selectLayer &&
          zoneKey &&
          resolvedColorBy.kind === "zone"
        ) {
          setSelection(toggleZoneConstraint(selection, zoneKey));
          emit({
            field: "zone",
            values: [zoneKey],
            mode: modeFor(event),
            gesture: { kind: "click", category: zoneKey },
            source: "pointer",
          });
          return;
        }
        if (pending !== null) {
          const next = new Set(hiddenKeys);
          if (next.has(pending)) next.delete(pending);
          else next.add(pending);
          setHidden(next);
        }
      },
    });

    // ── A11y text ───────────────────────────────────────────────────────────
    const autoDescription = useMemo(() => {
      const ex = columnExtent(points.x);
      const ey = columnExtent(points.y);
      const parts = [`${nf.format(points.n)} points`];
      if (ex) parts.push(`x from ${formatX(ex[0])} to ${formatX(ex[1])}`);
      if (ey) parts.push(`y from ${formatY(ey[0])} to ${formatY(ey[1])}`);
      if (zones.length) {
        const shares = [...zones.map((z) => z.label), outside?.label ?? labels.outside]
          .map(
            (label, k) => `${label} ${Math.round((100 * zoneCounts[k]!) / Math.max(points.n, 1))}%`,
          )
          .join(", ");
        parts.push(`zones: ${shares}`);
      }
      return parts.join("; ");
    }, [points, zones, zoneCounts, outside, labels.outside, formatX, formatY]);
    const description = accessibleDescription ?? autoDescription;
    const {
      role,
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedby,
      tabIndex,
      descId,
    } = useChartA11yContainerProps(accessibleLabel, description);
    const liveText = useMemo(
      () =>
        hasSel && frameStats
          ? labels.selected
              .replace("{selected}", nf.format(frameStats.selected))
              .replace("{total}", nf.format(frameStats.visible))
          : "",
      [hasSel, frameStats, labels.selected],
    );

    // ── Keyboard range sliders (APG multi-thumb) ────────────────────────────
    const sliderId = useId();
    const onThumbKey =
      (axis: "x" | "y", thumb: 0 | 1) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
        const range = axis === "x" ? [view.x0, view.x1] : [view.y0, view.y1];
        const current = (axis === "x" ? selection?.x : selection?.y) ?? (range as [number, number]);
        const span = range[1]! - range[0]!;
        const stepSize = span * 0.01 * (e.shiftKey ? 10 : 1);
        let value = current[thumb];
        switch (e.key) {
          case "ArrowRight":
          case "ArrowUp":
            value += stepSize;
            break;
          case "ArrowLeft":
          case "ArrowDown":
            value -= stepSize;
            break;
          case "PageUp":
            value += span * 0.1;
            break;
          case "PageDown":
            value -= span * 0.1;
            break;
          case "Home":
            value = range[0]!;
            break;
          case "End":
            value = range[1]!;
            break;
          case "Escape":
            e.preventDefault();
            e.stopPropagation();
            clearRange(axis);
            return;
          default:
            return;
        }
        e.preventDefault();
        value = Math.min(Math.max(value, range[0]!), range[1]!);
        const next: [number, number] =
          thumb === 0
            ? [Math.min(value, current[1]), current[1]]
            : [current[0], Math.max(value, current[0])];
        commitRange(axis, next[0], next[1], "replace", "keyboard");
      };

    // ── Geometry helpers for the overlay ────────────────────────────────────
    // An unbounded rectangle edge (`x` omitted) is ±Infinity in data units —
    // clamp to the window so the overlay never receives a non-finite coordinate.
    const clampX = (x: number) =>
      Math.min(Math.max(x, view.x0 - (view.x1 - view.x0)), view.x1 + (view.x1 - view.x0));
    const clampY = (y: number) =>
      Math.min(Math.max(y, view.y0 - (view.y1 - view.y0)), view.y1 + (view.y1 - view.y0));
    const px = (x: number) => viewApi.toPixel(clampX(x), 0, box)[0];
    const py = (y: number) => viewApi.toPixel(0, clampY(y), box)[1];
    const xTicks =
      box.width > 0
        ? ticks(view.x0, view.x1, Math.max(3, Math.min(10, Math.round(box.width / 90))))
        : [];
    const yTicks =
      box.height > 0
        ? ticks(view.y0, view.y1, Math.max(3, Math.min(8, Math.round(box.height / 60))))
        : [];
    const gutterCursor = rangeOn ? "cursor-col-resize" : "";
    const zoneTags = (showZoneTags ? zones : []).flatMap((z, k) => {
      const outline = zoneOutline(z);
      const start = outline[0]?.[0];
      // A degenerate zone (a polygon under 3 vertices) has no outline and no tag.
      if (!start) return [];
      // An unbounded edge starts at -Infinity: the tag sits at the window's left edge instead.
      const [tx, ty] = viewApi.toPixel(Math.max(start[0], view.x0), start[1], box);
      return [{ zone: z, k, x: tx, y: ty, selected: selection?.zones?.includes(z.id) ?? false }];
    });
    const overlay = renderOverlay
      ? renderOverlay({
          view,
          box,
          width,
          height,
          toPixel: (x: number, y: number) => viewApi.toPixel(x, y, box),
          toData: (x: number, y: number) => viewApi.toData(x, y, box),
        })
      : null;

    const clearAll = () => {
      if (selectLayer && selection && Object.keys(selection).length) setSelection({});
    };

    return containerSelection.wrap(
      containerLegend.wrap(
        <ChartPlotRoot
          aria-describedby={ariaDescribedby}
          aria-label={ariaLabel}
          className={cn("relative w-full select-none overflow-hidden", className)}
          data-renderer={rendererKind}
          data-selection-tool={containerSelection.session.enabled ? tool : undefined}
          data-slot="density-scatter-chart"
          onKeyDown={(e) => {
            // Esc anywhere in the chart drops every constraint (a thumb's own
            // Esc, which clears one axis, stops propagation first).
            if (e.key === "Escape") {
              e.preventDefault();
              clearAll();
            }
          }}
          plotBox={{ aspectRatio, plotHeight, defaultPlotHeight: DEFAULT_CHART_PLOT_HEIGHT }}
          ref={setRootRef}
          role={role}
          style={{ touchAction: activeLayer ? "none" : CHART_TOUCH_ACTION, ...style }}
          tabIndex={tabIndex}
          {...props}
        >
          <ChartA11yLabel descId={descId} description={description} />
          <canvas
            aria-hidden="true"
            className="absolute inset-0 size-full"
            data-slot="density-scatter-chart-ground"
            ref={bgRef}
          />
          <canvas
            aria-hidden="true"
            className="absolute inset-0 size-full"
            data-slot="density-scatter-chart-points"
            ref={setPtsRef}
          />

          {/* Overlay: grid, zones, selection, live gesture. */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full overflow-visible"
            data-slot="density-scatter-chart-overlay"
          >
            <defs>
              <clipPath id={`${sliderId}-clip`}>
                <rect height={box.height} width={box.width} x={box.left} y={box.top} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${sliderId}-clip)`}>
              <g stroke="var(--chart-grid)" strokeWidth={CHART_HAIRLINE_WIDTH}>
                {xTicks.map((t) => (
                  <line
                    key={`gx${t}`}
                    x1={px(t)}
                    x2={px(t)}
                    y1={box.top}
                    y2={box.top + box.height}
                  />
                ))}
                {yTicks.map((t) => (
                  <line
                    key={`gy${t}`}
                    x1={box.left}
                    x2={box.left + box.width}
                    y1={py(t)}
                    y2={py(t)}
                  />
                ))}
              </g>
              {selection?.x ? (
                <rect
                  className="fill-chart-foreground-muted"
                  fillOpacity={0.12}
                  height={box.height}
                  width={Math.abs(px(selection.x[1]) - px(selection.x[0]))}
                  x={Math.min(px(selection.x[0]), px(selection.x[1]))}
                  y={box.top}
                />
              ) : null}
              {selection?.y ? (
                <rect
                  className="fill-chart-foreground-muted"
                  fillOpacity={0.12}
                  height={Math.abs(py(selection.y[1]) - py(selection.y[0]))}
                  width={box.width}
                  x={box.left}
                  y={Math.min(py(selection.y[0]), py(selection.y[1]))}
                />
              ) : null}
              {selection?.lasso && selection.lasso.length >= 3 ? (
                <polygon
                  className="fill-chart-foreground-muted"
                  fillOpacity={0.12}
                  points={selection.lasso.map(([lx, ly]) => `${px(lx)},${py(ly)}`).join(" ")}
                  stroke="var(--chart-foreground)"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                />
              ) : null}
              {zones.map((z, k) => (
                <g
                  fill="none"
                  key={z.id}
                  opacity={hiddenFlags[k] ? 0.3 : 1}
                  stroke={colors.outlines[k]}
                  strokeDasharray={z.invert ? "6 4" : undefined}
                  strokeWidth={1.25}
                >
                  {zoneOutline(z).map((poly, edge) => (
                    // A fixed edge order per zone shape (see `zoneOutline`) — the index IS the id.
                    <polyline
                      key={`${z.id}-edge-${edge}`}
                      points={poly.map(([zx, zy]) => `${px(zx)},${py(zy)}`).join(" ")}
                    />
                  ))}
                </g>
              ))}
              {drag?.kind === "rect" ? (
                <rect
                  className="fill-chart-foreground-muted"
                  fillOpacity={0.14}
                  height={Math.abs(drag.y1 - drag.y0)}
                  stroke="var(--chart-foreground)"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  width={Math.abs(drag.x1 - drag.x0)}
                  x={Math.min(drag.x0, drag.x1)}
                  y={Math.min(drag.y0, drag.y1)}
                />
              ) : null}
              {drag?.kind === "xaxis" ? (
                <rect
                  className="fill-chart-foreground-muted"
                  fillOpacity={0.14}
                  height={box.height}
                  stroke="var(--chart-foreground)"
                  strokeWidth={1}
                  width={Math.abs(drag.b - drag.a)}
                  x={Math.min(drag.a, drag.b)}
                  y={box.top}
                />
              ) : null}
              {drag?.kind === "yaxis" ? (
                <rect
                  className="fill-chart-foreground-muted"
                  fillOpacity={0.14}
                  height={Math.abs(drag.b - drag.a)}
                  stroke="var(--chart-foreground)"
                  strokeWidth={1}
                  width={box.width}
                  x={box.left}
                  y={Math.min(drag.a, drag.b)}
                />
              ) : null}
              {drag?.kind === "lasso" && drag.pts.length > 1 ? (
                <polygon
                  className="fill-chart-foreground-muted"
                  fillOpacity={0.14}
                  points={drag.pts.map(([lx, ly]) => `${lx},${ly}`).join(" ")}
                  stroke="var(--chart-foreground)"
                  strokeWidth={1.25}
                />
              ) : null}
            </g>
            {/* Range brackets in the gutters. */}
            {selection?.x ? (
              <path
                d={`M${px(selection.x[0])},${box.top + box.height + 7} v-6 H${px(selection.x[1])} v6`}
                fill="none"
                stroke="var(--chart-foreground)"
                strokeWidth={2}
              />
            ) : null}
            {selection?.y ? (
              <path
                d={`M${box.left - 7},${py(selection.y[0])} h6 V${py(selection.y[1])} h-6`}
                fill="none"
                stroke="var(--chart-foreground)"
                strokeWidth={2}
              />
            ) : null}
            <line
              stroke="var(--chart-grid)"
              strokeWidth={CHART_HAIRLINE_WIDTH}
              x1={box.left}
              x2={box.left + box.width}
              y1={box.top + box.height}
              y2={box.top + box.height}
            />
            <line
              stroke="var(--chart-grid)"
              strokeWidth={CHART_HAIRLINE_WIDTH}
              x1={box.left}
              x2={box.left}
              y1={box.top}
              y2={box.top + box.height}
            />
          </svg>

          {/* Axis tick labels (HTML, the package's x-axis convention). */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {xTicks.map((t) => (
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap text-chart-label text-meta tabular-nums"
                key={`x${t}`}
                style={{ left: px(t), top: box.top + box.height + 6 }}
              >
                {formatX(t)}
              </span>
            ))}
            {yTicks.map((t) => (
              <span
                className="absolute -translate-y-1/2 whitespace-nowrap text-chart-label text-meta tabular-nums"
                key={`y${t}`}
                style={{ right: width - box.left + 8, top: py(t) }}
              >
                {formatY(t)}
              </span>
            ))}
            {xLabel ? (
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap text-chart-label text-meta"
                style={{ left: box.left + box.width / 2, bottom: 2 }}
              >
                {xLabel}
              </span>
            ) : null}
            {yLabel ? (
              <span
                className="absolute origin-center -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-chart-label text-meta"
                style={{ left: 10, top: box.top + box.height / 2 }}
              >
                {yLabel}
              </span>
            ) : null}
          </div>

          {/* The plot area: pan / lasso / wheel / hover. */}
          <div
            className={cn(
              "absolute",
              lassoOn || rectOn
                ? "cursor-crosshair"
                : zoomOn
                  ? drag?.kind === "pan"
                    ? "cursor-grabbing"
                    : "cursor-grab"
                  : "",
            )}
            data-slot="density-scatter-chart-plot"
            onDoubleClick={activeLayer ? () => viewApi.reset() : undefined}
            onPointerCancel={endDrag}
            onPointerDown={onPlotPointerDown}
            onPointerLeave={() => setTip(null)}
            onPointerMove={onPlotPointerMove}
            onPointerUp={endDrag}
            ref={plotAreaRef}
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          />
          {/* Axis gutters: drag = range select. */}
          {rangeOn ? (
            <>
              <div
                className={cn("absolute", gutterCursor)}
                data-slot="density-scatter-chart-x-gutter"
                onPointerCancel={endDrag}
                onPointerDown={onGutterPointerDown("x")}
                onPointerMove={onGutterPointerMove}
                onPointerUp={endDrag}
                style={{
                  left: box.left,
                  top: box.top + box.height,
                  width: box.width,
                  height: margin.bottom,
                }}
              />
              <div
                className={cn("absolute", rangeOn && "cursor-row-resize")}
                data-slot="density-scatter-chart-y-gutter"
                onPointerCancel={endDrag}
                onPointerDown={onGutterPointerDown("y")}
                onPointerMove={onGutterPointerMove}
                onPointerUp={endDrag}
                style={{ left: 0, top: box.top, width: margin.left, height: box.height }}
              />
              {/* Keyboard parity: two thumbs per axis, outside the canvas. */}
              {(["x", "y"] as const).map((axis) => {
                const range = axis === "x" ? [view.x0, view.x1] : [view.y0, view.y1];
                const current =
                  (axis === "x" ? selection?.x : selection?.y) ?? (range as [number, number]);
                const fmt = axis === "x" ? formatX : formatY;
                return (
                  <div
                    aria-label={axis === "x" ? labels.xRange : labels.yRange}
                    // Keyboard-only: the pointer path is the gutter underneath (same
                    // layering as `ChartDatapointLayer`); the thumbs re-enable
                    // pointer events for themselves so they remain clickable.
                    className="pointer-events-none absolute"
                    data-slot={`density-scatter-chart-${axis}-sliders`}
                    key={axis}
                    role="group"
                    style={
                      axis === "x"
                        ? {
                            left: box.left,
                            top: box.top + box.height,
                            width: box.width,
                            height: margin.bottom,
                          }
                        : { left: 0, top: box.top, width: margin.left, height: box.height }
                    }
                  >
                    {([0, 1] as const).map((thumb) => {
                      const value = current[thumb];
                      const pos = axis === "x" ? px(value) - box.left : py(value) - box.top;
                      return (
                        <button
                          aria-label={`${axis === "x" ? labels.xRange : labels.yRange} ${thumb === 0 ? labels.from : labels.to}`}
                          aria-orientation={axis === "x" ? "horizontal" : "vertical"}
                          aria-valuemax={range[1]}
                          aria-valuemin={range[0]}
                          aria-valuenow={value}
                          aria-valuetext={fmt(value)}
                          className="focus-ring pointer-events-auto absolute size-3 rounded-full bg-transparent focus-visible:bg-chart-foreground"
                          key={thumb}
                          onKeyDown={onThumbKey(axis, thumb)}
                          role="slider"
                          style={
                            axis === "x"
                              ? { left: pos - 6, top: 2 }
                              : { top: pos - 6, left: margin.left - 14 }
                          }
                          tabIndex={0}
                          type="button"
                        />
                      );
                    })}
                  </div>
                );
              })}
            </>
          ) : null}

          {/* Zone tags: named, real buttons; plain click selects the zone. */}
          {zoneTags.map(({ zone, k, x, y, selected }) =>
            x >= box.left &&
            x <= box.left + box.width &&
            y >= box.top &&
            y <= box.top + box.height ? (
              <button
                aria-label={labels.selectZone.replace("{zone}", zone.label)}
                aria-pressed={selected}
                className={cn(
                  "focus-ring absolute -translate-y-full rounded-sm border bg-card px-1.5 py-0.5 text-meta leading-none",
                  selected ? "border-foreground" : "border-border",
                  hiddenFlags[k] && "opacity-40",
                )}
                data-slot="density-scatter-chart-zone-tag"
                key={zone.id}
                onClick={(e: ReactMouseEvent<HTMLButtonElement>) => {
                  // The tag stays (it names the zone); selecting is a no-op without `select`.
                  if (!selectLayer) return;
                  setSelection(toggleZoneConstraint(selection, zone.id));
                  emit({
                    field: "zone",
                    values: [zone.id],
                    mode: modeFor(e),
                    gesture: { kind: "click", category: zone.id },
                    source: e.detail === 0 ? "keyboard" : "pointer",
                  });
                }}
                style={{
                  left: x + 4,
                  top: y - 2,
                  borderLeftWidth: 3,
                  borderLeftColor: colors.outlines[k],
                }}
                type="button"
              >
                {zone.label}
              </button>
            ) : null,
          )}

          {overlay ? (
            <div
              className="pointer-events-none absolute inset-0"
              data-slot="density-scatter-chart-host-overlay"
            >
              {overlay}
            </div>
          ) : null}

          <span
            aria-live="polite"
            className="sr-only"
            data-slot="density-scatter-chart-status"
            role="status"
          >
            {liveText}
          </span>

          {tip ? (
            <ChartTooltipBox
              avoid={tip.mark}
              containerHeight={height}
              containerRef={rootRef}
              containerWidth={width}
              visible
              x={tip.x}
              y={tip.y}
            >
              {tip.node}
            </ChartTooltipBox>
          ) : null}
        </ChartPlotRoot>,
      ),
    );
  },
);
DensityScatterChart.displayName = "DensityScatterChart";
