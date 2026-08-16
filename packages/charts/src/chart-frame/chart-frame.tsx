"use client";

/**
 * ChartFrame — universal chart wrapper with expand / flip-to-table / download-CSV.
 *
 * Architecture notes:
 * - `data`/`columns` are PRIMARY inputs; `useChart` is unreachable here (ChartFrame
 *   is the chart's parent, above the provider — see chart-context.tsx:356-388).
 * - Flip-to-table uses @elabs-ai/components-ui Table primitive (NOT @elabs-ai/components-data DataTable) to
 *   preserve the one-way dep rule: charts → ui is allowed; charts → data is not.
 * - CSV download uses the local serializer below. The canonical reusable serializer
 *   is @elabs-ai/components-data's `toCsv`; ChartFrame intentionally does NOT import it to keep
 *   @elabs-ai/components-charts dependency-clean. For the full interactive table (sortable
 *   @elabs-ai/components-data DataTable + downloadCsv on flip), use the `chart-frame-data`
 *   registry block: `npx shadcn add chart-frame-data` (composes both siblings in
 *   copy-owned app code, which the charts↛data rule permits).
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { Download, Maximize2, Table as TableIcon } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CopyableValue,
  Dialog,
  ExpandDialog,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Toggle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
  useLocale,
} from "@elabs-ai/components-ui";
import {
  ChartFrameProvider,
  useChartFrame,
  type ChartFrameColumn,
  type ChartFrameFeature,
} from "./chart-frame-context";
import { useChartValueFormatter } from "../charts/chart-formatters";
import { exactValueString } from "../charts/value-format";

// ── Minimal local CSV serializer (RFC 4180 + injection guard) ─────────────────
// The canonical reusable version lives in @elabs-ai/components-data (`toCsv`). This local
// copy keeps @elabs-ai/components-charts free of a sibling dependency.

const INJECTION_PREFIXES = ["=", "+", "-", "@"];

function localStringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function localQuote(field: string, delim: string): string {
  if (INJECTION_PREFIXES.some((p) => field.startsWith(p))) field = "'" + field;
  if (field.includes(delim) || field.includes('"') || field.includes("\n") || field.includes("\r"))
    return '"' + field.replaceAll('"', '""') + '"';
  return field;
}

function localToCsv(rows: Record<string, unknown>[], cols: ChartFrameColumn[]): string {
  const D = ",";
  const header = cols.map((c) => localQuote(c.header ?? c.key, D)).join(D);
  const body = rows
    .map((r) => cols.map((c) => localQuote(localStringify(r[c.key]), D)).join(D))
    .join("\r\n");
  return header + "\r\n" + body + "\r\n";
}

function localDownloadCsv(
  rows: Record<string, unknown>[],
  cols: ChartFrameColumn[],
  filename = "chart-data",
): void {
  if (typeof document === "undefined") return;
  const csv = localToCsv(rows, cols);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename + ".csv";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Summary stats for default detail panel ───────────────────────────────────

function computeStats(
  rows: Record<string, unknown>[],
  cols: ChartFrameColumn[],
): { key: string; min: number; max: number; mean: number }[] {
  return cols
    .filter((c) => rows.every((r) => typeof r[c.key] === "number"))
    .map((c) => {
      const vals = rows.map((r) => r[c.key] as number);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      return { key: c.header ?? c.key, min, max, mean };
    });
}

// ── Flip-to-table renderer (default) ─────────────────────────────────────────

/** A column is numeric when every present row holds a number for that key. */
function isNumericColumn(rows: Record<string, unknown>[], key: string): boolean {
  return rows.length > 0 && rows.every((r) => typeof r[key] === "number");
}

