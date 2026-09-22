/**
 * selection/types.ts — the selection OUTPUT contract of ADR 0040 §3–5 (RM-136).
 *
 * `chart-selection.ts` (RM-073) is the INPUT: a host tells a chart which
 * categories are selected / associated / excluded and every family paints it.
 * `chart-datapoint.ts` (#349) is the single-datum OUTPUT. This module is the
 * gesture OUTPUT: a range on an axis, a rectangle, a lasso or a click resolves
 * to ONE intent — `field` + `values` + `mode` — the exact shape the parked
 * dashboard core's `SelectionDriver.select(field, values, { toggle, replace })`
 * consumes, plus the gesture's geometry (data units) and the hit datapoints for
 * hosts that want them.
 *
 * A measure-axis range still resolves to DIMENSION values (the associative BI suite: "select the
 * values whose measure falls in the range"), so the vocabulary stays one
 * field/values pair per intent.
 */

import type { ChartDatapoint } from "../chart-datapoint";

/** A selectable value of the selection field. */
export type ChartSelectionValue = string | number | Date;

/** The gestures a container can enable. */
export type ChartSelectionGesture = "range" | "rect" | "lasso" | "radial";

/**
 * How `values` combine with the host's current selection — modifier-driven:
 * plain = `replace`, Shift = `add`, Ctrl/Cmd = `toggle`; in `explicit` confirm
 * mode a plain click is `toggle` (the associative BI suite).
 */
export type ChartSelectionMode = "add" | "toggle" | "replace";

/** Geometry of the gesture in DATA units (never pixels). */
export type ChartSelectionGeometry =
  | { kind: "click"; category: ChartSelectionValue; seriesKey?: string }
  | {
      kind: "range";
      axis: "x" | "y";
      from: ChartSelectionValue;
      to: ChartSelectionValue;
      /** The series the measure range was read against (y-axis ranges). */
      of?: string;
    }
  | {
      kind: "rect";
      x: [ChartSelectionValue, ChartSelectionValue];
      y: [number, number];
    }
  | { kind: "lasso"; path: ReadonlyArray<{ x: ChartSelectionValue; y: number }> }
  | { kind: "radial"; center: { x: ChartSelectionValue; y: number }; rx: number; ry: number };

/** One committed (or, in `immediate` mode, one gestured) selection. */
export interface ChartSelectionIntent<TDatum = Record<string, unknown>> {
  /** The dimension field the values belong to (`selectionField ?? xDataKey`). */
  field: string;
  /** Distinct selected values of `field`, in data order. */
  values: ChartSelectionValue[];
  mode: ChartSelectionMode;
  gesture: ChartSelectionGeometry;
  /** The datapoints the gesture hit (visible marks only for rect/lasso). */
  datapoints: ChartDatapoint<TDatum>[];
  source: "pointer" | "keyboard";
}

export type ChartSelectionIntentHandler<TDatum = Record<string, unknown>> = (
  intent: ChartSelectionIntent<TDatum>,
) => void;

/**
 * `"immediate"` (default; the analytics-pane BI suite / the report-builder BI suite / the grammar-of-graphics library): every gesture emits an
 * intent at once. `"explicit"` (the associative BI suite): gestures accumulate a provisional set
 * painted through `selectionStates`; ✓ / Enter / click-outside commits ONE
 * `replace` intent, ✕ / Esc cancels.
 */
export type ChartSelectionConfirm = "immediate" | "explicit";

/** How a rectangle / lasso decides that a mark is hit. */
export type ChartSelectionHitRule = "overlap" | "contain";

/** The props every gesture-aware container accepts. Spread into the family's own props. */
export interface ChartSelectionGestureProps<TDatum = Record<string, unknown>> {
  /** Gestures to enable. Unset → no gesture layer, DOM byte-identical to today. */
  selectionGestures?: readonly ChartSelectionGesture[];
  /** Fires with every intent. Required for the gesture layer to mount. */
  onSelectionIntent?: ChartSelectionIntentHandler<TDatum>;
  /** Default `"immediate"`. */
  selectionConfirm?: ChartSelectionConfirm;
  /** The field name carried in intents. Default: the chart's `xDataKey`. */
  selectionField?: string;
  /** Rect / lasso hit rule. Default `"overlap"` (the report-builder BI suite). */
  selectionHitRule?: ChartSelectionHitRule;
  /** `"auto"` (default): a toolbar appears when gestures are enabled; `"none"` hides it. */
  selectionToolbar?: "auto" | "none";
}
