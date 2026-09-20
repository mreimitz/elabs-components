/**
 * Declarative chart annotations (RM-111) — the one union every cartesian
 * container and `ChartSpec` speak.
 *
 * Four kinds, in data units (`Date`, number or category — never pixels):
 *
 * - `text`  — a note at `(x, y)`, optionally tied to a point by a connector.
 * - `range` — a band across `x1..x2` or `y1..y2` (solid or striped).
 * - `line`  — a reference line at `x` or `y`.
 * - `row`   — a note on one category row of a horizontal chart (survives re-sort).
 *
 * At the `narrow` tier every visible `text` annotation becomes a numbered
 * marker at its position and a row of the `AnnotationKey` under the plot.
 */

import type { ReactNode } from "react";
import type { LeaderKind } from "../../marks/leader";
import { type ChartBreakpoint, type Responsive, resolveResponsive } from "../chart-breakpoint";

/** A data-unit position: a `Date`, a number, or a category / ISO date string. */
export type AnnotationValue = Date | number | string;

/**
 * Which point of the note's text block sits on `(x, y)` — compass points plus
 * `center`. `nw` (default): the block's top-left corner, so the note reads
 * right and down from its point.
 */
export type AnnotationAnchor = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw" | "center";

/** Every anchor, in reading order (for stories and validation). */
export const ANNOTATION_ANCHORS: readonly AnnotationAnchor[] = [
  "nw",
  "n",
  "ne",
  "w",
  "center",
  "e",
  "sw",
  "s",
  "se",
];

/**
 * Note ink: `"series:<dataKey>"` (the resolved stroke of that series), a series
 * ramp token `"var(--chart-N)"`, or `"muted"` (the default).
 */
export type AnnotationColor = `series:${string}` | `var(--chart-${number})` | "muted";

/** A connector from the note to the point it is about. */
export interface AnnotationConnector<V = AnnotationValue> {
  /** The point the connector ends at, in data units. */
  to: { x: V; y: V };
  /** Draw an arrow head at `to`. Default `false`. */
  arrow?: boolean;
  /** `curve` (default) or `elbow` — the two `Leader` shapes. */
  kind?: LeaderKind;
}

/** A note placed in data coordinates. */
export interface ChartTextAnnotationOf<T, V> {
  kind: "text";
  /** Horizontal position in data units. */
  x: V;
  /** Vertical position in data units. */
  y: V;
  /** The note. */
  text: T;
  /** Which point of the text block sits on `(x, y)`. Default `"nw"`. */
  anchor?: AnnotationAnchor;
  /** Widest line, as a percentage of the plot width. Default `25`. */
  width?: number;
  /** A leader line from the note to a point. */
  connector?: AnnotationConnector<V>;
  /** Note ink. Default `"muted"`. */
  color?: AnnotationColor;
  /** Paint order among notes — a higher priority paints on top. Default `0`. */
  priority?: number;
  /**
   * Whether the note shows at a tier. `false` hides the note AND its narrow
   * marker (nothing is keyed); the figure description keeps it. Default `true`.
   */
  showAt?: Responsive<boolean>;
}

/** The fields every `range` annotation shares. */
interface ChartRangeAnnotationBase {
  kind: "range";
  /** A short name drawn inside the band ("Covid-19"). */
  label?: string;
  /** `solid` (default) fills with the furniture ink; `stripes` hatches it. */
  pattern?: "solid" | "stripes";
  /**
   * Band ink: `"muted"` (the furniture ink, default), `"series:<dataKey>"` to tint
   * the band with a series colour, or any CSS colour / token. Stripes take it too.
   */
  color?: AnnotationColor;
  /** Band opacity, `0`–`1`. Default `1` — lower it for a lighter wash behind series. */
  opacity?: number;
}

/** A band across an interval of one axis. */
export type ChartRangeAnnotationOf<V> = ChartRangeAnnotationBase &
  ({ x1: V; x2: V; y1?: never; y2?: never } | { y1: V; y2: V; x1?: never; x2?: never });

/** The fields every `line` annotation shares. */
interface ChartLineAnnotationBase {
  kind: "line";
  /** A short name drawn beside the line ("Global average: 73.8 years"). */
  label?: string;
  /** Stroke rhythm. Default `solid`. */
  style?: "solid" | "dashed" | "dotted";
  /** Stroke weight in px. Default: the furniture hairline. */
  width?: 1 | 2 | 3;
}

/**
 * A reference line at one value of one axis. `x` and `y` are the DRAWN axes:
 * on a horizontal bar, dumbbell or waterfall chart the value axis is `x`, so
 * a value line there takes `x` (a `y` would be looked up among the categories).
 */
export type ChartLineAnnotationOf<V> = ChartLineAnnotationBase &
  ({ x: V; y?: never } | { y: V; x?: never });

/** A note on one category row of a horizontal chart. */
export interface ChartRowAnnotationOf<T> {
  kind: "row";
  /** The row's category — matched by value, so the note follows a re-sort. */
  category: string;
  /** The note. */
  text: T;
  /** Note ink. Default `"muted"`. */
  color?: AnnotationColor;
}

