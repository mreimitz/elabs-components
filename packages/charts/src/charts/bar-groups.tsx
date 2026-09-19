"use client";

import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";
import { chartCssVars } from "./chart-context";
import { groupBarRows } from "./bar-stacking";

/**
 * `groupBy` (RM-113): rows are gathered by a column, each group keeps its own
 * (sorted) order, and the groups are told apart by a bold header and a
 * hairline separator.
 *
 * Horizontal bars give each header its own BAND ROW — a synthetic row with no
 * numeric value, so no series, overlay or datapoint target ever lands on it —
 * and the category axis skips it (`isBarGroupHeaderRow`). Vertical columns
 * have no row to spare, so their header sits above the group's span.
 */

/** Marks a synthetic group-header row; its value is the group name. */
export const BAR_GROUP_HEADER_KEY = "__barGroupHeader";

/** The category value a header row carries — unique, and never a real label. */
export function barGroupHeaderCategory(name: string): string {
  return `⁣group:${name}`;
}

export function isBarGroupHeaderRow(row: Record<string, unknown> | undefined): boolean {
  return row !== undefined && typeof row[BAR_GROUP_HEADER_KEY] === "string";
}

/**
 * Rows in group order. `withHeaders` (horizontal bars) inserts one header
 * row before each group; otherwise the rows are only regrouped.
 */
export function arrangeBarGroups(
  rows: readonly Record<string, unknown>[],
  groupBy: string,
  xDataKey: string,
  withHeaders: boolean,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const group of groupBarRows(rows, groupBy)) {
    if (withHeaders) {
      out.push({
        [xDataKey]: barGroupHeaderCategory(group.name),
        [BAR_GROUP_HEADER_KEY]: group.name,
      });
    }
    out.push(...group.rows);
  }
  return out;
}

export interface BarGroupLayerProps {
  rows: readonly Record<string, unknown>[];
  groupBy: string;
  /** Band start (px along the category axis) for a row. */
  bandOf: (row: Record<string, unknown>) => number | undefined;
  bandWidth: number;
  /** Distance between neighbouring band starts. */
  step: number;
  isHorizontal: boolean;
  innerWidth: number;
  innerHeight: number;
  /** Left margin — horizontal headers start at the chart's own left edge. */
  marginLeft: number;
}

interface GroupSpan {
  name: string;
  start: number;
  end: number;
  headerBand?: number;
}

function collectSpans({
  rows,
  groupBy,
  bandOf,
  bandWidth,
}: Pick<BarGroupLayerProps, "rows" | "groupBy" | "bandOf" | "bandWidth">): GroupSpan[] {
  const spans: GroupSpan[] = [];
  let current: GroupSpan | null = null;
  for (const row of rows) {
    const band = bandOf(row);
    if (band === undefined) continue;
    if (isBarGroupHeaderRow(row)) {
      current = { name: String(row[BAR_GROUP_HEADER_KEY]), start: band, end: band + bandWidth };
      current.headerBand = band;
      spans.push(current);
      continue;
    }
    const raw = row[groupBy];
    const name = raw === undefined || raw === null ? "" : String(raw);
    if (!current || current.name !== name) {
      current = { name, start: band, end: band + bandWidth };
      spans.push(current);
    } else {
      current.end = band + bandWidth;
    }
  }
  return spans;
}

/** Group headers (bold, category-axis ink) and the separators between groups. */
export function BarGroupLayer(props: BarGroupLayerProps) {
  const { isHorizontal, innerWidth, marginLeft, step, bandWidth } = props;
  const spans = collectSpans(props);
  // Separators sit in the middle of the padding between two groups.
  const gap = (step - bandWidth) / 2;
  return (
    <g aria-hidden="true" data-slot="bar-chart-groups">
      {spans.map((span, i) => {
        const separatorAt = span.start - gap;
        return (
          <g data-group={span.name} key={`group-${span.name}`}>
            {i > 0 &&
              (isHorizontal ? (
                <line
                  data-slot="bar-chart-group-separator"
                  stroke={chartCssVars.grid}
                  strokeWidth={CHART_HAIRLINE_WIDTH}
                  x1={-marginLeft}
                  x2={innerWidth}
                  y1={separatorAt}
                  y2={separatorAt}
                />
              ) : (
                <line
                  data-slot="bar-chart-group-separator"
                  stroke={chartCssVars.grid}
                  strokeWidth={CHART_HAIRLINE_WIDTH}
                  x1={separatorAt}
                  x2={separatorAt}
                  y1={0}
                  y2={props.innerHeight}
                />
              ))}
            <text
              className="text-meta font-semibold"
              data-slot="bar-chart-group-header"
              dominantBaseline={isHorizontal ? "middle" : "auto"}
              fill={chartCssVars.label}
              textAnchor={isHorizontal ? "start" : "middle"}
              x={isHorizontal ? -marginLeft : (span.start + span.end) / 2}
              y={isHorizontal ? (span.headerBand ?? span.start) + bandWidth / 2 : -8}
            >
              {span.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
