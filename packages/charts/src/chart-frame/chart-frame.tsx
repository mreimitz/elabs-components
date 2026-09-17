"use client";

/**
 * ChartFrame — universal chart wrapper with expand / flip-to-table /
 * download-CSV / export-SVG / export-PNG.
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
 * - SVG/PNG export (RM-042) lives in `export-svg.ts` — it needs the rendered
 *   `<svg>` DOM node, which only `ChartFrameInner` has access to, so the
 *   provider holds `refs.chartBody`/`refs.card` and the export actions read
 *   `.current` at click time rather than pre-resolving like `onDownload` does.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { Download, FileCode2, ImageDown, Maximize2, Table as TableIcon } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
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
  csvQuoteField,
  csvStringifyValue,
  useLocale,
} from "@elabs-ai/components-ui";
import {
  ChartFrameProvider,
  useChartFrame,
  type ChartFrameColumn,
  type ChartFrameFeature,
} from "./chart-frame-context";
import { findChartSvg, type ChartExportKind } from "./export-svg";
import { useChartValueFormatter } from "../charts/chart-formatters";
import { exactValueString } from "../charts/value-format";
import { ChartSourceRow } from "../chart-card/chart-card";
import {
  ChartConfigProvider,
  useChartConfig,
  type ChartDensity,
  type ChartInteractions,
} from "../charts/chart-config-context";

// ── Minimal local CSV serializer (RFC 4180 + injection guard) ─────────────────
// The canonical reusable version lives in @elabs-ai/components-data (`toCsv`). This local
// copy keeps @elabs-ai/components-charts free of a sibling dependency; value
// stringification + injection-guarded quoting come from @elabs-ai/components-ui's shared
// `csv` lib, the same one `toCsv` builds on, so both stay in sync.

const localStringify = csvStringifyValue;
const localQuote = csvQuoteField;

function localToCsv(
  rows: Record<string, unknown>[],
  cols: ChartFrameColumn[],
  /** Attribution text, appended as a trailing `# source: …` comment row. */
  sourceText?: string,
): string {
  const D = ",";
  const header = cols.map((c) => localQuote(c.header ?? c.key, D)).join(D);
  const body = rows
    .map((r) => cols.map((c) => localQuote(localStringify(r[c.key]), D)).join(D))
    .join("\r\n");
  const sourceLine = sourceText
    ? "\r\n# source: " + sourceText.replaceAll(/[\r\n]+/g, " ").trim()
    : "";
  return header + "\r\n" + body + sourceLine + "\r\n";
}

