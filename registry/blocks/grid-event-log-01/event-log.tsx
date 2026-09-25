/**
 * Request log — an on-call engineer triages an incident from the edge logs.
 *
 * What it shows a copier: the grid as a log explorer. Events arrive a page at a
 * time (`onLoadMore` / `hasMore` / `loadingMore`) as the end of the list scrolls
 * into view — here from an in-memory source that stands in for your API. Set
 * filters on level and service, a number filter on duration (type `>1000`
 * under the header) and Find (Ctrl/⌘+F) narrow what is loaded. Saved views are
 * versioned `GridState`s: pick a preset or save the current view, and copy one
 * as JSON to paste into a ticket. "Export to Excel" writes exactly the rows and
 * columns on screen with `tableToXlsx`.
 */
"use client";

import { useCallback, useState, type ComponentType } from "react";
import { Bug, CircleX, FileSpreadsheet, Info, TriangleAlert } from "lucide-react";
import { DataGrid, XLSX_MIME, tableToXlsx, type ColumnDef } from "@elabs-ai/components-data";
import { Badge, Button } from "@elabs-ai/components-ui";
import { downloadFile } from "@/components/grid-parts/grid-kit";
import { SavedViewsMenu, useSavedViews, type SavedView } from "@/components/grid-parts/saved-views";
import { eventSource, type EventLevel, type LogEvent } from "./data/events";

const LEVEL: Record<
  EventLevel,
  {
    variant: "outline" | "secondary" | "warning" | "destructive";
    icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  }
> = {
  debug: { variant: "outline", icon: Bug },
  info: { variant: "secondary", icon: Info },
  warn: { variant: "warning", icon: TriangleAlert },
  error: { variant: "destructive", icon: CircleX },
};

function LevelBadge({ level }: { level: EventLevel }) {
  const { variant, icon: Icon } = LEVEL[level];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden={true} className="size-3" />
      {level}
    </Badge>
  );
}

const COLUMNS: ColumnDef<LogEvent>[] = [
  { accessorKey: "time", header: "Time", size: 230, meta: { filter: "text" } },
  {
    accessorKey: "level",
    header: "Level",
    size: 110,
    cell: ({ row }) => <LevelBadge level={row.original.level} />,
    meta: { filter: "set" },
  },
  { accessorKey: "service", header: "Service", size: 130, meta: { filter: "set" } },
  { accessorKey: "host", header: "Host", size: 140, meta: { filter: "set" } },
  { accessorKey: "method", header: "Method", size: 100, meta: { filter: "set" } },
  { accessorKey: "route", header: "Route", size: 200 },
  {
    accessorKey: "status",
    header: "Status",
    size: 90,
    meta: { numeric: true, format: { abbreviate: false, decimals: 0 } },
  },
  {
    accessorKey: "duration",
    header: "Duration",
    size: 120,
    meta: {
      numeric: true,
      format: { abbreviate: false, decimals: 0, suffix: " ms" },
      filter: "number",
    },
  },
  { accessorKey: "traceId", header: "Trace", size: 110 },
  { accessorKey: "message", header: "Message", size: 420 },
];

/** The views every engineer starts from. A saved view is just a versioned GridState. */
export const EVENT_LOG_VIEWS: SavedView[] = [
  {
    id: "all",
    name: "All events",
    builtIn: true,
    state: { version: 1 },
  },
  {
    id: "errors",
    name: "Errors only",
    builtIn: true,
    state: {
      version: 1,
      columnFilters: [{ id: "level", value: { type: "set", values: ["error"] } }],
      columnVisibility: { method: false, host: false },
    },
  },
  {
    id: "slow",
    name: "Slow requests (> 1 s)",
    builtIn: true,
    state: {
      version: 1,
      columnFilters: [
        { id: "duration", value: { type: "number", conditions: [{ op: "gt", value: 1000 }] } },
      ],
      sorting: [{ id: "duration", desc: true }],
    },
  },
  {
    id: "checkout",
    name: "Checkout service",
    builtIn: true,
    state: {
      version: 1,
      columnFilters: [{ id: "service", value: { type: "set", values: ["checkout"] } }],
      columnVisibility: { service: false },
    },
  },
];

const PAGE = 100;

export interface EventLogProps {
  /** Events the source holds in total. Default 5,000. */
  total?: number;
  /** Simulated round-trip for each page, in ms. Default 350. */
  latency?: number;
  views?: SavedView[];
}

export function EventLog({ total = 5000, latency = 350, views = EVENT_LOG_VIEWS }: EventLogProps) {
  const [source] = useState(() => eventSource(total));
  const [rows, setRows] = useState(() => source.page(0, PAGE));
  const [loading, setLoading] = useState(false);
  const saved = useSavedViews(views);

  const loadMore = useCallback(() => {
    setLoading(true);
    // Stands in for `fetch("/api/events?cursor=…")`.
    setTimeout(() => {
      setRows((current) => [...current, ...source.page(current.length, PAGE)]);
      setLoading(false);
    }, latency);
  }, [latency, source]);

  return (
    <section
      aria-labelledby="event-log-title"
      className="flex flex-col gap-3"
      data-slot="event-log"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-subtitle font-semibold" id="event-log-title">
          Edge request log
        </h2>
        <p className="text-meta text-muted-foreground tabular-nums">
          {rows.length.toLocaleString("en-US")} of {source.total.toLocaleString("en-US")} events
          loaded — more load as you scroll. Filters and Find apply to what is loaded.
        </p>
      </div>
      <DataGrid
        initialView={saved.initialView}
        key={saved.gridKey}
        caption="Edge request log, newest first"
        columns={COLUMNS}
        data={rows}
        enableFind
        enableRowVirtualization
        exportFileName="request-log"
        floatingFilters
        getRowId={(row) => row.id}
        hasMore={rows.length < source.total}
        loadingMore={loading}
        maxBodyHeight="32rem"
        onLoadMore={loadMore}
        toolbar={(table) => (
          <div className="flex flex-wrap items-center gap-2">
            <SavedViewsMenu
              activeId={saved.active?.id}
              onApply={saved.apply}
              onSave={saved.save}
              table={table}
              views={saved.views}
            />
            <Button
              onClick={() =>
                downloadFile(
                  tableToXlsx(table, { sheetName: "Requests" }),
                  "request-log.xlsx",
                  XLSX_MIME,
                )
              }
              size="sm"
              variant="outline"
            >
              <FileSpreadsheet aria-hidden="true" />
              Export to Excel
            </Button>
          </div>
        )}
      />
    </section>
  );
}
