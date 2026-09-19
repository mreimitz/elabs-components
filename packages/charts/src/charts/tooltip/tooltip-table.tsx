"use client";

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
      <thead>
        <tr>
          {rows.map((row) => (
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
          {rows.map((row) => (
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

export default ChartTooltipTable;