function localDownloadCsv(
  rows: Record<string, unknown>[],
  cols: ChartFrameColumn[],
  filename = "chart-data",
  sourceText?: string,
): void {
  if (typeof document === "undefined") return;
  const csv = localToCsv(rows, cols, sourceText);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename + ".csv";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer the revoke past the current task: some browsers (Safari) start the
  // save asynchronously off the click and cancel it if the object URL is
  // invalidated too early.
  setTimeout(() => URL.revokeObjectURL(url), 0);
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

/**
 * True when the frame's density tier has no room for the full inline toolbar
 * (#444): at `xs`/`sm` the toolbar collapses to its single Expand control and
 * the remaining actions move into the expanded view, so the title keeps its
 * width instead of truncating to a letter. Without an Expand feature there is
 * nowhere to collapse into, so the full toolbar stays (every action keeps a
 * keyboard path).
 */
function useToolbarCollapsed(): boolean {
  const { meta } = useChartFrame();
  const compact = meta.density === "xs" || meta.density === "sm";
  return compact && meta.features.includes("expand");
}

function ChartFrameToolbar({ placement = "inline" }: { placement?: "inline" | "expanded" }) {
  const { state, actions, meta } = useChartFrame();
  const collapsed = useToolbarCollapsed();
  const { t } = useLocale();
  // Inline + collapsed → Expand only. Inside the expand view → everything but
  // Expand (the view is already open).
  const features = !collapsed
    ? meta.features
    : placement === "inline"
      ? meta.features.filter((f) => f === "expand")
      : meta.features.filter((f) => f !== "expand");
  // export-svg/export-png degrade the same way table/download degrade without
  // data (chart-components.md § Feature degradation) — `hasSvg` is registered
  // by ChartFrameInner after render, since (unlike `data`) a rendered `<svg>`
  // isn't known until the chart body has mounted.
  const canExport = state.hasSvg;

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
                aria-label={t("charts.chartFrame.flipToTable")}
              >
                <TableIcon aria-hidden="true" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>
              {state.view === "table"
                ? t("charts.chartFrame.showChart")
                : t("charts.chartFrame.showAsTable")}
            </TooltipContent>
          </Tooltip>
        )}

        {features.includes("download") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("charts.chartFrame.downloadCsv")}
                onClick={actions.download}
              >
                <Download aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("charts.chartFrame.downloadCsv")}</TooltipContent>
          </Tooltip>
        )}

        {features.includes("export-svg") && canExport && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("charts.chartFrame.exportSvg")}
                onClick={actions.exportSvg}
              >
                <FileCode2 aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("charts.chartFrame.exportSvg")}</TooltipContent>
          </Tooltip>
        )}

        {features.includes("export-png") && canExport && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("charts.chartFrame.exportPng")}
                onClick={actions.exportPng}
              >
                <ImageDown aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("charts.chartFrame.exportPng")}</TooltipContent>
          </Tooltip>
        )}

        {features.includes("expand") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("charts.chartFrame.expandChart")}
                onClick={() => actions.setExpanded(true)}
              >
                <Maximize2 aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("charts.chartFrame.expand")}</TooltipContent>
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
  const { t } = useLocale();

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
      <h3 className="text-sm font-semibold text-card-foreground">
        {t("charts.chartFrame.summary")}
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("charts.chartFrame.noDataToSummarize")}</p>
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
  source,
}: {
  children: ReactNode;
  detail?: ReactNode;
  renderTable: (rows: Record<string, unknown>[], columns: ChartFrameColumn[]) => ReactNode;
  source?: ReactNode;
}) {
  const { state, actions, meta } = useChartFrame();
  const { title, description, rows, columns } = meta;
  const { t } = useLocale();
  // The inline toolbar collapsed to Expand at a small density tier (#444): the
  // actions it dropped (table flip, CSV, exports) live here instead.
  const toolbarCollapsed = useToolbarCollapsed();
  const hasMovedActions = meta.features.some((f) => f !== "expand");

  /*
   * The two-pane expand layout is NOT local any more — it is
   * `ExpandDialog` in `@elabs-ai/components-ui`, so a chat table,
   * an image and a chart all open the same surface. What stays here is
   * chart-domain: the title fallback, the data summary, and the view↔table
   * crossfade below.
   *
   * The source row rides UNDER the enlarged chart/table (the `children`
   * pane), not inside the detail/summary pane (#184) — it is attribution
   * for the view, not for the statistics beside it, and `detail` stays
   * byte-identical (`detail ?? <DefaultDetail />`) whether or not `source`
   * is set. It also now shares the card's truncate-and-recover behaviour
   * instead of wrapping, so the row behaves the same way in both containers.
   */
  return (
    <Dialog open={state.expanded} onOpenChange={actions.setExpanded}>
      <ExpandDialog
        title={title ?? t("charts.chartFrame.defaultTitle")}
        description={description}
        detail={detail ?? <DefaultDetail />}
        detailLabel={t("charts.chartFrame.summaryDetailLabel")}
      >
        <div className="flex h-full flex-col">
          {toolbarCollapsed && hasMovedActions ? (
            <div
              data-slot="chart-frame-expanded-toolbar"
              className="flex shrink-0 justify-end pb-2"
            >
              <ChartFrameToolbar placement="expanded" />
            </div>
          ) : null}
          <div
            key={state.view}
            className="min-h-0 flex-1 animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
          >
            {state.view === "table" ? (
              renderTable(rows, columns)
            ) : (
              // The expanded view has room for every piece of furniture, so it
              // resets `density` to `"md"`; `interactions` still apply (RM-072).
              <ChartConfigBridge density="md">
                <div className="h-full">{children}</div>
              </ChartConfigBridge>
            )}
          </div>
          {source ? (
            // `pt-2` (tighter than the view pane's own `p-4`) reads as a
            // footnote closer to the pane's edge than to the chart above it.
            <ChartSourceRow source={source} className="shrink-0 pt-2" />
          ) : null}
        </div>
      </ExpandDialog>
    </Dialog>
  );
}

// ── Chart config bridge (RM-072) ──────────────────────────────────────────────

/**
 * Forwards the frame's `density`/`interactions` into `ChartConfigProvider`,
 * layered over any outer provider (springs, currency) rather than resetting it.
 * Renders no DOM, so a frame with neither prop keeps its exact markup.
 */