function DefaultTable({
  rows,
  columns,
  caption,
}: {
  rows: Record<string, unknown>[];
  columns: ChartFrameColumn[];
  /** Accessible name for the table (the AT alternative to the chart, issue #145). */
  caption?: ReactNode;
}) {
  /*
   * The table view is the EXACT-value surface — it is what "flip to table"
   * exists for — so it stays on `"number"` (grouped digits) while the rest of
   * the library compacts. Compacting here would shorten every cell and then
   * need a copy button on each one, which is 30+ tab stops to recover digits
   * that were already on screen a moment ago.
   */
  const formatNumber = useChartValueFormatter("number");
  const formatCell = (v: unknown): string =>
    typeof v === "number" ? formatNumber(v) : localStringify(v);

  return (
    <Table>
      {caption ? <TableCaption className="sr-only">{caption}</TableCaption> : null}
      <TableHeader>
        <TableRow>
          {columns.map((c) => {
            const numeric = isNumericColumn(rows, c.key);
            return (
              <TableHead key={c.key} scope="col" className={numeric ? "text-end" : undefined}>
                {c.header ?? c.key}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {columns.map((c) => (
              <TableCell
                key={c.key}
                className={isNumericColumn(rows, c.key) ? "text-end tabular-nums" : undefined}
              >
                {formatCell(row[c.key])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function ChartFrameToolbar() {
  const { state, actions, meta } = useChartFrame();
  const { features } = meta;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {features.includes("table") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                pressed={state.view === "table"}
                onPressedChange={actions.toggleView}
                aria-label="Flip to table view"
              >
                <TableIcon aria-hidden="true" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>
              {state.view === "table" ? "Show chart" : "Show as table"}
            </TooltipContent>
          </Tooltip>
        )}

        {features.includes("download") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Download CSV"
                onClick={actions.download}
              >
                <Download aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download CSV</TooltipContent>
          </Tooltip>
        )}

        {features.includes("expand") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Expand chart"
                onClick={() => actions.setExpanded(true)}
              >
                <Maximize2 aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Expand</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

// ── Default detail panel ──────────────────────────────────────────────────────

function DefaultDetail() {
  const { meta } = useChartFrame();
  const { rows, columns } = meta;
  const stats = computeStats(rows, columns);
  // The summary is a glanceable panel in a narrow pane, so it compacts — and
  // each figure carries its own unrounded value to the clipboard.
  const format = useChartValueFormatter();

  /*
   * Title/description already appear in the dialog header — this panel adds the
   * data summary, not a repeat of the chrome.
   *
   * No `role="region"` here: `ExpandDialogPanes` now owns exactly one named
   * region per pane, and nesting a second one inside it risks an axe
   * `landmark-unique` violation. The name is passed up as `detailLabel`, so
   * what AT announces is unchanged.
   *
   * `<h3>` because `DialogTitle` renders the `<h2>` — a bolded `<p>` looked
   * like a heading without being one.
   */
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold text-card-foreground">Summary</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No data to summarize.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Rows:{" "}
            <span className="tabular-nums font-medium text-card-foreground">{rows.length}</span>
          </p>
          {stats.map((s) => (
            <div key={s.key} className="space-y-0.5">
              <p className="text-xs font-medium text-card-foreground">{s.key}</p>
              <div className="flex gap-3 text-xs text-muted-foreground tabular-nums">
                <span>
                  min{" "}
                  <CopyableValue className="text-card-foreground" value={exactValueString(s.min)}>
                    {format(s.min)}
                  </CopyableValue>
                </span>
                <span>
                  max{" "}
                  <CopyableValue className="text-card-foreground" value={exactValueString(s.max)}>
                    {format(s.max)}
                  </CopyableValue>
                </span>
                <span>
                  avg{" "}
                  <CopyableValue className="text-card-foreground" value={exactValueString(s.mean)}>
                    {format(s.mean)}
                  </CopyableValue>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Expand modal ──────────────────────────────────────────────────────────────

function ChartFrameModal({
  children,
  detail,
  renderTable,
}: {
  children: ReactNode;
  detail?: ReactNode;
  renderTable: (rows: Record<string, unknown>[], columns: ChartFrameColumn[]) => ReactNode;
}) {
  const { state, actions, meta } = useChartFrame();
  const { title, description, rows, columns } = meta;

  /*
   * The two-pane expand layout is NOT local any more — it is
   * `ExpandDialog` in `@elabs-ai/components-ui`, so a chat table,
   * an image and a chart all open the same surface. What stays here is
   * chart-domain: the title fallback, the data summary, and the view↔table
   * crossfade below.
   */
  return (
    <Dialog open={state.expanded} onOpenChange={actions.setExpanded}>
      <ExpandDialog
        title={title ?? "Chart"}
        description={description}
        detail={detail ?? <DefaultDetail />}
        detailLabel="Chart summary"
      >
        <div
          key={state.view}
          className="size-full animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
        >
          {state.view === "table" ? (
            renderTable(rows, columns)
          ) : (
            <div className="h-full">{children}</div>
          )}
        </div>
      </ExpandDialog>
    </Dialog>
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ChartFrameProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  /** Primary data input for table view and CSV download. */
  data?: Record<string, unknown>[];
  /**
   * Column definitions. Omitted → derived from Object.keys(data[0]).
   * Determines column order/labels in both the table view and CSV export.
   */
  columns?: ChartFrameColumn[];
  /** Right-pane content in the expand modal. Defaults to a data summary (row count + per-numeric-column min/max/avg). */
  detail?: ReactNode;
  /**
   * Which toolbar controls to show. Defaults to all three.
   * `table` and `download` are automatically hidden when `data` is absent/empty.
   */
  features?: ChartFrameFeature[];
  /** Inline body height in px. Defaults to 260. */
  height?: number;
  /**
   * Loading vs ready — renders a layout-shaped skeleton at the normal body
   * height and suppresses the expand/flip-to-table/download toolbar
   * (meaningless with no data yet). Default: `false`.
   */
  loading?: boolean;
  /**
   * Custom table renderer for the flip-to-table view.
   * Defaults to the @elabs-ai/components-ui Table primitive.
   */
  renderTable?: (rows: Record<string, unknown>[], columns: ChartFrameColumn[]) => ReactNode;
  /**
   * Custom CSV download handler. Defaults to the local RFC-4180 serializer
   * (injection-guarded). The canonical reusable version is @elabs-ai/components-data `toCsv`;
   * wire it here, or use the `chart-frame-data` registry block
   * (`npx shadcn add chart-frame-data`) for the full sortable DataTable + downloadCsv.
   */
  onDownload?: (rows: Record<string, unknown>[], columns: ChartFrameColumn[]) => void;
  /** The chart content. Rendered in both inline and expanded modal positions. */
  children: ReactNode;
}

export const ChartFrame = forwardRef<HTMLDivElement, ChartFrameProps>(function ChartFrame(
  {
    title,
    description,
    data,
    columns: columnsProp,
    detail,
    features: featuresProp,
    height = 260,
    renderTable,
    onDownload,
    loading = false,
    className,
    children,
    ...props
  },
  ref,
) {
  const hasData = Array.isArray(data) && data.length > 0;

  // Derive resolved columns from data keys when not specified.
  const firstRow = hasData ? data![0] : undefined;
  const resolvedColumns: ChartFrameColumn[] =
    columnsProp ?? (firstRow !== undefined ? Object.keys(firstRow).map((k) => ({ key: k })) : []);

  // Feature degradation: table/download require data; every toolbar control is
  // meaningless while loading (nothing to flip-to-table, download, or expand).
  const allFeatures: ChartFrameFeature[] = featuresProp ?? ["expand", "table", "download"];
  const resolvedFeatures: ChartFrameFeature[] = loading
    ? []
    : hasData
      ? allFeatures
      : allFeatures.filter((f) => f === "expand");

  const resolvedDownload =
    onDownload ??
    ((rows: Record<string, unknown>[], cols: ChartFrameColumn[]) => localDownloadCsv(rows, cols));

  const resolvedRenderTable =
    renderTable ??
    ((rows: Record<string, unknown>[], cols: ChartFrameColumn[]) => (
      <DefaultTable rows={rows} columns={cols} caption={title} />
    ));

  return (
    <ChartFrameProvider
      rows={data ?? []}
      columns={resolvedColumns}
      features={resolvedFeatures}
      title={title}
      description={description}
      onDownload={resolvedDownload}
      loading={loading}
    >
      <ChartFrameInner
        ref={ref}
        className={className}
        height={height}
        detail={detail}
        renderTable={resolvedRenderTable}
        title={title}
        description={description}
        {...props}
      >
        {children}
      </ChartFrameInner>
    </ChartFrameProvider>
  );
});

// Inner component that consumes the context (avoids provider/consumer in the
// same render function).
interface ChartFrameInnerProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  height: number;
  detail?: ReactNode;
  renderTable: (rows: Record<string, unknown>[], columns: ChartFrameColumn[]) => ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

const ChartFrameInner = forwardRef<HTMLDivElement, ChartFrameInnerProps>(function ChartFrameInner(
  { height, detail, renderTable, title, description, className, children, ...props },
  ref,
) {
  const { state, meta } = useChartFrame();
  const { rows, columns, loading } = meta;
  const { t } = useLocale();

  return (
    <>
      <Card ref={ref} className={cn("flex flex-col", className)} {...props}>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
          <div className="space-y-1">
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <ChartFrameToolbar />
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div
            style={{ height }}
            className="w-full overflow-auto"
            {...(loading ? { role: "status", "aria-live": "polite" as const } : {})}
          >
            {loading ? (
              <>
                <span className="sr-only">{t("charts.chart.loading")}</span>
                <Skeleton className="size-full" />
              </>
            ) : (
              // Key on the active view so each flip remounts the subtree and the
              // incoming chart/table fades+settles in. tw-animate-css is globally
              // motion-gated (retimed via --t-*, floored under reduced motion);
              // motion-reduce:animate-none removes the movement entirely.
              <div
                key={state.view}
                className="size-full animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
              >
                {state.view === "table" ? renderTable(rows, columns) : children}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ChartFrameModal detail={detail} renderTable={renderTable}>
        {children}
      </ChartFrameModal>
    </>
  );
});
