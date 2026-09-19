"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { ChartValueFormat } from "../value-format";
import { useChartTooltipValueFormat } from "./tooltip-content";
import type { TooltipRow } from "./tooltip-content";

export interface ChartTooltipTableProps {
  /** The hovered date/category — painted as the `<caption>`, never a header cell. */
  title?: string;
  /** One column per series (`ChartTooltip`'s already-resolved `rows`). */
  rows: TooltipRow[];
  /** Same STYLE-only borrow as `ChartTooltipContent` — never abbreviated. */
  valueFormat?: ChartValueFormat;
  /** ISO 4217 code for `valueFormat`'s `style: "currency"`. */
  currency?: string;
}

/**
 * `ChartTooltip variant="table"` (RM-119) — one column per series with a
 * header row, the Datawrapper dual-axis / multi-series tooltip shape
 * (`dw-charts.md` §2.22) instead of the default stacked `rows` list. The
 * hovered date/category is the table's `<caption>`, not a header cell, so a
 * screen reader announces it once before the series names.
 */
export function ChartTooltipTable({ title, rows, valueFormat, currency }: ChartTooltipTableProps) {
  const format = useChartTooltipValueFormat(valueFormat, currency);
  // Dual-axis — RM-121: group the columns under their axis' side header.
  const axisGroups = useTooltipTableAxisGroups(rows);
  const columns = axisGroups ? axisGroups.flatMap((group) => group.rows) : rows;
  return (
    <table
      className="border-collapse text-body text-chart-tooltip-foreground"
      data-slot="chart-tooltip-table"
    >
      {title && (
        <caption className="caption-top px-3 pt-2.5 pb-1 text-start text-meta font-medium">
          {title}
        </caption>
      )}
      {axisGroups?.map((group) => (
        <colgroup key={`${group.id}-cols`} span={group.rows.length} />
      ))}
      <thead>
        {axisGroups && (
          <tr data-slot="chart-tooltip-table-axis-row">
            {axisGroups.map((group) => (
              <th
                className="px-3 pt-1 text-start text-chart-tooltip-muted text-meta font-medium"
                colSpan={group.rows.length}
                data-axis={group.id}
                data-slot="chart-tooltip-table-axis-header"
                key={`${group.id}-axis`}
                scope="colgroup"
              >
                {group.label}
              </th>
            ))}
          </tr>
        )}
        <tr>
          {columns.map((row) => (
            <th
              className="px-3 pt-1 pb-1 text-start text-chart-tooltip-muted text-meta font-medium"
              key={`${row.label}-head`}
              scope="col"
            >
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                {row.label}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {columns.map((row) => (
            <td className="px-3 pb-2.5 font-medium tabular-nums" key={`${row.label}-value`}>
              {typeof row.value === "number"
                ? row.unit
                  ? `${format(row.value)} ${row.unit}`
                  : format(row.value)
                : row.value}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

ChartTooltipTable.displayName = "ChartTooltipTable";

// Dual-axis — RM-121
/** One value axis' column group in a dual-axis tooltip table. */
export interface ChartTooltipTableAxisGroup {
  /** The axis id (`YAxis yAxisId`). */
  id: string;
  /** The axis' side header — "Left scale" / "Right scale". */
  label: ReactNode;
  /** The series keys (`TooltipRow.label`) drawn on this axis. */
  keys: readonly string[];
}

/**
 * Provided by a dual-axis `ComposedChart` (RM-121): the table groups its
 * series columns under one side header per axis. Internal — no public prop.
 */
export const ChartTooltipTableAxisGroupsContext = createContext<
  readonly ChartTooltipTableAxisGroup[] | undefined
>(undefined);

/**
 * The provided axis groups with the hovered rows sorted into them, or
 * `undefined` (a flat table) unless EVERY row belongs to exactly one group —
 * a custom `rows` renderer with its own labels keeps today's flat shape.
 */
function useTooltipTableAxisGroups(
  rows: TooltipRow[],
): Array<{ id: string; label: ReactNode; rows: TooltipRow[] }> | undefined {
  const groups = useContext(ChartTooltipTableAxisGroupsContext);
  if (!groups || groups.length < 2 || rows.length === 0) return undefined;
  const sorted = groups.map((group) => ({
    id: group.id,
    label: group.label,
    rows: rows.filter((row) => group.keys.includes(row.label)),
  }));
  const placed = sorted.reduce((sum, group) => sum + group.rows.length, 0);
  if (placed !== rows.length) return undefined;
  return sorted.filter((group) => group.rows.length > 0);
}

export default ChartTooltipTable;