function ChartConfigBridge({ density, children }: { density?: ChartDensity; children: ReactNode }) {
  const outer = useChartConfig();
  const { meta } = useChartFrame();
  const value = useMemo(
    () => ({ ...outer, interactions: meta.interactions, density: density ?? meta.density }),
    [outer, meta.interactions, meta.density, density],
  );
  return <ChartConfigProvider value={value}>{children}</ChartConfigProvider>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * What the frame draws around the chart (RM-072).
 *
 * - `card` — today's bordered card with header, toolbar and source row.
 * - `tile` — no card surface (the host sheet tile owns border, radius and
 *   padding); header from `headerSlot`, menu from `menuSlot`, source row kept.
 * - `bare` — the chart body only.
 */
export type ChartFrameChrome = "card" | "tile" | "bare";

/** What `menuSlot` receives when it is a function (RM-072). */
export interface ChartFrameMenuApi {
  /** Toolbar features still available after data/loading degradation. */
  features: ChartFrameFeature[];
  view: "chart" | "table";
  /** Whether the body renders an exportable `<svg>`. */
  canExport: boolean;
  expand: () => void;
  toggleView: () => void;
  download: () => void;
  exportSvg: () => void;
  exportPng: () => void;
}

export interface ChartFrameProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /**
   * Write the title as the CONCLUSION, not the chart type — "Revenue is up
   * 8% QoQ", not "Revenue chart". Put what each series means in prose in
   * `description` (lieflat's card contract).
   */
  title?: ReactNode;
  /**
   * Prose that IS the legend — what a reader needs to read the chart
   * correctly (series, units, scope), written as a sentence, not a caption.
   */
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
   * Which toolbar controls to show. Defaults to all five.
   * `table` and `download` are automatically hidden when `data` is absent/empty;
   * `export-svg`/`export-png` are automatically hidden when the chart body has
   * no `<svg>` (a non-chart placeholder, or the flipped-to-table view).
   */
  features?: ChartFrameFeature[];
  /**
   * Inline body height in px. Defaults to 260 for `chrome="card"`/`"bare"`.
   * With `chrome="tile"` and no `height`, the frame fills its host instead
   * (`h-full` flex column, chart body takes the space left after header and
   * source row) — the host tile sets the height (#444).
   */
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
  /**
   * Routes an SVG/PNG export to the caller — with the generated `Blob` and
   * filename — instead of triggering a local browser download. Mirrors
   * `onDownload`, for apps that want to route an export through their own
   * storage. When absent, the built-in handler downloads the file directly.
   */
  onExport?: (kind: ChartExportKind, blob: Blob, filename: string) => void;
  /**
   * Attribution / provenance footer — e.g. "Source: Internal analytics,
   * updated daily". Renders as the card's all-caps, letter-spaced source row
   * (the fourth part of lieflat's card contract) inline and in the expand
   * modal, under the chart in both — never appended to the summary
   * statistics; when it is a plain string it also lands as a trailing
   * `# source: …` comment row in the downloaded CSV, and as a bottom row in
   * an SVG/PNG export. Hidden when absent. A string that overflows the row
   * stays fully recoverable — a native `title` and, once it measurably
   * overflows, a keyboard-reachable tooltip (#184). A non-string node keeps
   * only the CSS caps with no overflow recovery — keep it short, or accept
   * it may be visually truncated with no fallback.
   */
  source?: ReactNode;
  /**
   * Surface drawn around the chart (RM-072). Default `"card"` — byte-identical
   * to a frame without the prop. See `ChartFrameChrome`.
   */
  chrome?: ChartFrameChrome;
  /** `chrome="tile"` only: replaces the default title/description header. */
  headerSlot?: ReactNode;
  /**
   * `chrome="tile"` only: replaces the inline toolbar. A function receives the
   * frame's actions, so a host kebab menu can open the expand modal, flip to
   * the table or export without reaching into context.
   */
  menuSlot?: ReactNode | ((api: ChartFrameMenuApi) => ReactNode);
  /** Fires when the expand modal opens or closes, however it was triggered. */
  onExpandChange?: (open: boolean) => void;
  /**
   * Which interaction layers the chart mounts (`passive` tooltips, `active`
   * brush/datapoint targets, `select` datapoint activation, `edit`).
   * Defaults: all `true` except `edit: false`. Forwarded to every chart
   * family through `useChartConfig()`.
   */
  interactions?: ChartInteractions;
  /**
   * Furniture tier (`"xs" | "sm" | "md" | "lg"`, default `"md"`). Forwarded to
   * every chart family through `useChartConfig()`; the frame itself drops
   * `description` and the source row at `xs` and clamps the title to one line
   * at `xs`/`sm`.
   */
  density?: ChartDensity;
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
    height,
    renderTable,
    onDownload,
    onExport,
    loading = false,
    source,
    chrome = "card",
    headerSlot,
    menuSlot,
    onExpandChange,
    interactions,
    density = "md",
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

  // Feature degradation: table/download require data; export-svg/export-png
  // require a rendered <svg> (checked at runtime via `state.hasSvg`, so they
  // stay in the resolved set here — same shape as "expand", which needs
  // neither). Every toolbar control is meaningless while loading.
  const allFeatures: ChartFrameFeature[] = featuresProp ?? [
    "expand",
    "table",
    "download",
    "export-svg",
    "export-png",
  ];
  const resolvedFeatures: ChartFrameFeature[] = loading
    ? []
    : hasData
      ? allFeatures
      : allFeatures.filter((f) => f === "expand" || f === "export-svg" || f === "export-png");

  const resolvedDownload =
    onDownload ??
    ((rows: Record<string, unknown>[], cols: ChartFrameColumn[]) =>
      localDownloadCsv(rows, cols, "chart-data", typeof source === "string" ? source : undefined));

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
      source={source}
      onDownload={resolvedDownload}
      onExport={onExport}
      loading={loading}
      density={density}
      interactions={interactions}
      onExpandChange={onExpandChange}
    >
      <ChartFrameInner
        ref={ref}
        chrome={chrome}
        headerSlot={headerSlot}
        menuSlot={menuSlot}
        className={className}
        height={height}
        detail={detail}
        renderTable={resolvedRenderTable}
        title={title}
        description={description}
        source={source}
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
  height?: number;
  detail?: ReactNode;
  renderTable: (rows: Record<string, unknown>[], columns: ChartFrameColumn[]) => ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  source?: ReactNode;
  chrome: ChartFrameChrome;
  headerSlot?: ReactNode;
  menuSlot?: ChartFrameProps["menuSlot"];
  children: ReactNode;
}