/** Any annotation, with note text of type `T` and positions of type `V`. */
export type ChartAnnotationOf<T, V> =
  | ChartTextAnnotationOf<T, V>
  | ChartRangeAnnotationOf<V>
  | ChartLineAnnotationOf<V>
  | ChartRowAnnotationOf<T>;

/** A text annotation on a chart container. */
export type ChartTextAnnotation = ChartTextAnnotationOf<ReactNode, AnnotationValue>;
/** A range annotation on a chart container. */
export type ChartRangeAnnotation = ChartRangeAnnotationOf<AnnotationValue>;
/** A reference-line annotation on a chart container. */
export type ChartLineAnnotation = ChartLineAnnotationOf<AnnotationValue>;
/** A row annotation on a chart container. */
export type ChartRowAnnotation = ChartRowAnnotationOf<ReactNode>;
/** Any annotation a chart container accepts. */
export type ChartAnnotation = ChartAnnotationOf<ReactNode, AnnotationValue>;

/**
 * The serialisable form on `ChartSpec`: note text is a plain string (with the
 * inline `**bold**` subset), positions are numbers or strings (ISO dates on a
 * time axis, categories on a band axis).
 */
export type ChartSpecAnnotation = ChartAnnotationOf<string, number | string>;

// ── Plain text ───────────────────────────────────────────────────────────────

/** Strip the inline `**bold**` markers from a note. */
export function stripInlineBold(text: string): string {
  return text.replace(/\*\*/g, "");
}

/** The plain text of a note node (strings and numbers; nested arrays joined). */
export function annotationNodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return stripInlineBold(node);
  if (typeof node === "number" || typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map(annotationNodeText).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return annotationNodeText(props?.children);
  }
  return "";
}

/** What an annotation says, as plain text — `""` when it says nothing. */
export function annotationText(annotation: ChartAnnotation): string {
  switch (annotation.kind) {
    case "text":
      return annotationNodeText(annotation.text).trim();
    case "row": {
      const text = annotationNodeText(annotation.text).trim();
      return text ? `${annotation.category}: ${text}` : "";
    }
    default:
      return annotation.label?.trim() ?? "";
  }
}

// ── Narrow-tier plan ─────────────────────────────────────────────────────────

/** How one annotation shows at the current tier. */
export type AnnotationDisplay = "painted" | "keyed" | "hidden";

/** One annotation with its display decision and (when keyed) its key number. */
export interface AnnotationPlanEntry {
  annotation: ChartAnnotation;
  /** Index in the original array. */
  index: number;
  display: AnnotationDisplay;
  /** 1-based key number, set only when `display === "keyed"`. */
  number?: number;
}

/**
 * Decide how every annotation shows at `breakpoint`: a `text` note whose
 * `showAt` resolves `false` is hidden; at `narrow` a visible note is keyed
 * (numbered in array order); everything else is painted in place.
 *
 * `demoted` lists the indices of `text` and `row` notes the layout could not
 * paint without an overlap: those are keyed too, at any tier, so a crowded
 * note becomes a numbered marker plus a key row instead of disappearing.
 */
export function planAnnotations(
  annotations: readonly ChartAnnotation[],
  breakpoint: ChartBreakpoint,
  demoted: readonly number[] = [],
): AnnotationPlanEntry[] {
  let next = 1;
  return annotations.map((annotation, index) => {
    if (annotation.kind === "row" && demoted.includes(index)) {
      return { annotation, index, display: "keyed", number: next++ };
    }
    if (annotation.kind !== "text") return { annotation, index, display: "painted" };
    const visible = resolveResponsive(annotation.showAt ?? true, breakpoint);
    if (!visible) return { annotation, index, display: "hidden" };
    if (breakpoint === "narrow" || demoted.includes(index)) {
      return { annotation, index, display: "keyed", number: next++ };
    }
    return { annotation, index, display: "painted" };
  });
}

/** `①`…`⑳` for 1–20, `(n)` beyond. */
export function circledNumber(n: number): string {
  return n >= 1 && n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : `(${n})`;
}

/**
 * Every annotation restated once, in array (reading) order, for the figure
 * description — whether it is painted, keyed or hidden at this tier.
 * Returns `undefined` when no annotation says anything.
 */
export function describeAnnotations(
  annotations: readonly ChartAnnotation[] | undefined,
): string | undefined {
  if (!annotations?.length) return undefined;
  const parts = annotations
    .map(annotationText)
    .filter((text) => text.length > 0)
    .map((text) => (/[.!?…]$/.test(text) ? text : `${text}.`));
  return parts.length ? parts.join(" ") : undefined;
}

/** A consumer description followed by the annotations' restatement. */
export function withAnnotationDescription(
  description: string | undefined,
  annotations: readonly ChartAnnotation[] | undefined,
): string | undefined {
  const restated = describeAnnotations(annotations);
  if (!restated) return description;
  if (!description?.trim()) return restated;
  const base = description.trim();
  return `${/[.!?…]$/.test(base) ? base : `${base}.`} ${restated}`;
}
