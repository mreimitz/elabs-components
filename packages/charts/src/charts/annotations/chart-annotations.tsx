"use client";

import {
  cloneElement,
  forwardRef,
  type ReactElement,
  type ReactNode,
  type SVGProps,
  useId,
  useMemo,
} from "react";
import { CHART_HAIRLINE_WIDTH } from "../../chart-hairline";
import { HaloText } from "../../marks/halo-text";
import { estimateNoteLines, Marginalia, noteLineHeight } from "../../marks/marginalia";
import { PeakRing } from "../../marks/peak-ring";
import { useChartA11yContainerProps } from "../chart-a11y";
import { useChartBreakpoint } from "../chart-breakpoint";
import { chartCssVars, type LineConfig, useChartStable, useYScale } from "../chart-context";
import { PatternLines } from "../visx-pattern";
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

const LINE_DASH: Record<NonNullable<ChartLineAnnotation["style"]>, string | undefined> = {
  solid: undefined,
  dashed: "4 3",
  dotted: "1 3",
};

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
function useAnnotationScales(yAxisId: string | number | undefined): AnnotationScales {
  const { xScale, innerWidth, innerHeight, orientation, barScale, xValueToPosition, xScaleType } =
    useChartStable();
  const yScale = useYScale(yAxisId);
  return useMemo<AnnotationScales>(() => {
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
  }, [
    barScale,
    innerHeight,
    innerWidth,
    orientation,
    xScale,
    xScaleType,
    xValueToPosition,
    yScale,
  ]);
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
  const fill = annotation.pattern === "stripes" ? `url(#${patternId})` : chartCssVars.grid;
  return (
    <g data-annotation-index={index} data-slot="chart-annotations-range" key={`range-${index}`}>
      <rect
        fill={fill}
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

function renderRow(
  annotation: ChartRowAnnotation,
  index: number,
  scales: AnnotationScales,
  ink: string,
): ReactNode {
  if (!scales.category) return null;
  const onY = scales.category === "y";
  const at = scales[scales.category].point(annotation.category);
  if (at === undefined) return null;
  return (
    <HaloText
      data-annotation-index={index}
      data-slot="chart-annotations-row"
      dominantBaseline={onY ? "middle" : "hanging"}
      fill={ink}
      fontSize={NOTE_FONT_SIZE}
      key={`row-${index}`}
      textAnchor={onY ? "end" : "middle"}
      x={onY ? scales.innerWidth : at}
      y={onY ? at : LABEL_INSET}
    >
      {annotation.text}
    </HaloText>
  );
}

function renderNote(
  annotation: ChartTextAnnotation,
  index: number,
  scales: AnnotationScales,
  ink: string,
): ReactNode {
  const point = resolveAnnotationPosition(annotation, scales);
  if (!point) return null;
  const maxWidth =
    (scales.innerWidth * clamp(annotation.width ?? DEFAULT_NOTE_WIDTH_PERCENT, 1, 100)) / 100;
  const plain = typeof annotation.text === "string" ? annotation.text : null;
  const lineCount = plain === null ? 1 : estimateNoteLines(plain, maxWidth, NOTE_FONT_SIZE);
  const pitch = noteLineHeight(NOTE_FONT_SIZE);
  const blockHeight = lineCount * pitch;
  const { textAnchor, edge } = anchorParts(annotation.anchor ?? "nw");
  const rawTop =
    edge === "top"
      ? point.y
      : edge === "middle"
        ? point.y - blockHeight / 2
        : point.y - blockHeight;
  const top = clamp(rawTop, 0, scales.innerHeight - blockHeight);
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
        maxWidth={plain === null ? undefined : maxWidth}
        noteFill={ink}
        textAnchor={textAnchor}
        x={clamp(point.x, 0, scales.innerWidth)}
        y={top + pitch / 2}
      >
        {annotation.text}
      </Marginalia>
    </g>
  );
}

function renderMarker(
  annotation: ChartTextAnnotation,
  index: number,
  number: number,
  scales: AnnotationScales,
  ink: string,
): ReactNode {
  const point = resolveAnnotationPosition(annotation, scales);
  if (!point) return null;
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
      <PeakRing cx={cx} cy={cy} r={MARKER_RADIUS} stroke={ink} />
      <text
        dominantBaseline="central"
        fill={ink}
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
 * Every range fill and reference line paints the furniture ink
 * (`--chart-grid`) at full opacity. The layer is `aria-hidden`, like every
 * mark: the notes reach assistive tech through the figure description.
 */
export const ChartAnnotations = forwardRef<SVGGElement, ChartAnnotationsProps>(
  function ChartAnnotations({ annotations, layer = "all", yAxisId, ...props }, ref) {
    const scales = useAnnotationScales(yAxisId);
    const breakpoint = useChartBreakpoint();
    const { lines } = useChartStable();
    const patternId = `chart-annotations-stripes-${useId().replace(/:/g, "")}`;
    const plan = useMemo(() => planAnnotations(annotations, breakpoint), [annotations, breakpoint]);
    const back = layer !== "front";
    const front = layer !== "back";
    const striped = back && annotations.some((a) => a.kind === "range" && a.pattern === "stripes");

    const ranges: ReactNode[] = [];
    const overlays: ReactNode[] = [];
    const notes: Array<{ priority: number; node: ReactNode }> = [];
    for (const entry of plan) {
      const { annotation, index } = entry;
      if (annotation.kind === "range") {
        if (back) ranges.push(renderRange(annotation, index, scales, patternId));
        continue;
      }
      if (!front) continue;
      if (annotation.kind === "line") {
        overlays.push(renderLine(annotation, index, scales));
      } else if (annotation.kind === "row") {
        overlays.push(
          renderRow(annotation, index, scales, resolveAnnotationInk(annotation.color, lines)),
        );
      } else if (entry.display === "painted") {
        notes.push({
          priority: annotation.priority ?? 0,
          node: renderNote(
            annotation,
            index,
            scales,
            resolveAnnotationInk(annotation.color, lines),
          ),
        });
      } else if (entry.display === "keyed" && entry.number !== undefined) {
        overlays.push(
          renderMarker(
            annotation,
            index,
            entry.number,
            scales,
            resolveAnnotationInk(annotation.color, lines),
          ),
        );
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
        ref={ref}
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