const ChartFrameInner = forwardRef<HTMLDivElement, ChartFrameInnerProps>(function ChartFrameInner(
  {
    height,
    detail,
    renderTable,
    title,
    description,
    source: sourceProp,
    chrome,
    headerSlot,
    menuSlot,
    className,
    children,
    ...props
  },
  ref,
) {
  const { state, actions, meta, refs } = useChartFrame();
  const { rows, columns, loading, density } = meta;
  // RM-072 density: `xs` has no room for prose or attribution; `xs`/`sm`
  // clamp the title to one line and collapse the toolbar to Expand
  // (`useToolbarCollapsed`, #444). `md`/`lg` leave the header untouched.
  const compact = density === "xs" || density === "sm";
  const visibleDescription = density === "xs" ? undefined : description;
  const source = density === "xs" ? undefined : sourceProp;
  const { t } = useLocale();

  // Merge the caller's forwarded ref with the internal `card` ref (RM-042):
  // export reads the card's resolved background at click time via
  // `refs.card.current`, which only ChartFrameInner can attach since the
  // provider renders no DOM of its own.
  const mergedCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      refs.card.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref, refs.card],
  );

  // Registers whether the chart body currently renders an <svg> — the
  // export-svg/export-png toolbar controls read this off `state.hasSvg`
  // (RM-042). Re-checked on every commit that could change it (view flip,
  // loading toggle, or the chart's own children re-rendering) and, since a
  // chart family may mount its <svg> asynchronously, on any DOM mutation
  // inside the body while chart view is active.
  useEffect(() => {
    const container = refs.chartBody.current;
    if (!container) {
      actions.setHasSvg(false);
      return;
    }
    const update = () => actions.setHasSvg(Boolean(findChartSvg(container)));
    update();
    const observer = new MutationObserver(update);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [actions, refs.chartBody, state.view, loading, children]);

  // A tile without an explicit `height` fills its host (#444); every other
  // chrome keeps the fixed 260px default.
  const fillHost = chrome === "tile" && height === undefined;
  const titleText = typeof title === "string" ? title : undefined;

  // WCAG 2.1.1 (axe `scrollable-region-focusable`, #432 round 3): this box is
  // `overflow-auto`, so it needs a keyboard tab stop whenever its content is
  // genuinely taller/wider than it — a real timing race at narrow tile
  // widths, not a fixed layout. Unlike `side-dock-body`
  // (packages/ui/src/components/side-dock/side-dock.tsx), whose
  // caller-supplied children are assumed to always be able to overflow, a
  // chart's content is data-dependent and can fit OR overflow depending on
  // the tile's own size, so `tabIndex`/the accessible name are measured with
  // a `ResizeObserver` rather than always on — that also keeps the DOM
  // byte-identical (no `tabIndex`, no `aria-label`) for the common
  // non-overflowing case, so no existing chart snapshot/story changes.
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => {
      const next = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
      setOverflowing((prev) => (prev === next ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [state.view, loading, children]);

  const body = (
    <div
      ref={bodyScrollRef}
      style={fillHost ? undefined : { height: height ?? 260 }}
      className={cn(
        "w-full overflow-auto",
        fillHost && "h-full",
        overflowing && "focus-ring-inset",
      )}
      tabIndex={overflowing ? 0 : undefined}
      {...(loading
        ? { role: "status", "aria-live": "polite" as const }
        : overflowing
          ? {
              // ARIA 1.2 forbids `aria-label` on a generic element (axe
              // `aria-prohibited-attr`) — `role="group"` gives the label a
              // host without adding landmark noise (not `region`/`article`).
              role: "group" as const,
              "aria-label": t("charts.chartFrame.scrollableRegion", {
                title: titleText ?? t("charts.chartFrame.defaultTitle"),
              }),
            }
          : {})}
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
          ref={refs.chartBody}
          className="size-full animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
        >
          {state.view === "table" ? (
            renderTable(rows, columns)
          ) : (
            <ChartConfigBridge>{children}</ChartConfigBridge>
          )}
        </div>
      )}
    </div>
  );

  const modal = (
    <ChartFrameModal detail={detail} renderTable={renderTable} source={sourceProp}>
      {children}
    </ChartFrameModal>
  );

  if (chrome === "bare") {
    return (
      <>
        <div
          ref={mergedCardRef}
          data-slot="chart-frame"
          data-chrome="bare"
          className={cn("flex min-h-0 flex-col", className)}
          {...props}
        >
          {body}
        </div>
        {modal}
      </>
    );
  }

  if (chrome === "tile") {
    const menu =
      typeof menuSlot === "function"
        ? menuSlot({
            features: meta.features,
            view: state.view,
            canExport: state.hasSvg,
            expand: () => actions.setExpanded(true),
            toggleView: actions.toggleView,
            download: actions.download,
            exportSvg: actions.exportSvg,
            exportPng: actions.exportPng,
          })
        : menuSlot;
    const hasDefaultHeader = Boolean(title || visibleDescription);
    return (
      <>
        <div
          ref={mergedCardRef}
          data-slot="chart-frame"
          data-chrome="tile"
          className={cn("flex min-h-0 min-w-0 flex-col gap-2", fillHost && "h-full", className)}
          {...props}
        >
          {headerSlot !== undefined || hasDefaultHeader || menuSlot !== undefined ? (
            <div
              data-slot="chart-frame-header"
              className="flex min-w-0 shrink-0 flex-row items-start justify-between gap-2"
            >
              {headerSlot !== undefined ? (
                <div className="min-w-0 flex-1">{headerSlot}</div>
              ) : (
                <div className="min-w-0 flex-1 space-y-1">
                  {title && <CardTitle className={cn(compact && "truncate")}>{title}</CardTitle>}
                  {visibleDescription && <CardDescription>{visibleDescription}</CardDescription>}
                </div>
              )}
              {menuSlot !== undefined ? menu : <ChartFrameToolbar />}
            </div>
          ) : (
            <div data-slot="chart-frame-header" className="flex shrink-0 justify-end">
              <ChartFrameToolbar />
            </div>
          )}
          <div data-slot="chart-frame-body" className="min-h-0 flex-1">
            {body}
          </div>
          {source ? <ChartSourceRow source={source} className="w-full shrink-0" /> : null}
        </div>
        {modal}
      </>
    );
  }

  return (
    <>
      <Card ref={mergedCardRef} className={cn("flex flex-col", className)} {...props}>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
          <div className={compact ? "min-w-0 space-y-1" : "space-y-1"}>
            {title && (
              <CardTitle className={cn("text-base", compact && "truncate")}>{title}</CardTitle>
            )}
            {visibleDescription && <CardDescription>{visibleDescription}</CardDescription>}
          </div>
          <ChartFrameToolbar />
        </CardHeader>
        <CardContent className="flex-1 pt-0">{body}</CardContent>
        {source ? (
          // `pb-3` (tighter than the card's default `pb-6`) reads as a
          // footnote sitting close to the card's edge, not a fourth content
          // block equidistant from the chart above and the edge below (#184).
          <CardFooter className="pt-0 pb-3">
            <ChartSourceRow source={source} className="w-full" />
          </CardFooter>
        ) : null}
      </Card>

      {modal}
    </>
  );
});
