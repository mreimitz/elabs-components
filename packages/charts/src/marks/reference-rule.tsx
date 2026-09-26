"use client";

/**
 * reference-rule.tsx — the one reference painter and the one trend painter
 * (RM-188).
 *
 * A reference line used to be drawn by seven painters (`ReferenceLine`, the
 * annotation layer's `line`, Distribution `referenceLines`, Dumbbell
 * `referenceLine`, …), each writing its own `<line>` with its own dash
 * literal, and a straight trend fit by two (`TrendLine`, Scatter `trend`).
 * Every one of them now paints its rule through `ReferenceRule` or
 * `TrendRule` and keeps only what is its own: where the rule sits and how
 * its label is laid out. `.claude/rules/charts.md`: "never a new painter per
 * statistic".
 *
 * Both are bare SVG `<line>`s — no context, no measurement — so the DOM they
 * emit is exactly the `<line>` each host drew before (same attributes, same
 * order). The dash comes from `CHART_DASH` in `chart-stroke.ts`; the inks are
 * the furniture inks every host already used.
 */

import type { SVGProps } from "react";
import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";
import { CHART_DASH } from "../charts/chart-stroke";

/** The ink of computed furniture (ADR 0040): a threshold paints the full foreground. */
const REFERENCE_INK = "var(--chart-foreground)";
/** A fit is commentary on the data, not another series: the muted foreground. */
const TREND_INK = "var(--chart-foreground-muted)";

/** The endpoints of a rule, in plot px. */
export interface RuleGeometry {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface ReferenceRuleProps extends RuleGeometry {
  /** Ink. Default `var(--chart-foreground)` — a threshold, not a gridline. */
  stroke?: string;
  /**
   * Dash rhythm, already resolved (`CHART_DASH.*`, or `undefined` for a solid
   * rule). Default `CHART_DASH.dashed`.
   */
  strokeDasharray?: string | undefined;
  strokeOpacity?: SVGProps<SVGLineElement>["strokeOpacity"];
  strokeWidth: number;
}

/**
 * One reference rule — a threshold, a target, a computed line, a highlighted
 * grid row. Pass `strokeDasharray={undefined}` explicitly for a solid rule.
 */
export function ReferenceRule(props: ReferenceRuleProps) {
  const { x1, x2, y1, y2, stroke = REFERENCE_INK, strokeOpacity, strokeWidth } = props;
  const strokeDasharray = "strokeDasharray" in props ? props.strokeDasharray : CHART_DASH.dashed;
  return (
    <line
      stroke={stroke}
      strokeDasharray={strokeDasharray}
      strokeOpacity={strokeOpacity}
      strokeWidth={strokeWidth}
      x1={x1}
      x2={x2}
      y1={y1}
      y2={y2}
    />
  );
}
ReferenceRule.displayName = "ReferenceRule";

export interface TrendRuleProps extends RuleGeometry {
  strokeWidth: number;
}

/**
 * One straight trend fit, from its first to its last x: the muted foreground
 * with the `trend` rhythm (`CHART_DASH.trend`).
 */
export function TrendRule({ x1, x2, y1, y2, strokeWidth }: TrendRuleProps) {
  return (
    <ReferenceRule
      stroke={TREND_INK}
      strokeDasharray={CHART_DASH.trend}
      strokeWidth={strokeWidth}
      x1={x1}
      x2={x2}
      y1={y1}
      y2={y2}
    />
  );
}
TrendRule.displayName = "TrendRule";

/**
 * One axis furniture line — a spine, an end tick or a gridline: the grid ink at
 * `CHART_HAIRLINE_WIDTH`, never dimmed (`.claude/rules/charts.md`). The shared
 * primitive the hand-rolled axes (Distribution's value axis, Parallel
 * Coordinates' spines) draw through (RM-188); the `<line>` is the one they
 * each wrote before.
 */
export function AxisRule({ x1, x2, y1, y2 }: RuleGeometry) {
  return (
    <line
      stroke="var(--chart-grid)"
      strokeWidth={CHART_HAIRLINE_WIDTH}
      x1={x1}
      x2={x2}
      y1={y1}
      y2={y2}
    />
  );
}
AxisRule.displayName = "AxisRule";
