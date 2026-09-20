"use client";

import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

import type { MapPlanRegion } from "../lib/plan-regions";
import { PLAN_STATUS_ENCODING, type PlanStatus } from "../lib/plan-status";

export interface MapPlanTableColumn {
  /** Column key, used for the cell lookup and the React key. */
  key: string;
  /** Column header text. */
  header: string;
  /** Right-align the column — numbers belong on the end edge. */
  numeric?: boolean;
  /** The cell's content for one region. */
  cell: (region: MapPlanRegion) => ReactNode;
}

export interface MapPlanTableProps {
  /** The same regions the plan draws. */
  regions: readonly MapPlanRegion[];
  /** What the table is a table of ("Every room on level 3, with its state"). */
  caption: string;
  /** Extra columns after the name. The status column is built in when `status` is given. */
  columns?: readonly MapPlanTableColumn[];
  /** A region's status, if the plan has one. Adds a status column with the word. */
  status?: (region: MapPlanRegion) => PlanStatus | undefined;
  /** The word for each status — supplied by the consumer, so it can be localized. */
  statusLabels?: Partial<Record<PlanStatus, string>>;
  /** Header for the built-in status column. */
  statusHeader?: string;
  /** Header for the name column. */
  nameHeader?: string;
  /** The selected region id(s), mirrored as a row state. */
  selectedId?: string | readonly string[] | null;
  /** Called when a row is chosen — the table is a second way to reach a region. */
  onSelect?: (id: string, region: MapPlanRegion) => void;
  /**
   * Hide the table on screen and keep it for print (default false). A WebGL
   * canvas prints blank, so a plan that is meant to be printed needs this.
   */
  printOnly?: boolean;
  className?: string;
}

/**
 * The plan as words — the parallel channel for anyone who cannot see the canvas,
 * for anyone who needs to sort or search it, and for the printer, which gets a
 * blank rectangle where the WebGL canvas was.
 *
 * Visible by default rather than `sr-only`: the information is useful to
 * everyone, and a hidden twin quietly rots.
 */
export function MapPlanTable({
  regions,
  caption,
  columns,
  status,
  statusLabels,
  statusHeader,
  nameHeader = "Name",
  selectedId,
  onSelect,
  printOnly = false,
  className,
}: MapPlanTableProps) {
  const selected = selectedId == null ? [] : Array.isArray(selectedId) ? selectedId : [selectedId];

  return (
    <div data-slot="map-plan-table" className={cn(printOnly && "hidden print:block", className)}>
      <Table>
        <TableCaption>{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{nameHeader}</TableHead>
            {status && <TableHead scope="col">{statusHeader}</TableHead>}
            {columns?.map((column) => (
              <TableHead key={column.key} scope="col" className={column.numeric ? "text-end" : ""}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {regions.map((region) => {
            const regionStatus = status?.(region);
            const encoding = regionStatus ? PLAN_STATUS_ENCODING[regionStatus] : undefined;
            const isSelected = selected.includes(region.id);

            return (
              <TableRow
                key={region.id}
                data-slot="map-plan-table-row"
                data-selected={isSelected || undefined}
                data-status={regionStatus}
                aria-selected={onSelect ? isSelected : undefined}
              >
                <TableCell>
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(region.id, region)}
                      className="rounded-sm text-start focus-ring"
                    >
                      {region.label}
                    </button>
                  ) : (
                    region.label
                  )}
                </TableCell>
                {status && (
                  <TableCell>
                    {regionStatus && encoding ? (
                      <span className="inline-flex items-center gap-1.5">
                        {encoding.icon && (
                          <encoding.icon
                            className={cn("size-3.5", encoding.textClass)}
                            aria-hidden="true"
                          />
                        )}
                        <span className={encoding.textClass}>
                          {statusLabels?.[regionStatus] ?? regionStatus}
                        </span>
                      </span>
                    ) : null}
                  </TableCell>
                )}
                {columns?.map((column) => (
                  <TableCell
                    key={column.key}
                    className={column.numeric ? "text-end tabular-nums" : ""}
                  >
                    {column.cell(region)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
