"use client";

import {
  cloneElement,
  createContext,
  forwardRef,
  type ReactElement,
  type ReactNode,
  type SVGProps,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react";
import { CHART_HAIRLINE_WIDTH } from "../../chart-hairline";
import { HaloText } from "../../marks/halo-text";
import { Marginalia, noteLineHeight, wrapNote } from "../../marks/marginalia";
import { PeakRing } from "../../marks/peak-ring";
import { useChartA11yContainerProps } from "../chart-a11y";
import { useChartBreakpoint, warnChartOnce } from "../chart-breakpoint";
import ChartStableContext, { chartCssVars, type LineConfig } from "../chart-context";
import { PatternLines } from "../visx-pattern";
import { DEFAULT_Y_AXIS_ID } from "../y-axis-scales";
import {
  type AnnotationAnchor,
  type AnnotationColor,
  type AnnotationValue,
  type ChartAnnotation,
  type ChartLineAnnotation,
  type ChartRangeAnnotation,
  type ChartRowAnnotation,
  type ChartTextAnnotation,
  planAnnotations,
  withAnnotationDescription,
} from "./annotation-types";
import {
  annotationValueToDate,
  type AnnotationScales,
  bandAxis,
  resolveAnnotationPosition,
  timeAxis,
  valueAxis,
} from "./resolve-annotation-position";
import type { LabelAnchorSide, LabelRect } from "../labels/label-layout";
import { seriesLabelInk } from "../labels/series-label-ink";
import { useTextMeasurerOf } from "../use-text-measurer";
import {
  type AnnotationBox,
  annotationLayoutBounds,
  layoutAnnotationBoxes,
} from "./annotation-layout";
import {
  useAnnotationLayoutScope,
  useAnnotationObstacles,
  useReportDemotedAnnotations,
} from "./annotation-layout-context";

/** Note font size in px — one step above the `Marginalia` default: an annotation explains the chart. */
const NOTE_FONT_SIZE = 11;
/** Default note width, as a percentage of the plot width. */
const DEFAULT_NOTE_WIDTH_PERCENT = 25;
/** Numbered-marker radius at `narrow`, in px. */
const MARKER_RADIUS = 8;
/** Inset of a range / line label from its band edge, in px. */
const LABEL_INSET = 4;
/** Stripe pitch of a `pattern: "stripes"` range, in px. */
const STRIPE_PITCH = 6;
/**
 * A hatch is a FILL drawn in the furniture ink, not a hairline: at the 0.65px
 * hairline weight a 6px hatch reads as a flat tint, so it doubles the weight.
 */
const STRIPE_WIDTH = CHART_HAIRLINE_WIDTH * 2;

/**
 * A solid range is a pale band behind the series (the `AreaBand` fill), at
 * full opacity; its stripes and every reference line keep the furniture ink.
 */
const RANGE_FILL = "var(--chart-ring-background)";

const LINE_DASH: Record<NonNullable<ChartLineAnnotation["style"]>, string | undefined> = {
  solid: undefined,
  dashed: "4 3",
  dotted: "1 3",
};

const NO_LINES: readonly LineConfig[] = [];

/** Which of the two stacking passes to paint. */
export type ChartAnnotationsLayer = "back" | "front" | "all";

export interface ChartAnnotationsProps extends Omit<SVGProps<SVGGElement>, "children"> {
  /** The annotations, in reading order (the narrow key numbers them in this order). */
  annotations: readonly ChartAnnotation[];
  /**
   * `back` paints ranges (behind the marks), `front` paints lines, rows, notes
   * and narrow markers (over the marks), `all` paints both in place. A chart
   * shell that finds this layer among its children paints it twice, `back`
   * first and `front` over the series, so a consumer never sets this.
   */
  layer?: ChartAnnotationsLayer;
  /** Value axis the `y` positions resolve against. Default: the primary axis. */
  yAxisId?: string | number;
}

/** A resolved note ink: a series stroke, a ramp token, or the muted ink. */
export function resolveAnnotationInk(
  color: AnnotationColor | undefined,
  lines: readonly LineConfig[] = [],
): string {
  if (color === undefined || color === "muted") return chartCssVars.foregroundMuted;
  if (color.startsWith("series:")) {
    const key = color.slice("series:".length);
    return lines.find((line) => line.dataKey === key)?.stroke ?? chartCssVars.foregroundMuted;
  }
  return color;
}

/**
 * The TEXT ink of an annotation: a series or ramp colour pulled toward the
 * label ink by `seriesLabelInk` (RM-110) so 11px text stays ≥ 4.5:1; the muted ink
 * as is. Connectors and marker rings use `resolveAnnotationInk` (pure stroke).
 */
export function resolveAnnotationTextInk(
  color: AnnotationColor | undefined,
  lines: readonly LineConfig[] = [],
): string {
  const ink = resolveAnnotationInk(color, lines);
  return ink === chartCssVars.foregroundMuted ? ink : seriesLabelInk(ink);
}

/** The anchor's horizontal text alignment and vertical block edge. */
function anchorParts(anchor: AnnotationAnchor): {
  textAnchor: "start" | "middle" | "end";
  edge: "top" | "middle" | "bottom";
} {
  const textAnchor = anchor.includes("w") ? "start" : anchor.includes("e") ? "end" : "middle";
  const edge = anchor.startsWith("n") ? "top" : anchor.startsWith("s") ? "bottom" : "middle";
  return { textAnchor, edge };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** The plot's annotation scales, read from the enclosing chart container. */
/**
 * The scales of a container that draws its own plot without a `ChartProvider`
 * (`DumbbellChart`). `ChartAnnotations` prefers these over the chart context.
 */
export const AnnotationScalesContext = createContext<AnnotationScales | null>(null);

function useAnnotationScales(yAxisId: string | number | undefined): AnnotationScales {
  const provided = useContext(AnnotationScalesContext);
  const stable = useContext(ChartStableContext);
  return useMemo<AnnotationScales>(() => {
    if (provided) return provided;
    if (!stable) {
      throw new Error(
        "ChartAnnotations must be a child of a cartesian chart (LineChart, AreaChart, BarChart, " +
          "ComposedChart, ScatterChart), or be passed as that container's `annotations` prop.",
      );
    }
    const { xScale, innerWidth, innerHeight, orientation, barScale, xValueToPosition, xScaleType } =
      stable;
    const axisId = yAxisId == null || yAxisId === "" ? DEFAULT_Y_AXIS_ID : String(yAxisId);
    const yScale = stable.yScales[axisId] ?? stable.yScale;
    if (barScale) {
      const band = bandAxis(barScale);
      const value = valueAxis(yScale);
      return orientation === "horizontal"
        ? { x: value, y: band, innerWidth, innerHeight, category: "y" }
        : { x: band, y: value, innerWidth, innerHeight, category: "x" };
    }
    const timeMode = xScaleType === undefined || xScaleType === "time";
    const project = (value: AnnotationValue) => {
      // A time shell reads ISO strings as local dates; a `band`/`linear` shell
      // projects the RAW domain value, exactly as `Grid.highlightColumnValues`.
      const raw = timeMode && typeof value === "string" ? annotationValueToDate(value) : value;
      if (raw === undefined) return undefined;
      return xValueToPosition ? xValueToPosition(raw) : annotationValueToDate(raw);
    };
    return { x: timeAxis(xScale, project), y: valueAxis(yScale), innerWidth, innerHeight };
  }, [provided, stable, yAxisId]);
}

export interface AnnotationLineMarkProps {
  /** `y`: a horizontal line at a value; `x`: a vertical line. */
  axis: "x" | "y";
  /** Pixel position along the other axis. */
  position: number;
  innerWidth: number;
  innerHeight: number;
  label?: string;
  stroke: string;
  strokeWidth: number;
  strokeOpacity?: number;
  strokeDasharray?: string;
}

/**
 * One reference line and its label — the `line` annotation's renderer. A `y`
 * line labels at its right end, above the line; an `x` line labels bottom-
 * inside, left of the line (the top strip belongs to the `y` labels).
 */
export function AnnotationLineMark({
  axis,
  position,
  innerWidth,
  innerHeight,
  label,
  stroke,
  strokeWidth,
  strokeOpacity,
  strokeDasharray,
}: AnnotationLineMarkProps) {
  const horizontal = axis === "y";
  // No attributes on the group: `Grid`'s highlight rows/columns render through
  // this mark and must keep their exact DOM.
  return (
    <g>
      <line
        stroke={stroke}
        strokeDasharray={strokeDasharray}
        strokeOpacity={strokeOpacity}
        strokeWidth={strokeWidth}
        x1={horizontal ? 0 : position}
        x2={horizontal ? innerWidth : position}
        y1={horizontal ? position : 0}
        y2={horizontal ? position : innerHeight}
      />
      {label ? (
        <HaloText
          dy={-LABEL_INSET}
          fontSize={NOTE_FONT_SIZE}
          textAnchor="end"
          x={horizontal ? innerWidth : position - LABEL_INSET}
          y={horizontal ? position : innerHeight}
        >
          {label}
        </HaloText>
      ) : null}
    </g>
  );
}

function renderRange(
  annotation: ChartRangeAnnotation,
  index: number,
  scales: AnnotationScales,
  patternId: string,
  lines: readonly LineConfig[],
): ReactNode {
  const isX = annotation.x1 !== undefined;
  const span = isX
    ? scales.x.span(annotation.x1, annotation.x2 as AnnotationValue)
    : scales.y.span(annotation.y1 as AnnotationValue, annotation.y2 as AnnotationValue);
  if (!span) return null;
  const limit = isX ? scales.innerWidth : scales.innerHeight;
  const start = clamp(span[0], 0, limit);
  const end = clamp(span[1], 0, limit);
  if (end <= start) return null;
  const tinted = annotation.color !== undefined && annotation.color !== "muted";
  const ink = tinted ? resolveAnnotationInk(annotation.color, lines) : RANGE_FILL;
  const striped = annotation.pattern === "stripes";
  // A tinted striped band needs its own hatch: the shared pattern carries the furniture ink.
  const ownPatternId = `${patternId}-${index}`;
  const fill = striped ? `url(#${tinted ? ownPatternId : patternId})` : ink;
  return (
    <g data-annotation-index={index} data-slot="chart-annotations-range" key={`range-${index}`}>
      {striped && tinted ? (
        <defs>
          <PatternLines
            height={STRIPE_PITCH}
            id={ownPatternId}
            orientation={["diagonal"]}
            stroke={ink}
            strokeWidth={STRIPE_WIDTH}
            width={STRIPE_PITCH}
          />
        </defs>
      ) : null}
      <rect
        fill={fill}
        fillOpacity={annotation.opacity}
        height={isX ? scales.innerHeight : end - start}
        width={isX ? end - start : scales.innerWidth}
        x={isX ? start : 0}
        y={isX ? 0 : start}
      />
      {annotation.label ? (
        <HaloText
          dominantBaseline="hanging"
          fill={chartCssVars.foregroundMuted}
          fontSize={NOTE_FONT_SIZE}
          x={(isX ? start : 0) + LABEL_INSET}
          y={(isX ? 0 : start) + LABEL_INSET}
        >
          {annotation.label}
        </HaloText>
      ) : null}
    </g>
  );
}

function renderLine(
  annotation: ChartLineAnnotation,
  index: number,
  scales: AnnotationScales,
): ReactNode {
  const axis = annotation.y !== undefined ? "y" : "x";
  const position =
    axis === "y"
      ? scales.y.point(annotation.y as AnnotationValue)
      : scales.x.point(annotation.x as AnnotationValue);
  if (position === undefined) return null;
  return (
    <g data-annotation-index={index} data-slot="chart-annotations-line" key={`line-${index}`}>
      <AnnotationLineMark
        axis={axis}
        innerHeight={scales.innerHeight}
        innerWidth={scales.innerWidth}
        label={annotation.label}
        position={position}
        stroke={chartCssVars.grid}
        strokeDasharray={LINE_DASH[annotation.style ?? "solid"]}
        strokeWidth={annotation.width ?? CHART_HAIRLINE_WIDTH}
      />
    </g>
  );
}

/** Row-note text width runs a little wide for its bold `**…**` subset. */
const BOLD_WIDTH_FACTOR = 1.08;

/**
 * Row notes are pinned to their row, so the solver places them before the
 * free-floating text notes.
 */
const ROW_NOTE_PRIORITY = Number.MAX_SAFE_INTEGER;

/** Where a painted text or row note sits before layout, plus its box (plot px). */
interface NoteGeometry {
  kind: "text" | "row";
  /** Text x before any move. */
  x: number;
  /** Text y before any move: a text note's first-line centre, a row note's baseline point. */
  y: number;
  /** The box the solver places; `null` for a note it cannot measure (a React node). */
  box: LabelRect | null;
  priority: number;
  anchorSide: LabelAnchorSide;
  retryAnchorSide?: LabelAnchorSide;
  /** Text notes: the wrap width handed to `Marginalia`. */
  maxWidth?: number;
  textAnchor: "start" | "middle" | "end";
  /** Row notes: laid along the y axis (a horizontal chart). */
  onY?: boolean;
}

type MeasureNote = (text: string) => number;

function textNoteGeometry(
  annotation: ChartTextAnnotation,
  scales: AnnotationScales,
  measure: MeasureNote,
): NoteGeometry | null {
  const point = resolveAnnotationPosition(annotation, scales);
  if (!point) return null;
  const maxWidth =
    (scales.innerWidth * clamp(annotation.width ?? DEFAULT_NOTE_WIDTH_PERCENT, 1, 100)) / 100;
  const plain = typeof annotation.text === "string" ? annotation.text : null;
  const wrapped = plain === null ? null : wrapNote(plain, maxWidth, NOTE_FONT_SIZE);
  const lineCount = Math.max(1, wrapped?.length ?? 1);
  const pitch = noteLineHeight(NOTE_FONT_SIZE);
  const blockHeight = lineCount * pitch;
  const anchor = annotation.anchor ?? "nw";
  const { textAnchor, edge } = anchorParts(anchor);
  const rawTop =
    edge === "top"
      ? point.y
      : edge === "middle"
        ? point.y - blockHeight / 2
        : point.y - blockHeight;
  const top = clamp(rawTop, 0, scales.innerHeight - blockHeight);
  const x = clamp(point.x, 0, scales.innerWidth);
  let box: LabelRect | null = null;
  if (wrapped?.length) {
    const width = Math.max(...wrapped.map((line) => measure(line.text)));
    const left = textAnchor === "start" ? x : textAnchor === "end" ? x - width : x - width / 2;
    box = { x: left, y: top, width, height: blockHeight };
  }
  // A note beside its anchor (w / e and the corners) slides vertically; one
  // straight above or below it (n / s) slides horizontally.
  const beside = anchor !== "n" && anchor !== "s";
  return {
    kind: "text",
    x,
    y: top + pitch / 2,
    box,
    priority: annotation.priority ?? 0,
    anchorSide: beside ? "left" : "top",
    maxWidth: plain === null ? undefined : maxWidth,
    textAnchor,
  };
}

function rowNoteGeometry(
  annotation: ChartRowAnnotation,
  scales: AnnotationScales,
  measure: MeasureNote,
): NoteGeometry | null {
  if (!scales.category) return null;
  const onY = scales.category === "y";
  const at = scales[scales.category].point(annotation.category);
  if (at === undefined) return null;
  const x = onY ? scales.innerWidth : at;
  const y = onY ? at : LABEL_INSET;
  const height = noteLineHeight(NOTE_FONT_SIZE);
  let box: LabelRect | null = null;
  if (typeof annotation.text === "string") {
    const width = measure(annotation.text);
    box = onY
      ? { x: x - width, y: y - height / 2, width, height }
      : { x: x - width / 2, y, width, height };
  }
  // A row note slides along its row (x) first; a column's note may then
  // drop down its column (y).
  return {
    kind: "row",
    x,
    y,
    box,
    priority: ROW_NOTE_PRIORITY,
    anchorSide: "top",
    retryAnchorSide: onY ? "top" : "left",
    textAnchor: onY ? "end" : "middle",
    onY,
  };
}

/** Where a keyed row note puts its numbered marker: the note's own spot on the row. */
function rowMarkerPoint(
  annotation: ChartRowAnnotation,
  scales: AnnotationScales,
): { x: number; y: number } | null {
  if (!scales.category) return null;
  const at = scales[scales.category].point(annotation.category);
  if (at === undefined) return null;
  return scales.category === "y"
    ? { x: scales.innerWidth - MARKER_RADIUS, y: at }
    : { x: at, y: LABEL_INSET + MARKER_RADIUS };
}

function renderRow(
  annotation: ChartRowAnnotation,
  index: number,
  geometry: NoteGeometry,
  ink: string,
  move: { dx: number; dy: number } | undefined,
): ReactNode {
  return (
    <HaloText
      data-annotation-index={index}
      data-slot="chart-annotations-row"
      dominantBaseline={geometry.onY ? "middle" : "hanging"}
      fill={ink}
      fontSize={NOTE_FONT_SIZE}
      key={`row-${index}`}
      textAnchor={geometry.textAnchor}
      x={geometry.x + (move?.dx ?? 0)}
      y={geometry.y + (move?.dy ?? 0)}
    >
      {renderRowText(annotation.text)}
    </HaloText>
  );
}

/** A one-line row note with its inline `**bold**` subset as bold `<tspan>`s. */
function renderRowText(text: ReactNode): ReactNode {
  if (typeof text !== "string" || !text.includes("**")) return text;
  const out: ReactNode[] = [];
  let offset = 0;
  let bold = false;
  for (const part of text.split("**")) {
    if (part) {
      out.push(
        <tspan fontWeight={bold ? "bold" : undefined} key={`${offset}:${part}`}>
          {part}
        </tspan>,
      );
    }
    offset += part.length + 2;
    bold = !bold;
  }
  return out;
}

function renderNote(
  annotation: ChartTextAnnotation,
  index: number,
  geometry: NoteGeometry,
  scales: AnnotationScales,
  lines: readonly LineConfig[],
  move: { dx: number; dy: number } | undefined,
): ReactNode {
  const point = resolveAnnotationPosition(annotation, scales);
  if (!point) return null;
  const target = annotation.connector
    ? resolveAnnotationPosition(annotation.connector.to, scales)
    : undefined;
  return (
    <g
      data-annotation-index={index}
      data-annotation-x={Math.round(point.x)}
      data-annotation-y={Math.round(point.y)}
      data-slot="chart-annotations-text"
      key={`text-${index}`}
    >
      <Marginalia
        anchor={target ? [target.x, target.y] : undefined}
        arrow={annotation.connector?.arrow}
        fontSize={NOTE_FONT_SIZE}
        leaderKind={annotation.connector?.kind}
        leaderStroke={annotation.color ? resolveAnnotationInk(annotation.color, lines) : undefined}
        maxWidth={geometry.maxWidth}
        noteFill={resolveAnnotationTextInk(annotation.color, lines)}
        textAnchor={geometry.textAnchor}
        x={geometry.x + (move?.dx ?? 0)}
        y={geometry.y + (move?.dy ?? 0)}
      >
        {annotation.text}
      </Marginalia>
    </g>
  );
}

function renderMarker(
  annotation: ChartTextAnnotation | ChartRowAnnotation,
  index: number,
  number: number,
  point: { x: number; y: number },
  scales: AnnotationScales,
  lines: readonly LineConfig[],
): ReactNode {
  const cx = clamp(point.x, MARKER_RADIUS, scales.innerWidth - MARKER_RADIUS);
  const cy = clamp(point.y, MARKER_RADIUS, scales.innerHeight - MARKER_RADIUS);
  return (
    <g
      data-annotation-index={index}
      data-annotation-number={number}
      data-slot="chart-annotations-marker"
      key={`marker-${index}`}
    >
      <circle cx={cx} cy={cy} fill={chartCssVars.background} r={MARKER_RADIUS} />
      <PeakRing
        cx={cx}
        cy={cy}
        r={MARKER_RADIUS}
        stroke={resolveAnnotationInk(annotation.color, lines)}
      />
      <text
        dominantBaseline="central"
        fill={resolveAnnotationTextInk(annotation.color, lines)}
        fontSize={NOTE_FONT_SIZE - 1}
        fontWeight="bold"
        textAnchor="middle"
        x={cx}
        y={cy}
      >
        {number}
      </text>
    </g>
  );
}

const formatAnchorValue = (value: AnnotationValue): string =>
  value instanceof Date ? value.toISOString() : JSON.stringify(value);

/** `annotations[1] (line "Goal")` — how a dev warning names an annotation. */
function annotationName(annotation: ChartAnnotation, index: number): string {
  const name =
    annotation.kind === "row"
      ? annotation.category
      : annotation.kind === "text"
        ? typeof annotation.text === "string"
          ? annotation.text
          : undefined
        : annotation.label;
  return `annotations[${index}] (${annotation.kind}${name ? ` "${name}"` : ""})`;
}

/**
 * Dev warnings for the anchors of `annotation` its axes cannot place. The
 * layer skips such an annotation (or its connector); this says why, naming
 * the annotation and the axis, instead of letting it vanish silently.
 */
function unresolvedAnchorWarnings(
  annotation: ChartAnnotation,
  index: number,
  scales: AnnotationScales,
): string[] {
  const warnings: string[] = [];
  const name = annotationName(annotation, index);
  const check = (field: string, axis: "x" | "y", value: AnnotationValue, connector = false) => {
    if (scales[axis].point(value) !== undefined) return;
    // A number or date looked up among the categories is almost always a value
    // given on the wrong axis (a `y` line on a horizontal bar chart).
    const hint =
      scales.category === axis && typeof value !== "string"
        ? ` The ${axis} axis is this chart's category axis; its value axis is ${axis === "x" ? "y" : "x"}.`
        : "";
    warnings.push(
      `[ChartAnnotations] ${name} ${connector ? "draws no connector" : "is not drawn"}: ` +
        `${field} ${formatAnchorValue(value)} does not resolve on the ${axis} axis.${hint}`,
    );
  };
  switch (annotation.kind) {
    case "range":
      if (annotation.x1 !== undefined) {
        check("x1", "x", annotation.x1);
        check("x2", "x", annotation.x2 as AnnotationValue);
      } else {
        check("y1", "y", annotation.y1 as AnnotationValue);
        check("y2", "y", annotation.y2 as AnnotationValue);
      }
      break;
    case "line":
      if (annotation.y !== undefined) check("y", "y", annotation.y);
      else check("x", "x", annotation.x as AnnotationValue);
      break;
    case "text":
      check("x", "x", annotation.x);
      check("y", "y", annotation.y);
      if (annotation.connector) {
        check("connector.to.x", "x", annotation.connector.to.x, true);
        check("connector.to.y", "y", annotation.connector.to.y, true);
      }
      break;
    case "row":
      if (!scales.category) {
        warnings.push(
          `[ChartAnnotations] ${name} is not drawn: a row note needs a category axis ` +
            "(a bar, dumbbell or waterfall chart), and this chart has none.",
        );
      } else if (scales[scales.category].point(annotation.category) === undefined) {
        warnings.push(
          `[ChartAnnotations] ${name} is not drawn: category ` +
            `${formatAnchorValue(annotation.category)} is not on the ${scales.category} axis.`,
        );
      }
      break;
  }
  return warnings;
}

/**
 * ChartAnnotations — the declarative annotation layer of a cartesian chart
 * (RM-111): ranges behind the marks, reference lines, row notes and text notes
 * over them, all positioned in data units through the container's own scales.
 *
 * Mount it as a child of `LineChart`, `AreaChart`, `ComposedChart` or
 * `BarChart`; the shell paints its `back` pass under the series and its
 * `front` pass over them. At `narrow` each visible `text` note becomes a
 * numbered marker at its position — pair the chart with an `AnnotationKey`
 * to list the notes under the plot, and restate them in the figure
 * description with `withAnnotationDescription` (`AutoChart` does all three
 * for `ChartSpec.annotations`).
 *
 * Painted text and row notes are placed with RM-110's `layoutLabels`: clear
 * of each other and of the labels the chart already paints (series end and
 * value labels, a waterfall's value labels), nudged when they collide. A note
 * the solver cannot place is never hidden: inside an annotated container (the
 * `annotations` prop, `AutoChart`) it becomes a numbered marker listed in the
 * key; a hand-composed layer paints it where it asked to be.
 *
 * A solid range fills the pale band ink (`--chart-ring-background`); stripes
 * and reference lines paint the furniture ink (`--chart-grid`); all at full
 * opacity. Series-coloured text is mixed toward the label ink for contrast
 * (`seriesLabelInk`). The layer is `aria-hidden`, like every mark: the
 * notes reach assistive tech through the figure description.
 */
export const ChartAnnotations = forwardRef<SVGGElement, ChartAnnotationsProps>(
  function ChartAnnotations({ annotations, layer = "all", yAxisId, ...props }, ref) {
    const scales = useAnnotationScales(yAxisId);
    const breakpoint = useChartBreakpoint();
    const stable = useContext(ChartStableContext);
    const lines = stable?.lines ?? NO_LINES;
    const patternId = `chart-annotations-stripes-${useId().replace(/:/g, "")}`;
    const back = layer !== "front";
    const front = layer !== "back";
    const striped = back && annotations.some((a) => a.kind === "range" && a.pattern === "stripes");

    // Text is measured in the chart container's font; a container without a
    // chart context (DumbbellChart) measures inside the layer itself.
    const ownRef = useRef<SVGGElement | null>(null);
    const setRef = useCallback(
      (node: SVGGElement | null) => {
        ownRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );
    const measurer = useTextMeasurerOf(stable?.containerRef ?? ownRef);
    const measureNote = useCallback<MeasureNote>(
      (text) => {
        const width =
          (measurer.measure(text.replace(/\*\*/g, "")) * NOTE_FONT_SIZE) / measurer.fontSizePx;
        return text.includes("**") ? width * BOLD_WIDTH_FACTOR : width;
      },
      [measurer],
    );
    const scoped = useAnnotationLayoutScope();
    const obstacles = useAnnotationObstacles();

    // Dev only: an annotation this pass skips because an anchor misses its
    // axis is named in a warning, never dropped silently. Not before the plot
    // is measured: an unsized chart has nothing to place yet.
    useEffect(() => {
      if (process.env.NODE_ENV === "production") return;
      if (scales.innerWidth <= 0 || scales.innerHeight <= 0) return;
      annotations.forEach((annotation, index) => {
        if (!(annotation.kind === "range" ? back : front)) return;
        for (const message of unresolvedAnchorWarnings(annotation, index, scales)) {
          warnChartOnce(message, message);
        }
      });
    }, [annotations, back, front, scales]);

    const basePlan = useMemo(
      () => planAnnotations(annotations, breakpoint),
      [annotations, breakpoint],
    );
    const geometry = useMemo(() => {
      const out = new Map<number, NoteGeometry>();
      if (!front) return out;
      for (const { annotation, index, display } of basePlan) {
        if (display !== "painted") continue;
        const g =
          annotation.kind === "text"
            ? textNoteGeometry(annotation, scales, measureNote)
            : annotation.kind === "row"
              ? rowNoteGeometry(annotation, scales, measureNote)
              : null;
        if (g) out.set(index, g);
      }
      return out;
    }, [front, basePlan, scales, measureNote]);
    const layout = useMemo(() => {
      const boxes: AnnotationBox[] = [];
      for (const [index, g] of geometry) {
        if (!g.box) continue;
        boxes.push({
          ...g.box,
          anchorSide: g.anchorSide,
          id: `${g.kind}-${index}`,
          index,
          priority: g.priority,
          retryAnchorSide: g.retryAnchorSide,
        });
      }
      return layoutAnnotationBoxes(boxes, {
        bounds: annotationLayoutBounds(boxes, scales.innerWidth, scales.innerHeight),
        obstacles,
      });
    }, [geometry, obstacles, scales]);
    // Only a key can carry a demoted note; without one it paints where it asked.
    const demoted = useMemo(
      () => (front && scoped ? [...layout.dropped].sort((a, b) => a - b) : null),
      [front, scoped, layout],
    );
    useReportDemotedAnnotations(demoted);
    const plan = useMemo(
      () => (demoted?.length ? planAnnotations(annotations, breakpoint, demoted) : basePlan),
      [annotations, breakpoint, demoted, basePlan],
    );

    const ranges: ReactNode[] = [];
    const overlays: ReactNode[] = [];
    const notes: Array<{ priority: number; node: ReactNode }> = [];
    for (const entry of plan) {
      const { annotation, index } = entry;
      if (annotation.kind === "range") {
        if (back) ranges.push(renderRange(annotation, index, scales, patternId, lines));
        continue;
      }
      if (!front) continue;
      if (annotation.kind === "line") {
        overlays.push(renderLine(annotation, index, scales));
        continue;
      }
      if (entry.display === "keyed" && entry.number !== undefined) {
        const point =
          annotation.kind === "row"
            ? rowMarkerPoint(annotation, scales)
            : resolveAnnotationPosition(annotation, scales);
        if (point) {
          overlays.push(renderMarker(annotation, index, entry.number, point, scales, lines));
        }
        continue;
      }
      const g = geometry.get(index);
      if (entry.display !== "painted" || !g) continue;
      const move = layout.moves.get(index);
      if (annotation.kind === "row") {
        overlays.push(
          renderRow(annotation, index, g, resolveAnnotationTextInk(annotation.color, lines), move),
        );
      } else {
        notes.push({
          priority: annotation.priority ?? 0,
          node: renderNote(annotation, index, g, scales, lines, move),
        });
      }
    }
    // A stable sort: equal priorities keep reading order, a higher one paints on top.
    notes.sort((a, b) => a.priority - b.priority);

    return (
      <g
        aria-hidden="true"
        data-breakpoint={breakpoint}
        data-layer={layer}
        data-slot="chart-annotations"
        pointerEvents="none"
        ref={setRef}
        {...props}
      >
        {striped ? (
          <defs>
            <PatternLines
              height={STRIPE_PITCH}
              id={patternId}
              orientation={["diagonal"]}
              stroke={chartCssVars.grid}
              strokeWidth={STRIPE_WIDTH}
              width={STRIPE_PITCH}
            />
          </defs>
        ) : null}
        {ranges}
        {overlays}
        {notes.map((note) => note.node)}
      </g>
    );
  },
);

ChartAnnotations.displayName = "ChartAnnotations";

/**
 * A chart shell's hook into the layer: when `child` is a `ChartAnnotations`
 * element, returns its `back` and `front` passes (keyed from `key`) so the
 * shell can paint ranges under the series and everything else over them;
 * otherwise `null`.
 */
export function splitChartAnnotationsChild(
  child: ReactElement,
  key: string | number,
): [back: ReactElement, front: ReactElement] | null {
  const type = child.type as { displayName?: string };
  if (child.type !== ChartAnnotations && type.displayName !== "ChartAnnotations") return null;
  return [
    cloneElement(child as ReactElement<ChartAnnotationsProps>, {
      key: `annotations-back-${key}`,
      layer: "back",
    }),
    cloneElement(child as ReactElement<ChartAnnotationsProps>, {
      key: `annotations-front-${key}`,
      layer: "front",
    }),
  ];
}

/**
 * The figure-description seam for an annotated container: the container's own
 * description followed by every annotation, once, in reading order — painted,
 * keyed or hidden alike, since the layer and the key are both `aria-hidden`.
 * Returns the `useChartA11yContainerProps` result plus the merged description
 * to hand to `ChartA11yLabel`.
 */
export function useChartAnnotationsA11y(
  accessibleLabel: string | undefined,
  accessibleDescription: string | undefined,
  annotations: readonly ChartAnnotation[] | undefined,
): ReturnType<typeof useChartA11yContainerProps> & { description: string | undefined } {
  const description = withAnnotationDescription(accessibleDescription, annotations);
  return { ...useChartA11yContainerProps(accessibleLabel, description), description };
}
